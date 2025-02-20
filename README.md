# LiarsBlock – A Decentralized Card Game with LiarsToken 🃏

LiarsBlock is a blockchain-based card game inspired by "Liar's Dice" but played with cards. The project uses an ERC20 token called **LiarsToken (LIE)** as in-game currency and IPFS for secure move verification. Users can purchase tokens with ETH, perform transfers, and VIP players can claim free tokens periodically.

---

## Table of Contents

- [Game Overview](#game-overview)
- [Technical Architecture](#technical-architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [IPFS Setup](#ipfs-setup)
- [Smart Contracts](#smart-contracts)
- [Running the Game](#running-the-game)
- [Useful Commands](#useful-commands)
- [Tests](#tests)
- [Deployment](#deployment)
- [License](#license)
- [Contact & Support](#contact--support)

---

## Game Overview 💡

### Game Rules
- Players join lobbies and bet using LiarsTokens (LIE)
- Each player receives 5 cards
- On their turn, players must:
  1. Play 1-3 cards face down
  2. Declare what cards they played
- Other players can:
  1. Accept the declaration and play their turn
  2. Challenge by calling "Liar"
- If caught lying, players face the Russian Roulette mechanism
- Last player standing wins the pot

### Token Features
- **Token Purchase**: Convert ETH to LIE (1 ETH → 1000 LIE)
- **VIP System**: Claim 100 tokens every 10 minutes (VIP only)
- **Standard Transfers**: ERC20 token transfers between players
- **Owner Functions**: Contract management and ETH withdrawal

---

## Technical Architecture 🏗️

### Smart Contracts
1. **LiarsToken (LIE)**
   - ERC20 implementation
   - VIP system management
   - Token purchase and claims

2. **LiarsLobby**
   - Game lobby management
   - Betting system
   - Game state management
   - Move verification

### IPFS Integration
- Stores encrypted card plays
- Verifies moves during challenges
- Ensures game integrity
- Move verification system

---

## Prerequisites 🔧

- [Node.js](https://nodejs.org) (v14+)
- [npm](https://www.npmjs.com/) or [Yarn](https://yarnpkg.com/)
- [Hardhat](https://hardhat.org)
- [IPFS](https://ipfs.tech/#install)
- [MetaMask](https://metamask.io/) or similar Web3 wallet

---

## Installation 📦

```bash
# Clone repository
git clone https://github.com/your-username/liarsblock.git
cd liarsblock
npm install
```

Key **devDependencies**:
- `@nomicfoundation/hardhat-ignition`
- `@nomicfoundation/hardhat-toolbox`
- `@openzeppelin/contracts`
- `ipfs-http-client`
- `ethers` (version 6)

---

## IPFS Setup 🔗

```bash
# Install IPFS (Windows PowerShell as Administrator)
iex ((New-Object System.Net.WebClient).DownloadString('https://dist.ipfs.tech/go-ipfs/v0.12.0/install.ps1'))

# Initialize IPFS
ipfs init

# Configure CORS
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin "[\"*\"]"
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods "[\"PUT\",\"GET\",\"POST\"]"
```

## Running the Game 🎮

1. Start IPFS daemon:
```bash
ipfs daemon
```

2. Start local blockchain:
```bash
npx hardhat node
```

3. Deploy contracts:
```bash
npx hardhat run scripts/deploy.js --network localhost
```

## Useful Commands ⚙️

```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy with Ignition
npx hardhat ignition deploy ignition/modules/LiarsToken.js --network localhost
```

## Tests 🧪

```bash
# Run all tests
npm test

# Run specific test files
npm test test/Token.js
npm test test/Ipfs.js
npm test test/Lobby.js
```

### IPFS Test Structure
```javascript
{
    "playerAddress": "0x123...",
    "lobbyAddress": "0x456...",
    "cards": ["K♠", "K♥"],
    "timestamp": "2024-02-20T12:34:56.789Z",
    "turn": 1,
    "moveHash": "0x789..."
}
```

## Deployment 📤

### Smart Contract Deployment

Using Hardhat Ignition:
```javascript
const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("LiarsTokenModule", (m) => {
    const liarsToken = m.contract("LiarsToken", [], {
        gasLimit: 5000000,
        from: m.deployer,
    });
    return { liarsToken };
});
```

Using deployment script:
```javascript
const main = async () => {
    const LiarsToken = await ethers.getContractFactory("LiarsToken");
    const token = await LiarsToken.deploy();
    await token.deployed();
    console.log("LiarsToken deployed to:", await token.getAddress());
};

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

If you have any questions or suggestions, please open an issue on GitHub.

---