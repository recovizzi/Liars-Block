const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LiarsToken", function () {
  async function deployLiarsTokenFixture() {
    const [owner, user1, user2] = await ethers.getSigners();
    const LiarsToken = await ethers.getContractFactory("LiarsToken");
    const liarsToken = await LiarsToken.deploy();
    
    // Assurez-vous que le contrat est bien déployé et récupérez l'adresse
    await liarsToken.waitForDeployment();
    const contractAddress = await liarsToken.getAddress(); // Utilisez getAddress() au lieu de .address
  
    console.log("Deployed contract at:", contractAddress); // Debug
  
    return { liarsToken, owner, user1, user2, contractAddress };
  }

  describe("Deployment", function () {
    it("Should have the correct name and symbol", async function () {
      const { liarsToken } = await loadFixture(deployLiarsTokenFixture);
      expect(await liarsToken.name()).to.equal("Liars Token");
      expect(await liarsToken.symbol()).to.equal("LIE");
    });
  });

  describe("Token Purchase", function () {
    it("Should mint tokens when ETH is sent", async function () {
      const { liarsToken, user1 } = await loadFixture(deployLiarsTokenFixture);
      // Sending 1 ETH should mint 1000 tokens (based on TOKENS_PER_ETH)
      await liarsToken.connect(user1).buyTokens({ value: ethers.parseEther("1") });
      expect(await liarsToken.balanceOf(user1.address)).to.equal(ethers.parseEther("1000"));
    });

    it("Should revert if no ETH is sent", async function () {
      const { liarsToken, user1 } = await loadFixture(deployLiarsTokenFixture);
      await expect(liarsToken.connect(user1).buyTokens({ value: 0 }))
        .to.be.revertedWith("You must send ETH to purchase tokens.");
    });

    it("Should mint tokens correctly for different ETH amounts", async function () {
      const { liarsToken, user1 } = await loadFixture(deployLiarsTokenFixture);
      // Sending 0.5 ETH should mint 500 tokens
      await liarsToken.connect(user1).buyTokens({ value: ethers.parseEther("0.5") });
      expect(await liarsToken.balanceOf(user1.address)).to.equal(ethers.parseEther("500"));

      // Sending 2 ETH should mint 2000 tokens
      await liarsToken.connect(user1).buyTokens({ value: ethers.parseEther("2") });
      expect(await liarsToken.balanceOf(user1.address)).to.equal(ethers.parseEther("2500")); // 500 + 2000
    });

    it("Should mint tokens correctly for non-divisible ETH amounts", async function () {
      const { liarsToken, user1 } = await loadFixture(deployLiarsTokenFixture);
      // Sending 1.5 ETH should mint 1500 tokens
      await liarsToken.connect(user1).buyTokens({ value: ethers.parseEther("1.5") });
      expect(await liarsToken.balanceOf(user1.address)).to.equal(ethers.parseEther("1500"));

      // Sending 0.75 ETH should mint 750 tokens
      await liarsToken.connect(user1).buyTokens({ value: ethers.parseEther("0.75") });
      expect(await liarsToken.balanceOf(user1.address)).to.equal(ethers.parseEther("2250")); // 1500 + 750
    });

    it("Should mint tokens correctly for very small ETH amounts", async function () {
      const { liarsToken, user1 } = await loadFixture(deployLiarsTokenFixture);
      // Sending 0.0001 ETH should mint 0.1 tokens
      await liarsToken.connect(user1).buyTokens({ value: ethers.parseEther("0.0001") });
      expect(await liarsToken.balanceOf(user1.address)).to.equal(ethers.parseEther("0.1"));
    });

    it("Should mint tokens correctly for very large ETH amounts", async function () {
      const { liarsToken, user1 } = await loadFixture(deployLiarsTokenFixture);
      // Sending 50 ETH should mint 50,000 tokens (maximum allowed)
      await liarsToken.connect(user1).buyTokens({ value: ethers.parseEther("50") });
      expect(await liarsToken.balanceOf(user1.address)).to.equal(ethers.parseEther("50000"));
    });

    it("Should mint tokens correctly for high precision ETH amounts", async function () {
      const { liarsToken, user1 } = await loadFixture(deployLiarsTokenFixture);
      // Sending 0.123456789 ETH should mint 123.456789 tokens
      await liarsToken.connect(user1).buyTokens({ value: ethers.parseEther("0.123456789") });
      expect(await liarsToken.balanceOf(user1.address)).to.equal(ethers.parseEther("123.456789"));
    });

  });

  describe("VIP Functions", function () {
    it("Should allow the owner to add and remove a VIP", async function () {
      const { liarsToken, owner, user1 } = await loadFixture(deployLiarsTokenFixture);
      await liarsToken.addVIP(user1.address);
      expect(await liarsToken.isVIP(user1.address)).to.equal(true);
      await liarsToken.removeVIP(user1.address);
      expect(await liarsToken.isVIP(user1.address)).to.equal(false);
    });

    it("Should allow a VIP user to claim tokens with proper cooldown", async function () {
      const { liarsToken, user1 } = await loadFixture(deployLiarsTokenFixture);
      // Add user1 as VIP
      await liarsToken.addVIP(user1.address);
      // First claim
      await liarsToken.connect(user1).claimVipTokens();
      expect(await liarsToken.balanceOf(user1.address)).to.equal(ethers.parseEther("100"));
      // Attempting a second claim immediately should revert
      await expect(liarsToken.connect(user1).claimVipTokens())
        .to.be.revertedWith("Claim not available yet.");
      // Increase time by 10 minutes (600 seconds)
      await time.increase(600);
      await liarsToken.connect(user1).claimVipTokens();
      expect(await liarsToken.balanceOf(user1.address)).to.equal(ethers.parseEther("200"));
    });

    it("Should return the correct time until the next VIP claim", async function () {
      const { liarsToken, user1 } = await loadFixture(deployLiarsTokenFixture);
      await liarsToken.addVIP(user1.address);
      await liarsToken.connect(user1).claimVipTokens();
      let timeLeft = await liarsToken.timeUntilNextClaim(user1.address);
      expect(timeLeft).to.be.gt(0);
      // Increase time by 10 minutes
      await time.increase(600);
      timeLeft = await liarsToken.timeUntilNextClaim(user1.address);
      expect(timeLeft).to.equal(0);
    });

    it("Should not allow a non-VIP user to claim VIP tokens", async function () {
      const { liarsToken, user1 } = await loadFixture(deployLiarsTokenFixture);
      await expect(liarsToken.connect(user1).claimVipTokens())
        .to.be.revertedWith("You are not a VIP.");
    });

    it("Should prevent non-owners from adding or removing VIPs", async function () {
      const { liarsToken, owner, user1, user2 } = await loadFixture(deployLiarsTokenFixture);
    
      // Non-owner (user1) attempts to add user2 as VIP
      await expect(liarsToken.connect(user1).addVIP(user2.address)).to.be.revertedWithCustomError(liarsToken, "OwnableUnauthorizedAccount");
    
      // Owner adds user2 as VIP first
      await liarsToken.addVIP(user2.address);
    
      // Non-owner (user1) attempts to remove user2 from VIP
      await expect(liarsToken.connect(user1).removeVIP(user2.address)).to.be.revertedWithCustomError(liarsToken, "OwnableUnauthorizedAccount");
    });


  });

  describe("Withdraw Function", function () {
    beforeEach(async function () {
        const { liarsToken, user1 } = await loadFixture(deployLiarsTokenFixture);
        await liarsToken.connect(user1).buyTokens({ value: ethers.parseEther("1") });
    });

    it("Should allow only the owner to withdraw ETH", async function () {
        const { liarsToken, owner, user1 } = await loadFixture(deployLiarsTokenFixture);
        
        await liarsToken.connect(user1).buyTokens({ value: ethers.parseEther("1") });
        
        const contractAddress = await liarsToken.getAddress();
        
        const initialContractBalance = await ethers.provider.getBalance(contractAddress);
        const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
        
        const tx = await liarsToken.connect(owner).withdraw();
        const receipt = await tx.wait();
        
        const finalContractBalance = await ethers.provider.getBalance(contractAddress);
        const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
        
        expect(finalContractBalance).to.equal(0n);
        
        expect(finalOwnerBalance).to.be.greaterThan(initialOwnerBalance);
    });

    it("Should revert when non-owner tries to withdraw", async function () {
        const { liarsToken, user1 } = await loadFixture(deployLiarsTokenFixture);
        
        await expect(
            liarsToken.connect(user1).withdraw()
        ).to.be.revertedWithCustomError(
            liarsToken,
            "OwnableUnauthorizedAccount"
        );
    });

    it("Should revert when there is no ETH to withdraw", async function () {
        const { liarsToken, owner } = await loadFixture(deployLiarsTokenFixture);
        
        await expect(
            liarsToken.connect(owner).withdraw()
        ).to.be.revertedWith("No ETH");
    });
});

  describe("ERC20 Token Transfers", function () {
    it("Should allow transfers between users", async function () {
      const { liarsToken, owner, user1, user2 } = await loadFixture(deployLiarsTokenFixture);
      // Owner buys tokens to obtain a non-zero balance.
      await liarsToken.connect(owner).buyTokens({ value: ethers.parseEther("1") });
      // Owner transfers tokens to user1.
      await liarsToken.transfer(user1.address, ethers.parseEther("500"));
      expect(await liarsToken.balanceOf(user1.address)).to.equal(ethers.parseEther("500"));
      // User1 transfers tokens to user2.
      await liarsToken.connect(user1).transfer(user2.address, ethers.parseEther("200"));
      expect(await liarsToken.balanceOf(user2.address)).to.equal(ethers.parseEther("200"));
    });

    it("Should not allow transfer of VIP tokens", async function () {
      const { liarsToken, owner, user1, user2 } = await loadFixture(deployLiarsTokenFixture);
      
      // Add user1 as VIP
      await liarsToken.addVIP(user1.address);
      
      // User1 claims VIP tokens
      await liarsToken.connect(user1).claimVipTokens();
      const vipBalance = await liarsToken.balanceOf(user1.address);
      
      // Try to transfer VIP tokens to user2
      await expect(
        liarsToken.connect(user1).transfer(user2.address, vipBalance)
      ).to.be.revertedWith("VIP tokens are not transferable");
    });
  });

  describe("Token Balance Limits", function () {
    it("Should not allow accounts to exceed maximum token limit through purchases", async function () {
      const { liarsToken, user1 } = await loadFixture(deployLiarsTokenFixture);
      
      // Buy maximum allowed tokens (50,000)
      await liarsToken.connect(user1).buyTokens({ 
        value: ethers.parseEther("50") // Will mint 50,000 tokens
      });
  
      // Try to buy more tokens
      await expect(
        liarsToken.connect(user1).buyTokens({ value: ethers.parseEther("1") })
      ).to.be.revertedWith("Cannot exceed maximum token limit per account");
    });
  
    it("Should not allow accounts to exceed maximum token limit through transfers", async function () {
      const { liarsToken, owner, user1, user2 } = await loadFixture(deployLiarsTokenFixture);
      
      // Owner buys 50,000 tokens (maximum allowed)
      await liarsToken.connect(owner).buyTokens({ 
        value: ethers.parseEther("50")
      });
  
      // User2 buys 49,000 tokens
      await liarsToken.connect(user2).buyTokens({ 
        value: ethers.parseEther("49")
      });
  
      // Try to transfer more tokens to user2 (which would exceed the limit)
      await expect(
        liarsToken.connect(owner).transfer(user2.address, ethers.parseEther("2000"))
      ).to.be.revertedWith("Cannot exceed maximum token limit per account");
    });
  });


});
