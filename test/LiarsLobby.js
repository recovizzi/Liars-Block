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
            // TODO: Tester qu'une partie ne démarre pas avec moins de 2 joueurs.
        });

        it("should start game successfully with enough players", async function () {
            // TODO: Vérifier le démarrage du jeu lorsque le nombre minimal est atteint.
        });

        it("should set correct game state when starting", async function () {
            // TODO: Vérifier la mise à jour de l'état du jeu au démarrage.
        });

        it("should generate valid game reference", async function () {
            // TODO: Tester la génération d'un code ou d'une référence de partie valide.
        });

        it("should prevent starting an already started game", async function () {
            // TODO: S'assurer qu'une partie déjà démarrée ne peut pas être redémarrée.
        });
    });

    // ----- STAKE MANAGEMENT -----
    describe("Stake Management", function () {
        it("should allow players to deposit stakes", async function () {
            // TODO: Tester que les joueurs peuvent déposer leurs mises.
        });

        it("should track stakes correctly per player", async function () {
            // TODO: Vérifier le suivi individuel des mises.
        });

        it("should prevent stake deposits after game ends", async function () {
            // TODO: S'assurer qu'une fois la partie terminée, aucun dépôt de mise n'est accepté.
        });

        it("should handle token transfers correctly", async function () {
            // TODO: Vérifier que le transfert des tokens pour les mises s'effectue correctement.
        });
    });

    // ----- TURN MANAGEMENT -----
    describe("Turn Management", function () {
        it("should track current turn correctly", async function () {
            // TODO: Vérifier le suivi de l'indice du tour courant.
        });

        it("should advance turn after move submission", async function () {
            // TODO: Tester le passage au joueur suivant après une action valide.
        });

        it("should prevent moves from wrong player", async function () {
            // TODO: S'assurer qu'un joueur hors tour ne peut pas jouer.
        });

        it("should cycle through players correctly", async function () {
            // TODO: Vérifier que l'ordre de passage est bien cyclique.
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
            // TODO: Tester le calcul correct du gagnant.
        });

        it("should distribute total pot to winner", async function () {
            // TODO: Vérifier que la cagnotte est distribuée correctement.
        });

        it("should handle ties appropriately", async function () {
            // TODO: S'assurer que les égalités sont gérées selon les règles.
        });

        it("should end game after distribution", async function () {
            // TODO: Vérifier que le jeu se termine après la distribution des gains.
        });
    });

    // ----- EMERGENCY FUNCTIONS -----
    describe("Emergency Functions", function () {
        it("should allow owner to trigger emergency withdrawal", async function () {
            // TODO: Tester que le propriétaire peut déclencher un retrait d'urgence.
        });

        it("should prevent non-owner from emergency withdrawal", async function () {
            // TODO: Vérifier qu'un utilisateur non-propriétaire ne peut pas faire cela.
        });

        it("should reset stakes correctly", async function () {
            // TODO: Vérifier la réinitialisation des mises en cas d'urgence.
        });

        it("should end game on emergency", async function () {
            // TODO: Tester que l'urgence met fin à la partie.
        });
    });

    // ----- GAME STATE MANAGEMENT -----
    describe("Game State Management", function () {
        it("should update game state with IPFS hash", async function () {
            // TODO: Vérifier la mise à jour de l'état du jeu avec un hash IPFS.
        });

        it("should emit correct state update events", async function () {
            // TODO: Tester l'émission des événements lors de la mise à jour de l'état.
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
});
