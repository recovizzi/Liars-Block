const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

describe("LiarsToken", function () {
  async function deployLiarsTokenFixture() {
    const [owner, user1, user2] = await ethers.getSigners();
    const LiarsToken = await ethers.getContractFactory("LiarsToken");
    const liarsToken = await LiarsToken.deploy();
    // Attendre que le contrat soit effectivement déployé afin que liarsToken.address soit défini
    await liarsToken.waitForDeployment();
    return { liarsToken, owner, user1, user2 };
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
  });

  describe("Withdraw Function", function () {
    it("Should allow only the owner to withdraw ETH", async function () {
      const { liarsToken, owner, user1 } = await loadFixture(deployLiarsTokenFixture);
      // User1 buys tokens, sending ETH to the contract.
      await liarsToken.connect(user1).buyTokens({ value: ethers.parseEther("1") });
      const contractBalance = await ethers.provider.getBalance(liarsToken.address);
      expect(contractBalance).to.be.gt(0);
      
      // Non-owner attempting to withdraw should revert.
      await expect(liarsToken.connect(user1).withdraw()).to.be.reverted;
      
      // Owner withdraws ETH.
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await liarsToken.withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      // The owner's balance should increase approximately by the contract balance (minus gas fees).
      expect(ownerBalanceAfter).to.be.closeTo(ownerBalanceBefore.add(contractBalance), gasUsed);
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
  });
});
