const hre = require("hardhat");

async function main() {
  try {
    console.log("Starting deployment sequence...");

    // Deploy LiarsToken
    console.log("Deploying LiarsToken...");
    const LiarsToken = await hre.ethers.getContractFactory("LiarsToken");
    const liarsToken = await LiarsToken.deploy();
    await liarsToken.waitForDeployment();
    const liarsTokenAddress = await liarsToken.getAddress();
    console.log("LiarsToken deployed to:", liarsTokenAddress);

    // Deploy LiarsGameManager
    console.log("Deploying LiarsGameManager...");
    const LiarsGameManager = await hre.ethers.getContractFactory("LiarsGameManager");
    const liarsGameManager = await LiarsGameManager.deploy();
    await liarsGameManager.waitForDeployment();
    const liarsGameManagerAddress = await liarsGameManager.getAddress();
    console.log("LiarsGameManager deployed to:", liarsGameManagerAddress);

    // Initialize LiarsGameManager with LiarsToken address
    console.log("Initializing LiarsGameManager...");
    const initTx1 = await liarsGameManager.setLiarsToken(liarsTokenAddress);
    await initTx1.wait();
    console.log("LiarsGameManager initialized with LiarsToken");

    // Deploy LiarsLobby Implementation
    console.log("Deploying LiarsLobby Implementation...");
    const LiarsLobby = await hre.ethers.getContractFactory("LiarsLobby");
    const liarsLobbyImpl = await LiarsLobby.deploy();
    await liarsLobbyImpl.waitForDeployment();
    const liarsLobbyImplAddress = await liarsLobbyImpl.getAddress();
    console.log("LiarsLobby Implementation deployed to:", liarsLobbyImplAddress);

    // Set LiarsLobby Implementation in GameManager
    console.log("Setting LiarsLobby Implementation in GameManager...");
    const initTx2 = await liarsGameManager.setImplementation(liarsLobbyImplAddress);
    await initTx2.wait();
    console.log("LiarsLobby Implementation set in GameManager");

    // Verify contracts on Etherscan (if not on localhost)
    if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
      console.log("Waiting for block confirmations before verification...");
      // Wait for few block confirmations to ensure the contracts are deployed
      await liarsToken.deployTransaction.wait(6);
      await liarsGameManager.deployTransaction.wait(6);
      await liarsLobbyImpl.deployTransaction.wait(6);

      console.log("Verifying contracts on Etherscan...");
      try {
        await hre.run("verify:verify", {
          address: liarsTokenAddress,
          contract: "contracts/LiarsToken.sol:LiarsToken"
        });

        await hre.run("verify:verify", {
          address: liarsGameManagerAddress,
          contract: "contracts/LiarsGameManager.sol:LiarsGameManager"
        });

        await hre.run("verify:verify", {
          address: liarsLobbyImplAddress,
          contract: "contracts/LiarsLobby.sol:LiarsLobby"
        });
      } catch (error) {
        console.log("Verification failed:", error);
      }
    }

    // Log final deployment information
    console.log("\nDeployment Summary:");
    console.log("===================");
    console.log("Network:", hre.network.name);
    console.log("LiarsToken:", liarsTokenAddress);
    console.log("LiarsGameManager:", liarsGameManagerAddress);
    console.log("LiarsLobby Implementation:", liarsLobbyImplAddress);
    console.log("===================");

  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
