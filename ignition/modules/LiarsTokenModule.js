// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("LiarsTokenModule", (m) => {
  console.log("Starting deployment of LiarsToken...");

  // Deploy the LiarsToken contract with no constructor parameters.
  // (The LiarsToken contract constructor sets its name, symbol and the owner.)
  const liarsToken = m.contract("LiarsToken", [], {
    gasLimit: 5000000,
    from: m.deployer,
  });

  // Return the deployed contract instance (as a future) to be used by the deploy script.
  return { liarsToken };
});
