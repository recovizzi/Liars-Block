const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("LiarsGameManager", function () {
    async function deployLiarsGameManagerFixture() {
        const [owner, user1, user2, user3, user4] = await ethers.getSigners();
    
        // Deploy LiarsToken
        const LiarsToken = await ethers.getContractFactory("LiarsToken");
        const liarsToken = await LiarsToken.deploy();
    
        // Deploy LiarsLobby implementation
        const LiarsLobby = await ethers.getContractFactory("LiarsLobby");
        const liarsLobbyImplementation = await LiarsLobby.deploy();
    
        // Deploy LiarsGameManager
        const LiarsGameManager = await ethers.getContractFactory("LiarsGameManager");
        const gameManager = await LiarsGameManager.deploy();
    
        // Setup
        await gameManager.setLiarsToken(await liarsToken.getAddress());
        await gameManager.setImplementation(await liarsLobbyImplementation.getAddress());
    
        // Mint tokens for testing - Using smaller amounts to avoid overflow
        const amount = ethers.parseEther("100"); // Reduced from 1000 to 100
        
        // Use buyTokens instead of transfer to properly mint tokens
        await liarsToken.connect(user1).buyTokens({ value: ethers.parseEther("0.1") }); // Will mint 100 tokens
        await liarsToken.connect(user2).buyTokens({ value: ethers.parseEther("0.1") });
        await liarsToken.connect(user3).buyTokens({ value: ethers.parseEther("0.1") });
        await liarsToken.connect(user4).buyTokens({ value: ethers.parseEther("0.1") });
    
        return { gameManager, liarsToken, owner, user1, user2, user3, user4 };
    }

    describe("Lobby Creation", function () {
        it("Should create a public lobby with valid parameters", async function () {
            const { gameManager, user1 } = await loadFixture(deployLiarsGameManagerFixture);
            
            const code = "TEST123";
            const maxPlayers = 4;
            const stake = ethers.parseEther("10");
    
            // Create lobby and wait for transaction
            const tx = await gameManager.connect(user1).createPublicLobby(code, maxPlayers, stake);
            const receipt = await tx.wait();
    
            // Get the event
            const event = receipt.logs.find(
                log => gameManager.interface.parseLog(log)?.name === "LobbyCreated"
            );
            const decodedEvent = gameManager.interface.parseLog(event);
    
            // Verify parameters
            expect(decodedEvent.args.lobbyId).to.equal(1);
            expect(decodedEvent.args.codeHash).to.equal(ethers.keccak256(ethers.toUtf8Bytes(code)));
    
            // Get lobby details to verify other parameters
            const lobbyDetails = await gameManager.getLobbyDetails(1);
            expect(lobbyDetails.maxPlayers).to.equal(maxPlayers);
            expect(lobbyDetails.stake).to.equal(stake);
        });
    });

    describe("Lobby Joining", function () {
        it("Should not start game with only one player", async function () {
            const { gameManager, liarsToken, user1 } = await loadFixture(deployLiarsGameManagerFixture);
            
            // Create a 4-player lobby
            const code = "TEST123";
            const stake = ethers.parseEther("10");
            await gameManager.connect(user1).createPublicLobby(code, 4, stake);
            
            // First player joins
            await liarsToken.connect(user1).approve(gameManager.getAddress(), stake);
            await gameManager.connect(user1).joinLobbyByCode(code);
            
            // Verify one player in lobby
            const lobbyDetails = await gameManager.getLobbyDetails(1);
            expect(lobbyDetails.players.length).to.equal(1);
            
            // Try to start game
            await expect(
                gameManager.connect(user1).startGame(1)
            ).to.be.revertedWith("Not enough players");
        });
    
        it("Should allow game with minimum players (2)", async function () {
            const { gameManager, liarsToken, user1, user2 } = await loadFixture(deployLiarsGameManagerFixture);
            
            const code = "TEST123";
            const stake = ethers.parseEther("10");
            await gameManager.connect(user1).createPublicLobby(code, 4, stake);
            
            // Two players join
            await liarsToken.connect(user1).approve(gameManager.getAddress(), stake);
            await liarsToken.connect(user2).approve(gameManager.getAddress(), stake);
            await gameManager.connect(user1).joinLobbyByCode(code);
            await gameManager.connect(user2).joinLobbyByCode(code);
            
            // Verify two players in lobby
            const lobbyDetails = await gameManager.getLobbyDetails(1);
            expect(lobbyDetails.players.length).to.equal(2);
            
            // Start game should work
            await expect(gameManager.connect(user1).startGame(1))
                .to.emit(gameManager, "GameStarted")
                .withArgs(1);
        });
    
        it("Should allow game with three players", async function () {
            const { gameManager, liarsToken, user1, user2, user3 } = await loadFixture(deployLiarsGameManagerFixture);
            
            const code = "TEST123";
            const stake = ethers.parseEther("10");
            await gameManager.connect(user1).createPublicLobby(code, 4, stake);
            
            // Three players join
            for (const user of [user1, user2, user3]) {
                await liarsToken.connect(user).approve(gameManager.getAddress(), stake);
                await gameManager.connect(user).joinLobbyByCode(code);
            }
            
            // Verify three players in lobby
            const lobbyDetails = await gameManager.getLobbyDetails(1);
            expect(lobbyDetails.players.length).to.equal(3);
            
            // Start game should work
            await expect(gameManager.connect(user1).startGame(1))
                .to.emit(gameManager, "GameStarted")
                .withArgs(1);
        });
    
        it("Should allow game with maximum players (4)", async function () {
            const { gameManager, liarsToken, user1, user2, user3, user4 } = 
                await loadFixture(deployLiarsGameManagerFixture);
            
            const code = "TEST123";
            const stake = ethers.parseEther("10");
            await gameManager.connect(user1).createPublicLobby(code, 4, stake);
            
            // Four players join
            for (const user of [user1, user2, user3, user4]) {
                await liarsToken.connect(user).approve(gameManager.getAddress(), stake);
                await gameManager.connect(user).joinLobbyByCode(code);
            }
            
            // Verify four players in lobby
            const lobbyDetails = await gameManager.getLobbyDetails(1);
            expect(lobbyDetails.players.length).to.equal(4);
            
            // Start game should work
            await expect(gameManager.connect(user1).startGame(1))
                .to.emit(gameManager, "GameStarted")
                .withArgs(1);
        });
    
        it("Should prevent fifth player from joining", async function () {
            const { gameManager, liarsToken, user1, user2, user3, user4, owner } = 
                await loadFixture(deployLiarsGameManagerFixture);
            
            const code = "TEST123";
            const stake = ethers.parseEther("10");
            await gameManager.connect(user1).createPublicLobby(code, 4, stake);
            
            // First four players join
            for (const user of [user1, user2, user3, user4]) {
                await liarsToken.connect(user).approve(gameManager.getAddress(), stake);
                await gameManager.connect(user).joinLobbyByCode(code);
            }
            
            // Fifth player (owner) tries to join
            await liarsToken.connect(owner).approve(gameManager.getAddress(), stake);
            await expect(
                gameManager.connect(owner).joinLobbyByCode(code)
            ).to.be.revertedWith("Lobby is full");
            
            // Verify still only four players in lobby
            const lobbyDetails = await gameManager.getLobbyDetails(1);
            expect(lobbyDetails.players.length).to.equal(4);
        });
    });

    describe("Game Management", function () {
        it("Should allow starting game with minimum players", async function () {
            const { gameManager, liarsToken, user1, user2 } = await loadFixture(deployLiarsGameManagerFixture);
            
            // Create lobby
            const code = "TEST123";
            const stake = ethers.parseEther("10");
            const tx = await gameManager.connect(user1).createPublicLobby(code, 2, stake);
            const receipt = await tx.wait();
            
            // Get the lobby ID from the event
            const event = receipt.logs.find(log => gameManager.interface.parseLog(log)?.name === "LobbyCreated");
            const decodedEvent = gameManager.interface.parseLog(event);
            const lobbyId = decodedEvent.args.lobbyId;
    
            // Approve tokens for both players
            await liarsToken.connect(user1).approve(gameManager.getAddress(), stake);
            await liarsToken.connect(user2).approve(gameManager.getAddress(), stake);
    
            // Players join the lobby
            await gameManager.connect(user1).joinLobbyByCode(code);
            await gameManager.connect(user2).joinLobbyByCode(code);
            
            // Wait for transactions to be mined
            await ethers.provider.send("evm_mine", []);
            
            // Get lobby details and verify player count
            const lobbyDetails = await gameManager.getLobbyDetails(lobbyId);
            expect(lobbyDetails.players.length).to.equal(2);
            expect(lobbyDetails.state).to.equal(0); // LobbyState.Waiting
    
            // Start game
            await expect(gameManager.connect(user1).startGame(lobbyId))
                .to.emit(gameManager, "GameStarted")
                .withArgs(lobbyId);
    
            // Verify final state
            const finalLobbyDetails = await gameManager.getLobbyDetails(lobbyId);
            expect(finalLobbyDetails.state).to.equal(1); // LobbyState.InGame
        });
    });

    describe("Random Lobby Management", function () {
        it("Should create a new lobby when no available lobbies exist", async function () {
            const { gameManager, liarsToken, user1 } = await loadFixture(deployLiarsGameManagerFixture);
            
            // Approve tokens before joining
            const defaultStake = ethers.parseEther("10"); // 10 tokens
            await liarsToken.connect(user1).approve(gameManager.getAddress(), defaultStake);
            
            // Join random lobby (should create new one)
            const tx = await gameManager.connect(user1).joinRandomLobby();
            
            // Wait for transaction
            await tx.wait();
            
            // Verify lobby was created with default parameters
            const lobbyDetails = await gameManager.getLobbyDetails(1);
            expect(lobbyDetails.maxPlayers).to.equal(4); // MAX_PLAYERS
            expect(lobbyDetails.stake).to.equal(defaultStake);
            expect(lobbyDetails.players).to.include(user1.address);
        });
    
        it("Should join existing lobby when available", async function () {
            const { gameManager, liarsToken, user1, user2 } = await loadFixture(deployLiarsGameManagerFixture);
            
            // Create first lobby
            const stake = ethers.parseEther("10");
            await gameManager.connect(user1).createPublicLobby("TEST", 4, stake);
            
            // Approve tokens for both users
            await liarsToken.connect(user1).approve(gameManager.getAddress(), stake);
            await liarsToken.connect(user2).approve(gameManager.getAddress(), stake);
            
            // Join lobby with first user
            await gameManager.connect(user1).joinLobbyByCode("TEST");
            
            // Second user joins random lobby
            await gameManager.connect(user2).joinRandomLobby();
            
            // Verify both users are in the same lobby
            const lobbyDetails = await gameManager.getLobbyDetails(1);
            expect(lobbyDetails.players).to.include(user1.address);
            expect(lobbyDetails.players).to.include(user2.address);
            expect(lobbyDetails.players.length).to.equal(2);
        });
    });

    describe("Lobby Leaving", function () {
        it("Should allow players to leave lobby and return stakes", async function () {
            const { gameManager, liarsToken, user1 } = await loadFixture(deployLiarsGameManagerFixture);
            
            // Create lobby
            const stake = ethers.parseEther("10");
            const code = "TEST";
            await gameManager.connect(user1).createPublicLobby(code, 2, stake);
            
            // Approve and join lobby
            await liarsToken.connect(user1).approve(gameManager.getAddress(), stake);
            await gameManager.connect(user1).joinLobbyByCode(code);
            
            // Wait for transaction to be mined
            await ethers.provider.send("evm_mine", []);
            
            // Verify player is in lobby
            const lobbyBefore = await gameManager.getLobbyDetails(1);
            expect(lobbyBefore.players).to.include(user1.address);
            
            // Get initial balance
            const initialBalance = await liarsToken.balanceOf(user1.address);
            
            // Leave lobby
            await expect(gameManager.connect(user1).leaveLobby(1))
                .to.emit(gameManager, "PlayerLeft")
                .withArgs(1, user1.address);
            
            // Verify stake was returned
            const finalBalance = await liarsToken.balanceOf(user1.address);
            expect(finalBalance).to.equal(initialBalance + BigInt(stake));
            
            // Verify player was removed from lobby
            const lobbyAfter = await gameManager.getLobbyDetails(1);
            expect(lobbyAfter.players).to.not.include(user1.address);
        });
    });

    describe("Reward Distribution", function () {
        it("Should distribute total stakes to winner", async function () {
            const { gameManager, liarsToken, user1, user2 } = await loadFixture(deployLiarsGameManagerFixture);
            
            // Setup game
            const stake = ethers.parseEther("10");
            const totalStake = stake * BigInt(2); // Fixed multiplication
            
            // Create and join lobby
            await gameManager.connect(user1).createPublicLobby("TEST", 2, stake);
            
            // Approve tokens for both players
            await liarsToken.connect(user1).approve(gameManager.getAddress(), stake);
            await liarsToken.connect(user2).approve(gameManager.getAddress(), stake);
            
            // Join lobby
            await gameManager.connect(user1).joinLobbyByCode("TEST");
            await gameManager.connect(user2).joinLobbyByCode("TEST");
            
            // Wait for transactions to be mined
            await ethers.provider.send("evm_mine", []);
            
            // Start game
            await gameManager.connect(user1).startGame(1);
            
            // Get initial balance
            const initialBalance = await liarsToken.balanceOf(user1.address);
            
            // Distribute rewards
            await expect(gameManager.distributeRewards(1, user1.address))
                .to.emit(gameManager, "RewardsDistributed")
                .withArgs(1, user1.address, totalStake);
            
            // Verify winner received total stakes
            const finalBalance = await liarsToken.balanceOf(user1.address);
            expect(finalBalance - initialBalance).to.equal(totalStake);
        });
    });

    describe("Access Control", function () {
        it("Should only allow owner to set token address", async function () {
            const { gameManager, user1 } = await loadFixture(deployLiarsGameManagerFixture);
            
            await expect(
                gameManager.connect(user1).setLiarsToken(ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(gameManager, "OwnableUnauthorizedAccount")
            .withArgs(user1.address);
        });
    
        it("Should only allow owner to set implementation address", async function () {
            const { gameManager, user1 } = await loadFixture(deployLiarsGameManagerFixture);
            
            await expect(
                gameManager.connect(user1).setImplementation(ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(gameManager, "OwnableUnauthorizedAccount")
            .withArgs(user1.address);
        });
    });

    
});