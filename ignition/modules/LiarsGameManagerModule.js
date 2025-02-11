const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("LiarsGameManagerModule", async (m) => {
  console.log("Starting deployment of LiarsGameManager...");

  // Import the LiarsToken module
  const { liarsToken } = await m.import("LiarsTokenModule");

  // Deploy the LiarsGameManager contract with the LiarsToken contract address.
  const liarsGameManager = m.contract("LiarsGameManager", [liarsToken.address], {
    gasLimit: 5000000,
    from: m.deployer,
  });

  // Return the deployed contract instance (as a future) to be used by the deploy script.
  return { liarsGameManager };
});
