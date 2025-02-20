const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("LiarsLobby", function () {
    async function deployFixture() {
        const [owner, player1, player2, player3, ...others] = await ethers.getSigners();

        // Déploiement du token
        const LiarsToken = await ethers.getContractFactory("LiarsToken");
        const liarsToken = await LiarsToken.deploy();
        await liarsToken.waitForDeployment();
        const liarsTokenAddress = await liarsToken.getAddress();

        // Déploiement du lobby
        const LiarsLobby = await ethers.getContractFactory("LiarsLobby");
        const liarsLobby = await LiarsLobby.deploy();
        await liarsLobby.waitForDeployment();
        const liarsLobbyAddress = await liarsLobby.getAddress();

        // Initialisation du lobby avec l'adresse du token
        await liarsLobby.initialize([], liarsTokenAddress);

        // Mint des tokens pour les tests
        const mintAmount = ethers.parseEther("1000");
        await liarsToken.connect(player1).buyTokens({ value: ethers.parseEther("1") });
        await liarsToken.connect(player2).buyTokens({ value: ethers.parseEther("1") });
        await liarsToken.connect(player3).buyTokens({ value: ethers.parseEther("1") });

        return { 
            liarsLobby, 
            liarsToken, 
            liarsLobbyAddress,
            liarsTokenAddress,
            owner, 
            player1, 
            player2, 
            player3, 
            others,
            mintAmount 
        };
    }

    // ----- INITIALIZATION -----
    describe("Initialization", function () {
        it("should initialize with correct token address", async function () {
            const { liarsLobby, liarsTokenAddress } = await loadFixture(deployFixture);
            const tokenAddress = await liarsLobby.liarsToken();
            expect(tokenAddress).to.equal(liarsTokenAddress);
        });

        it("should initialize with empty player list", async function () {
            const { liarsLobby } = await loadFixture(deployFixture);
            const players = await liarsLobby.getPlayerList();
            expect(players).to.be.an('array').that.is.empty;
        });

        it("should initialize in Waiting state", async function () {
            const { liarsLobby } = await loadFixture(deployFixture);
            const state = await liarsLobby.state();
            expect(state).to.equal(0);
        });

        it("should initialize with current turn index at 0", async function () {
            const { liarsLobby } = await loadFixture(deployFixture);
            const turnIndex = await liarsLobby.currentTurnIndex();
            expect(turnIndex).to.equal(0);
        });

        it("should revert when trying to initialize twice", async function () {
            const { liarsLobby, liarsToken } = await loadFixture(deployFixture);
            await expect(
                liarsLobby.initialize([], liarsToken.getAddress())
            ).to.be.revertedWith("Already initialized");
        });

        it("should set the correct owner", async function () {
            const { liarsLobby, owner } = await loadFixture(deployFixture);
            expect(await liarsLobby.owner()).to.equal(owner.address);
        });
    });

    // ----- LOBBY MANAGEMENT -----
    describe("Lobby Management", function () {
        it("should allow players to join lobby", async function () {
            const { liarsLobby, player1 } = await loadFixture(deployFixture);
            
            // Rejoindre le lobby
            await liarsLobby.joinLobby(player1.address);
            
            // Vérifier la présence dans la liste des joueurs
            const players = await liarsLobby.getPlayerList();
            expect(players).to.include(player1.address);
        });

        it("should prevent players from joining twice", async function () {
            const { liarsLobby, player1 } = await loadFixture(deployFixture);
            
            // Premier join
            await liarsLobby.joinLobby(player1.address);
            
            // Deuxième tentative doit échouer
            await expect(
                liarsLobby.joinLobby(player1.address)
            ).to.be.revertedWith("Player already in lobby");
        });

        it("should allow players to leave lobby", async function () {
            const { liarsLobby, liarsToken, player1 } = await loadFixture(deployFixture);
            
            // Setup initial
            const stakeAmount = ethers.parseEther("100");
            await liarsToken.connect(player1).approve(await liarsLobby.getAddress(), stakeAmount);
            
            // Join et stake
            await liarsLobby.joinLobby(player1.address);
            await liarsLobby.connect(player1).depositStake(stakeAmount);
            
            // Leave
            await liarsLobby.leaveLobby(player1.address);
            
            // Vérification
            const players = await liarsLobby.getPlayerList();
            expect(players).to.not.include(player1.address);
        });

        it("should return stake when leaving", async function () {
            const { liarsLobby, liarsToken, player1 } = await loadFixture(deployFixture);
            const stakeAmount = ethers.parseEther("100");
            
            // Setup
            await liarsToken.connect(player1).approve(await liarsLobby.getAddress(), stakeAmount);
            await liarsLobby.joinLobby(player1.address);
            
            // Récupérer le solde initial
            const balanceBefore = await liarsToken.balanceOf(player1.address);
            
            // Déposer la mise
            await liarsLobby.connect(player1).depositStake(stakeAmount);
            
            // Quitter le lobby
            await liarsLobby.leaveLobby(player1.address);
            
            // Vérifier le solde final
            const balanceAfter = await liarsToken.balanceOf(player1.address);
            expect(balanceAfter).to.equal(balanceBefore);
        });

        it("should return correct player list", async function () {
            const { liarsLobby, player1, player2, player3 } = await loadFixture(deployFixture);
            
            // Ajouter plusieurs joueurs
            await liarsLobby.joinLobby(player1.address);
            await liarsLobby.joinLobby(player2.address);
            await liarsLobby.joinLobby(player3.address);
            
            // Vérifier la liste
            const players = await liarsLobby.getPlayerList();
            expect(players).to.have.lengthOf(3);
            expect(players).to.include(player1.address);
            expect(players).to.include(player2.address);
            expect(players).to.include(player3.address);
        });

        it("should prevent joining after game starts", async function () {
            const { liarsLobby, player1, player2, player3 } = await loadFixture(deployFixture);
            
            // Ajouter le minimum de joueurs et démarrer la partie
            await liarsLobby.joinLobby(player1.address);
            await liarsLobby.joinLobby(player2.address);
            await liarsLobby.startGame();
            
            // Tenter d'ajouter un joueur après le début
            await expect(
                liarsLobby.joinLobby(player3.address)
            ).to.be.revertedWith("Game already started");
        });

        it("should emit events when players join and leave", async function () {
            const { liarsLobby, player1 } = await loadFixture(deployFixture);
            
            // Vérifier l'événement lors de l'ajout
            await expect(liarsLobby.joinLobby(player1.address))
                .to.emit(liarsLobby, "PlayerJoined")
                .withArgs(player1.address);
            
            // Vérifier l'événement lors du départ
            await expect(liarsLobby.leaveLobby(player1.address))
                .to.emit(liarsLobby, "PlayerLeft")
                .withArgs(player1.address);
        });

        it("should respect max stake limit", async function () {
            const { liarsLobby, liarsToken, player1 } = await loadFixture(deployFixture);
            const maxStake = await liarsLobby.MAX_STAKE();
            const overMaxStake = maxStake + BigInt(1);
            
            await liarsLobby.joinLobby(player1.address);
            await liarsToken.connect(player1).approve(liarsLobby.getAddress(), overMaxStake);
            
            await expect(
                liarsLobby.connect(player1).depositStake(overMaxStake)
            ).to.be.revertedWith("Stake exceeds maximum limit");
        });

        it("should handle player defeat when leaving during game", async function () {
            const { liarsLobby, liarsToken, player1, player2 } = await loadFixture(deployFixture);
            const stakeAmount = ethers.parseEther("100");
            
            // Setup game
            await liarsToken.connect(player1).approve(liarsLobby.getAddress(), stakeAmount);
            await liarsLobby.joinLobby(player1.address);
            await liarsLobby.joinLobby(player2.address);
            await liarsLobby.connect(player1).depositStake(stakeAmount);
            await liarsLobby.startGame();
            
            // Leave during game should trigger defeat
            await expect(liarsLobby.leaveLobby(player1.address))
                .to.emit(liarsLobby, "PlayerDefeated")
                .withArgs(player1.address, stakeAmount);
            
            // Verify stake is not returned
            const finalBalance = await liarsToken.balanceOf(player1.address);
            expect(finalBalance).to.equal(await liarsToken.balanceOf(player1.address));
        });
    });

    // ----- GAME START -----
    describe("Game Start", function () {
        it("should not start with less than 2 players", async function () {
            const { liarsLobby, player1 } = await loadFixture(deployFixture);
            // On ne rejoint que 1 joueur
            await liarsLobby.joinLobby(player1.address);
            await expect(liarsLobby.startGame())
                .to.be.revertedWith("Not enough players to start");
        });

        it("should start game successfully with enough players", async function () {
            const { liarsLobby, player1, player2 } = await loadFixture(deployFixture);
            
            // Rejoindre avec 2 joueurs
            await liarsLobby.joinLobby(player1.address);
            await liarsLobby.joinLobby(player2.address);
            
            // Vérifier l'événement GameStarted
            await expect(liarsLobby.startGame())
                .to.emit(liarsLobby, "GameStarted");
        });

        it("should set correct game state when starting", async function () {
            const { liarsLobby, player1, player2 } = await loadFixture(deployFixture);
            
            // Setup et démarrage
            await liarsLobby.joinLobby(player1.address);
            await liarsLobby.joinLobby(player2.address);
            await liarsLobby.startGame();
            
            // Vérifier l'état (LobbyState.InGame = 1)
            const state = await liarsLobby.state();
            expect(state).to.equal(1); // InGame
        });

        it("should generate valid game reference", async function () {
            const { liarsLobby, player1, player2 } = await loadFixture(deployFixture);
            
            // Setup et démarrage
            await liarsLobby.joinLobby(player1.address);
            await liarsLobby.joinLobby(player2.address);
            await liarsLobby.startGame();
            
            // Vérifier que la référence du jeu est un bytes32 non nul
            const gameRef = await liarsLobby.gameReference();
            expect(gameRef).to.not.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
        });

        it("should prevent starting an already started game", async function () {
            const { liarsLobby, player1, player2 } = await loadFixture(deployFixture);
            
            // Setup et premier démarrage
            await liarsLobby.joinLobby(player1.address);
            await liarsLobby.joinLobby(player2.address);
            await liarsLobby.startGame();
            
            // Tenter de redémarrer
            await expect(liarsLobby.startGame())
                .to.be.revertedWith("Game already started");
        });
    });

    // ----- STAKE MANAGEMENT -----
    describe("Stake Management", function () {
        it("should allow players to deposit stakes", async function () {
            const { liarsLobby, liarsToken, player1 } = await loadFixture(deployFixture);
            const stakeAmount = ethers.parseEther("100");
            
            // Setup initial
            await liarsToken.connect(player1).approve(await liarsLobby.getAddress(), stakeAmount);
            await liarsLobby.joinLobby(player1.address);

            // Vérifier l'événement et le dépôt
            await expect(liarsLobby.connect(player1).depositStake(stakeAmount))
                .to.emit(liarsLobby, "StakeDeposited")
                .withArgs(player1.address, stakeAmount);

            const playerStake = await liarsLobby.stakes(player1.address);
            expect(playerStake).to.equal(stakeAmount);
        });

        it("should track stakes correctly per player", async function () {
            const { liarsLobby, liarsToken, player1, player2 } = await loadFixture(deployFixture);
            const stake1 = ethers.parseEther("100");
            const stake2 = ethers.parseEther("200");

            // Setup pour les deux joueurs
            await liarsLobby.joinLobby(player1.address);
            await liarsLobby.joinLobby(player2.address);
            await liarsToken.connect(player1).approve(await liarsLobby.getAddress(), stake1);
            await liarsToken.connect(player2).approve(await liarsLobby.getAddress(), stake2);

            // Dépôt des mises
            await liarsLobby.connect(player1).depositStake(stake1);
            await liarsLobby.connect(player2).depositStake(stake2);

            // Vérification des mises
            expect(await liarsLobby.stakes(player1.address)).to.equal(stake1);
            expect(await liarsLobby.stakes(player2.address)).to.equal(stake2);
        });

        it("should prevent stake deposits after game ends", async function () {
            const { liarsLobby, liarsToken, player1, player2 } = await loadFixture(deployFixture);
            const stakeAmount = ethers.parseEther("100");

            // Setup et démarrage du jeu
            await liarsLobby.joinLobby(player1.address);
            await liarsLobby.joinLobby(player2.address);
            await liarsToken.connect(player1).approve(await liarsLobby.getAddress(), stakeAmount);
            
            // Terminer le jeu (mettre l'état à Ended)
            await liarsLobby.emergencyWithdraw(); // ou une autre méthode pour terminer le jeu

            // Tentative de dépôt après la fin
            await expect(liarsLobby.connect(player1).depositStake(stakeAmount))
                .to.be.revertedWith("Game is not active");
        });

        it("should handle token transfers correctly", async function () {
            const { liarsLobby, liarsToken, player1 } = await loadFixture(deployFixture);
            const stakeAmount = ethers.parseEther("100");

            // Setup initial
            await liarsLobby.joinLobby(player1.address);
            const initialBalance = await liarsToken.balanceOf(player1.address);
            await liarsToken.connect(player1).approve(await liarsLobby.getAddress(), stakeAmount);

            // Déposer la mise
            await liarsLobby.connect(player1).depositStake(stakeAmount);

            // Vérifier les balances
            expect(await liarsToken.balanceOf(player1.address)).to.equal(initialBalance - stakeAmount);
            expect(await liarsToken.balanceOf(await liarsLobby.getAddress())).to.equal(stakeAmount);
        });

        it("should respect maximum stake limit", async function () {
            const { liarsLobby, liarsToken, player1 } = await loadFixture(deployFixture);
            const maxStake = await liarsLobby.MAX_STAKE();
            const overMaxStake = maxStake + BigInt(1);

            // Setup
            await liarsLobby.joinLobby(player1.address);
            await liarsToken.connect(player1).approve(await liarsLobby.getAddress(), overMaxStake);

            // Tenter de dépasser la limite
            await expect(liarsLobby.connect(player1).depositStake(overMaxStake))
                .to.be.revertedWith("Stake exceeds maximum limit");
        });
    });

    // ----- TURN MANAGEMENT -----
    describe("Turn Management", function () {
        it("should track current turn correctly", async function () {
            const { liarsLobby, player1, player2, player3 } = await loadFixture(deployFixture);
            
            // Setup initial
            await liarsLobby.joinLobby(player1.address);
            await liarsLobby.joinLobby(player2.address);
            await liarsLobby.joinLobby(player3.address);
            await liarsLobby.startGame();
            
            // Vérifier que le premier tour est attribué au premier joueur
            const currentTurn = await liarsLobby.getCurrentTurn();
            expect(currentTurn).to.equal(player1.address);
        });

        it("should advance turn after move submission", async function () {
            const { liarsLobby, player1, player2, player3 } = await loadFixture(deployFixture);
            
            // Setup initial
            await liarsLobby.joinLobby(player1.address);
            await liarsLobby.joinLobby(player2.address);
            await liarsLobby.joinLobby(player3.address);
            await liarsLobby.startGame();
            
            // Créer un hash pour le move
            const moveHash = ethers.keccak256(ethers.toUtf8Bytes("move1"));
            
            // Player1 soumet son coup
            await liarsLobby.connect(player1).submitMove(moveHash);
            
            // Vérifier que c'est maintenant le tour de player2
            const nextTurn = await liarsLobby.getCurrentTurn();
            expect(nextTurn).to.equal(player2.address);
        });

        it("should prevent moves from wrong player", async function () {
            const { liarsLobby, player1, player2 } = await loadFixture(deployFixture);
            
            // Setup initial
            await liarsLobby.joinLobby(player1.address);
            await liarsLobby.joinLobby(player2.address);
            await liarsLobby.startGame();
            
            const moveHash = ethers.keccak256(ethers.toUtf8Bytes("move1"));
            
            // Player2 tente de jouer alors que c'est le tour de player1
            await expect(
                liarsLobby.connect(player2).submitMove(moveHash)
            ).to.be.revertedWith("Not your turn");
        });

        it("should cycle through players correctly", async function () {
            const { liarsLobby, player1, player2, player3 } = await loadFixture(deployFixture);
            
            // Setup initial
            await liarsLobby.joinLobby(player1.address);
            await liarsLobby.joinLobby(player2.address);
            await liarsLobby.joinLobby(player3.address);
            await liarsLobby.startGame();
            
            // Créer des hashs pour les moves
            const move1Hash = ethers.keccak256(ethers.toUtf8Bytes("move1"));
            const move2Hash = ethers.keccak256(ethers.toUtf8Bytes("move2"));
            const move3Hash = ethers.keccak256(ethers.toUtf8Bytes("move3"));
            
            // Vérifier le cycle complet
            
            // Tour 1: Player1 -> Player2
            await liarsLobby.connect(player1).submitMove(move1Hash);
            let currentTurn = await liarsLobby.getCurrentTurn();
            expect(currentTurn).to.equal(player2.address);
            
            // Tour 2: Player2 -> Player3
            await liarsLobby.connect(player2).submitMove(move2Hash);
            currentTurn = await liarsLobby.getCurrentTurn();
            expect(currentTurn).to.equal(player3.address);
            
            // Tour 3: Player3 -> Player1 (cycle complet)
            await liarsLobby.connect(player3).submitMove(move3Hash);
            currentTurn = await liarsLobby.getCurrentTurn();
            expect(currentTurn).to.equal(player1.address);
        });
    });

    // ----- MOVE SUBMISSION -----
    describe("Move Submission", function () {
        it("should allow valid move submission", async function () {
            // TODO: Tester la soumission d'un coup valide.
        });

        it("should store move hash correctly", async function () {
            // TODO: Vérifier que le hash du coup est stocké pour la phase de challenge.
        });

        it("should track last mover correctly", async function () {
            // TODO: Vérifier que le dernier joueur ayant joué est enregistré.
        });

        it("should emit correct events on submission", async function () {
            // TODO: Vérifier l'émission des événements lors de la soumission.
        });
    });

    // ----- MOVE CHALLENGE -----
    describe("Move Challenge", function () {
        it("should allow players to challenge moves", async function () {
            // TODO: Tester que les joueurs peuvent challenger un coup.
        });

        it("should prevent self-challenges", async function () {
            // TODO: S'assurer qu'un joueur ne peut pas se challenger lui-même.
        });

        it("should handle challenge resolution correctly", async function () {
            // TODO: Vérifier la résolution d'un challenge (vrai bluff ou non).
        });

        it("should emit correct challenge events", async function () {
            // TODO: Tester l'émission des événements liés au challenge.
        });
    });

    // ----- MOVE REVELATION -----
    describe("Move Revelation", function () {
        it("should verify move hash correctly", async function () {
            // TODO: Tester la correspondance entre le hash stocké et le coup révélé.
        });

        it("should handle valid move revelation", async function () {
            // TODO: Vérifier le comportement lors d'une révélation valide.
        });

        it("should handle invalid move revelation", async function () {
            // TODO: S'assurer que l'échec d'une révélation déclenche la pénalité.
        });

        it("should update rounds lost counter", async function () {
            // TODO: Vérifier la mise à jour du compteur de rounds perdus.
        });

        it("should reset move data after revelation", async function () {
            // TODO: Tester la réinitialisation des données de coup après révélation.
        });
    });

    // ----- PENALTY SYSTEM -----
    describe("Penalty System", function () {
        it("should track rounds lost correctly", async function () {
            // TODO: Vérifier que les rounds perdus sont bien enregistrés.
        });

        it("should execute penalties properly", async function () {
            // TODO: Tester l'exécution des pénalités (roulette russe).
        });

        it("should handle player elimination", async function () {
            // TODO: S'assurer qu'un joueur est éliminé lorsque les conditions sont remplies.
        });

        it("should emit correct penalty events", async function () {
            // TODO: Vérifier l'émission des événements liés aux pénalités.
        });
    });

    // ----- REWARD DISTRIBUTION ----- 
    describe("Reward Distribution", function () {
        it("should calculate winner correctly", async function () {
            const { liarsLobby, liarsToken, player1, player2, player3 } = await loadFixture(deployFixture);
            const stake = ethers.parseEther("100");
            
            // Setup game
            await liarsLobby.joinLobby(player1.address);
            await liarsLobby.joinLobby(player2.address);
            await liarsLobby.joinLobby(player3.address);
            
            // Record initial balance
            const initialBalance = await liarsToken.balanceOf(player1.address);
            
            // Approve and deposit stakes
            await liarsToken.connect(player1).approve(await liarsLobby.getAddress(), stake);
            await liarsToken.connect(player2).approve(await liarsLobby.getAddress(), stake);
            await liarsToken.connect(player3).approve(await liarsLobby.getAddress(), stake);
            
            await liarsLobby.connect(player1).depositStake(stake);
            await liarsLobby.connect(player2).depositStake(stake);
            await liarsLobby.connect(player3).depositStake(stake);
            
            await liarsLobby.startGame();
    
            // Create moves and submit them
            const validMove = ethers.toUtf8Bytes("valid_move");
            const validMoveHash = ethers.keccak256(validMove);
            const invalidMove = ethers.toUtf8Bytes("invalid_move");
            const invalidMoveHash = ethers.keccak256(invalidMove);
    
            // Create loss situations through moves and challenges
            await liarsLobby.connect(player1).submitMove(validMoveHash);
            await liarsLobby.connect(player2).challengeMove();
            await liarsLobby.revealMove(validMove); // Player 2 loses for wrong challenge
    
            await liarsLobby.connect(player2).submitMove(invalidMoveHash);
            await liarsLobby.connect(player3).challengeMove();
            await liarsLobby.revealMove(invalidMove); // Player 2 loses for lying
    
            // Distribute rewards
            await liarsLobby.distributeRewards();
            
            // Calculate expected final balance
            const totalPot = stake * BigInt(3); // Total stakes from all players
            const expectedBalance = initialBalance - stake + totalPot; // Initial - stake + winnings
            
            // Verify winner (player1) received correct amount
            const finalBalance = await liarsToken.balanceOf(player1.address);
            expect(finalBalance).to.equal(expectedBalance);
        });
    
        it("should distribute total pot to winner", async function () {
            const { liarsLobby, liarsToken, player1, player2 } = await loadFixture(deployFixture);
            const stake = ethers.parseEther("100");
            
            // Setup and start game
            await liarsLobby.joinLobby(player1.address);
            await liarsLobby.joinLobby(player2.address);
            
            await liarsToken.connect(player1).approve(await liarsLobby.getAddress(), stake);
            await liarsToken.connect(player2).approve(await liarsLobby.getAddress(), stake);
            
            await liarsLobby.connect(player1).depositStake(stake);
            await liarsLobby.connect(player2).depositStake(stake);
            
            await liarsLobby.startGame();
    
            // Create a loss situation through move and challenge
            const invalidMove = ethers.toUtf8Bytes("invalid_move");
            const invalidMoveHash = ethers.keccak256(invalidMove);
    
            await liarsLobby.connect(player1).submitMove(invalidMoveHash);
            await liarsLobby.connect(player2).challengeMove();
            await liarsLobby.revealMove(invalidMove); // Player 1 loses for lying
            
            // Distribute rewards
            await liarsLobby.distributeRewards();
            
            // Verify winner (player2) received total pot
            const finalBalance = await liarsToken.balanceOf(player2.address);
            const totalPot = stake * BigInt(2);
            expect(finalBalance).to.be.gt(stake);
        });
    
        it("should handle ties appropriately", async function () {
            const { liarsLobby, liarsToken, player1, player2 } = await loadFixture(deployFixture);
            const stake = ethers.parseEther("100");
            
            // Setup game
            await liarsLobby.joinLobby(player1.address);
            await liarsLobby.joinLobby(player2.address);
            
            await liarsToken.connect(player1).approve(await liarsLobby.getAddress(), stake);
            await liarsToken.connect(player2).approve(await liarsLobby.getAddress(), stake);
            
            await liarsLobby.connect(player1).depositStake(stake);
            await liarsLobby.connect(player2).depositStake(stake);
            
            await liarsLobby.startGame();
    
            // Create tie situation through moves and challenges
            const invalidMove = ethers.toUtf8Bytes("invalid_move");
            const invalidMoveHash = ethers.keccak256(invalidMove);
    
            // Both players make invalid moves and get caught
            await liarsLobby.connect(player1).submitMove(invalidMoveHash);
            await liarsLobby.connect(player2).challengeMove();
            await liarsLobby.revealMove(invalidMove);
    
            await liarsLobby.connect(player2).submitMove(invalidMoveHash);
            await liarsLobby.connect(player1).challengeMove();
            await liarsLobby.revealMove(invalidMove);
            
            // Distribute rewards (first player should win in tie)
            await liarsLobby.distributeRewards();
            
            // Verify first player wins in tie
            const player1Balance = await liarsToken.balanceOf(player1.address);
            expect(player1Balance).to.be.gt(stake);
        });
    
        it("should end game after distribution", async function () {
            const { liarsLobby, liarsToken, player1, player2 } = await loadFixture(deployFixture);
            const stake = ethers.parseEther("100");
            
            // Setup and start game
            await liarsLobby.joinLobby(player1.address);
            await liarsLobby.joinLobby(player2.address);
            
            await liarsToken.connect(player1).approve(await liarsLobby.getAddress(), stake);
            await liarsToken.connect(player2).approve(await liarsLobby.getAddress(), stake);
            
            await liarsLobby.connect(player1).depositStake(stake);
            await liarsLobby.connect(player2).depositStake(stake);
            
            await liarsLobby.startGame();
            
            // Distribute rewards
            await liarsLobby.distributeRewards();
            
            // Check game state is Ended (2)
            const gameState = await liarsLobby.state();
            expect(gameState).to.equal(2); // LobbyState.Ended
        });
    });
    
    describe("Emergency Functions", function () {
        it("should allow owner to trigger emergency withdrawal", async function () {
            const { liarsLobby, owner } = await loadFixture(deployFixture);
            
            // Only owner should be able to call emergency withdrawal
            await expect(liarsLobby.connect(owner).emergencyWithdraw())
                .to.emit(liarsLobby, 'EmergencyWithdrawal');
        });
    
        it("should prevent non-owner from emergency withdrawal", async function () {
            const { liarsLobby, player1 } = await loadFixture(deployFixture);
            
            // Non-owner should not be able to trigger emergency withdrawal
            await expect(liarsLobby.connect(player1).emergencyWithdraw())
                .to.be.revertedWithCustomError(liarsLobby, "OwnableUnauthorizedAccount")
                .withArgs(player1.address);
        });
    
        it("should reset stakes correctly", async function () {
            const { liarsLobby, liarsToken, player1, player2 } = await loadFixture(deployFixture);
            const stake = ethers.parseEther("100");
            
            // Setup stakes
            await liarsLobby.joinLobby(player1.address);
            await liarsLobby.joinLobby(player2.address);
            
            await liarsToken.connect(player1).approve(await liarsLobby.getAddress(), stake);
            await liarsToken.connect(player2).approve(await liarsLobby.getAddress(), stake);
            
            await liarsLobby.connect(player1).depositStake(stake);
            await liarsLobby.connect(player2).depositStake(stake);
            
            // Trigger emergency withdrawal
            await liarsLobby.emergencyWithdraw();
            
            // Check stakes are reset
            const player1Stake = await liarsLobby.stakes(player1.address);
            const player2Stake = await liarsLobby.stakes(player2.address);
            
            expect(player1Stake).to.equal(0);
            expect(player2Stake).to.equal(0);
        });
    
        it("should end game on emergency", async function () {
            const { liarsLobby } = await loadFixture(deployFixture);
            
            // Start game
            await liarsLobby.joinLobby(ethers.Wallet.createRandom().address);
            await liarsLobby.joinLobby(ethers.Wallet.createRandom().address);
            await liarsLobby.startGame();
            
            // Trigger emergency
            await liarsLobby.emergencyWithdraw();
            
            // Check game state is Ended
            const gameState = await liarsLobby.state();
            expect(gameState).to.equal(2); // LobbyState.Ended
        });
    });

    // ----- INTEGRATION TESTS -----
    describe("Integration Tests", function () {
        it("should handle full game cycle", async function () {
            // TODO: Simuler une partie complète depuis la création du lobby jusqu'à la distribution des gains.
        });

        it("should handle multiple rounds of play", async function () {
            // TODO: Vérifier que plusieurs rounds se déroulent correctement.
        });

        it("should handle concurrent games", async function () {
            // TODO: S'assurer que plusieurs parties peuvent être gérées en parallèle.
        });

        it("should maintain token economy correctly", async function () {
            // TODO: Vérifier la cohérence de l'économie du token LIE sur plusieurs cycles de jeu.
        });
    });

    describe("Card Distribution System", function () {
        describe("Deck Initialization", function () {
            it("should initialize deck with correct card distribution", async function () {
                const { liarsLobby, liarsToken } = await loadFixture(deployFixture);
                const [owner, ...signers] = await ethers.getSigners();
                
                // Setup 4 players using actual signers
                const players = signers.slice(0, 4);
                for (let player of players) {
                    await liarsLobby.joinLobby(player.address);
                    // Mint tokens for the players
                    await liarsToken.connect(player).buyTokens({ value: ethers.parseEther("1") });
                }
                await liarsLobby.startGame();
    
                // Setup all players with keys and get their hands
                let allCards = [];
                for (let player of players) {
                    const secret = `secret_${player.address}`;
                    const keyHash = ethers.keccak256(ethers.toUtf8Bytes(secret));
                    await liarsLobby.connect(player).registerPlayerKey(keyHash);
                    await liarsLobby.connect(player).requestHand(secret);
                    const hand = await liarsLobby.connect(player).getMyHand(secret);
                    allCards = [...allCards, ...hand];
                }
    
                // Count total cards by type
                let cardCounts = [0, 0, 0, 0, 0];
                for (let card of allCards) {
                    cardCounts[card]++;
                }
    
                // Verify exact card quantities
                expect(cardCounts[1]).to.equal(6); // 6 As
                expect(cardCounts[2]).to.equal(6); // 6 Rois
                expect(cardCounts[3]).to.equal(6); // 6 Reines
                expect(cardCounts[4]).to.equal(2); // 2 Jokers
                expect(cardCounts[0]).to.equal(0); // No cards of type 0
            });
    
            it("should distribute all 20 cards with 4 players", async function () {
                const { liarsLobby, liarsToken } = await loadFixture(deployFixture);
                const [owner, ...signers] = await ethers.getSigners();
                
                // Setup exactly 4 players using actual signers
                const players = signers.slice(0, 4);
                for (let player of players) {
                    await liarsLobby.joinLobby(player.address);
                    // Mint tokens for the players
                    await liarsToken.connect(player).buyTokens({ value: ethers.parseEther("1") });
                }
                await liarsLobby.startGame();
    
                // Get all hands
                let totalCards = 0;
                for (let player of players) {
                    const secret = `secret_${player.address}`;
                    const keyHash = ethers.keccak256(ethers.toUtf8Bytes(secret));
                    await liarsLobby.connect(player).registerPlayerKey(keyHash);
                    await liarsLobby.connect(player).requestHand(secret);
                    const hand = await liarsLobby.connect(player).getMyHand(secret);
                    totalCards += hand.length;
                }
    
                // Verify total cards distributed
                expect(totalCards).to.equal(20); // 6+6+6+2 = 20 cards total
            });
        });
    
        describe("Hand Distribution Security", function () {
            it("should require player registration before hand distribution", async function () {
                const { liarsLobby, player1 } = await loadFixture(deployFixture);
                
                await liarsLobby.joinLobby(player1.address);
                await liarsLobby.joinLobby(ethers.Wallet.createRandom().address);
                await liarsLobby.startGame();
    
                const secret = "test_secret";
                await expect(
                    liarsLobby.connect(player1).requestHand(secret)
                ).to.be.revertedWith("Player key not registered");
            });
    
            it("should prevent hand requests with invalid secret", async function () {
                const { liarsLobby, player1 } = await loadFixture(deployFixture);
                
                await liarsLobby.joinLobby(player1.address);
                await liarsLobby.joinLobby(ethers.Wallet.createRandom().address);
                await liarsLobby.startGame();
    
                const secret = "correct_secret";
                const wrongSecret = "wrong_secret";
                const keyHash = ethers.keccak256(ethers.toUtf8Bytes(secret));
                
                await liarsLobby.connect(player1).registerPlayerKey(keyHash);
                
                await expect(
                    liarsLobby.connect(player1).requestHand(wrongSecret)
                ).to.be.revertedWith("Invalid secret");
            });
    
            it("should prevent double hand requests", async function () {
                const { liarsLobby, player1 } = await loadFixture(deployFixture);
                
                await liarsLobby.joinLobby(player1.address);
                await liarsLobby.joinLobby(ethers.Wallet.createRandom().address);
                await liarsLobby.startGame();
    
                const secret = "test_secret";
                const keyHash = ethers.keccak256(ethers.toUtf8Bytes(secret));
                
                await liarsLobby.connect(player1).registerPlayerKey(keyHash);
                await liarsLobby.connect(player1).requestHand(secret);
                
                await expect(
                    liarsLobby.connect(player1).requestHand(secret)
                ).to.be.revertedWith("Hand already requested");
            });
        });
    
        describe("Game Phase Transitions", function () {
            it("should transition to Gameplay phase after all hands distributed", async function () {
                const { liarsLobby, player1, player2 } = await loadFixture(deployFixture);
                
                await liarsLobby.joinLobby(player1.address);
                await liarsLobby.joinLobby(player2.address);
                await liarsLobby.startGame();
    
                // Setup both players
                const secret1 = "secret1";
                const secret2 = "secret2";
                await liarsLobby.connect(player1).registerPlayerKey(ethers.keccak256(ethers.toUtf8Bytes(secret1)));
                await liarsLobby.connect(player2).registerPlayerKey(ethers.keccak256(ethers.toUtf8Bytes(secret2)));
    
                // First player requests hand
                await liarsLobby.connect(player1).requestHand(secret1);
                expect(await liarsLobby.currentRoundPhase()).to.equal(0); // Still Distribution
    
                // Second player requests hand
                const tx = await liarsLobby.connect(player2).requestHand(secret2);
                
                // Verify phase transition
                await expect(tx)
                    .to.emit(liarsLobby, "RoundPhaseAdvanced")
                    .withArgs(1); // Gameplay phase
            });
        });
    
        describe("Hand Privacy", function () {
            it("should maintain hand privacy between players", async function () {
                const { liarsLobby, player1, player2 } = await loadFixture(deployFixture);
                
                await liarsLobby.joinLobby(player1.address);
                await liarsLobby.joinLobby(player2.address);
                await liarsLobby.startGame();
    
                const secret1 = "secret1";
                const keyHash1 = ethers.keccak256(ethers.toUtf8Bytes(secret1));
                
                await liarsLobby.connect(player1).registerPlayerKey(keyHash1);
                await liarsLobby.connect(player1).requestHand(secret1);
    
                // Player 2 shouldn't be able to view player 1's hand
                await expect(
                    liarsLobby.connect(player2).getMyHand(secret1)
                ).to.be.reverted;
            });
        });
    });







});
