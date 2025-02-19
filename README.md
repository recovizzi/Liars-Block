# LiarsBlock – LiarsToken Smart Contract 🚀

LiarsBlock is a blockchain DApp inspired by the game "Liars Bar" and adapted to run on Ethereum. This project deploys an ERC20 token called **LiarsToken (LIE)**, which serves as the in-game currency. Users can purchase tokens with ETH, perform transfers, and benefit from a VIP system that allows them to periodically claim free tokens. The contract also includes a withdrawal function for the owner.

---

## Table of Contents

- [Contract Concept](#contract-concept)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Useful Commands](#useful-commands)
- [Tests](#tests)
- [Deployment](#deployment)
- [License](#license)
- [Contact & Support](#contact--support)

---

## Contract Concept 💡

The **LiarsToken** is an ERC20 token that enables players to:

- **Purchase tokens** by sending ETH (e.g., 1 ETH → 1000 LIE).
- **Transfer tokens** between users.
- **Register as VIP** (manually managed by the owner) and, as a VIP, claim 100 tokens every 10 minutes using the `claimVipTokens()` function.
- **Withdraw** the ETH accumulated in the contract (owner-only function).

This token is intended for integration into a decentralized gaming DApp (LiarsBlock) where it serves as both the stake and the internal economy.

---

## Features ⭐

- **Token Purchase**: Convert ETH to LIE.
- **VIP Management**: Add or remove VIPs and automatically claim VIP tokens with a 10-minute cooldown.
- **Owner Withdrawal**: The owner can withdraw the funds accumulated in the contract.
- Standard **ERC20 Transfers**.

---

## Prerequisites 🔧

Make sure you have installed:

- [Node.js](https://nodejs.org) (version 14 or higher)
- [npm](https://www.npmjs.com/) or [Yarn](https://yarnpkg.com/)
- [Hardhat](https://hardhat.org)

---

## Installation 📦

Clone the repository and install the dependencies:

```bash
git clone https://github.com/your-username/liarsblock.git
cd liarsblock
npm install
ipfs daemon
```

Key **devDependencies** include:

- `@nomicfoundation/hardhat-ignition`
- `@nomicfoundation/hardhat-ignition-ethers`
- `@nomicfoundation/hardhat-toolbox`
- `@openzeppelin/contracts`
- `ethers` (version 6)
- ...and others (check [package.json](./package.json) for the full list).

---

## Useful Commands ⚙️

### Compile Contracts

```bash
npx hardhat compile
```

### Launch a Local Hardhat Node

```bash
npx hardhat node
```

### Run Tests

```bash
npx hardhat test
```

### Deployment via Hardhat Ignition

There are two ways to deploy the contract:

1. **Via the Ignition Module**  
   The deployment module for `LiarsToken` is defined in the folder `ignition/modules/LiarsToken.js`.

   To deploy on the localhost network, run:
   ```bash
   npx hardhat ignition deploy ignition/modules/LiarsToken.js --network localhost
   ```

2. **Via a Deployment Script**  
   A deployment script is located in the folder `scripts/deploy.js`. To deploy the contract on the localhost network, run:
   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```

> **Note:** With ethers.js v6, use `await contract.getAddress()` in your scripts to retrieve the deployed contract address.

---

## Deployment of the LiarsToken Contract 📤

### Ignition Module – `ignition/modules/LiarsToken.js`

```js
// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("LiarsTokenModule", (m) => {
  console.log("Starting deployment of LiarsToken...");

  // Deploy the LiarsToken contract with no constructor parameters.
  const liarsToken = m.contract("LiarsToken", [], {
    gasLimit: 5000000,
    from: m.deployer,
  });

  // Return the deployed contract instance (as a future).
  return { liarsToken };
});
```

### Deployment Script – `scripts/deploy.js`

```js
const { ignition } = require("hardhat");

async function main() {
  // Deploy the module
  const { liarsToken } = await ignition.deploy(require("../ignition/modules/LiarsTokenModule"));

  // Retrieve the deployed address (with ethers v6, use getAddress())
  const deployedAddress = await liarsToken.getAddress();
  console.log("LiarsToken deployed to:", deployedAddress);

  // Display some post-deployment information
  const totalSupply = await liarsToken.totalSupply();
  console.log("Initial total supply:", totalSupply.toString());

  const owner = await liarsToken.owner();
  console.log("Contract owner:", owner);

  const contractBalance = await liarsToken.balanceOf(deployedAddress);
  console.log("Contract balance:", contractBalance.toString());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

---

## License 📄

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

---

## Contact & Support 🤝

If you have any questions or suggestions, please open an issue on GitHub or contact me at [your email].

---