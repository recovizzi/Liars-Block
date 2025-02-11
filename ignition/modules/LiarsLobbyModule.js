const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("LiarsLobbyModule", async (m) => {
  console.log("Starting deployment of LiarsLobby...");

  // Import the LiarsToken and LiarsGameManager modules
  const { liarsToken } = await m.import("LiarsTokenModule");
  const { liarsGameManager } = await m.import("LiarsGameManagerModule");

  // Deploy the LiarsLobby contract with the LiarsToken and LiarsGameManager contract addresses.
  const liarsLobby = m.contract("LiarsLobby", [liarsToken.address, liarsGameManager.address], {
    gasLimit: 5000000,
    from: m.deployer,
  });

  // Return the deployed contract instance (as a future) to be used by the deploy script.
  return { liarsLobby };
});
