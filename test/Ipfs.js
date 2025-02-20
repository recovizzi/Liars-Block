import { expect } from 'chai';
import ipfsOperation from '../scripts/IpfsFileOperation.js';

describe("IPFS Storage Tests", function() {
    let deploymentInfo; // objet de simulation de données de déploiement

    before(async function() {
        deploymentInfo = {
            network: "hardhat",
            contracts: {
                LiarsToken: "0x...",
                LiarsGameManager: "0x...",
            },
            timestamp: new Date().toISOString()
        };
    });

    it("Should save and retrieve deployment info", async function() {
        // Save to IPFS
        const cid = await ipfsOperation.saveDeploymentInfo(deploymentInfo);
        
        // Retrieve from IPFS
        const retrieved = await ipfsOperation.getDeploymentInfo();
        
        // Verify data
        expect(retrieved.network).to.equal(deploymentInfo.network);
        expect(retrieved.contracts.LiarsToken).to.equal(deploymentInfo.contracts.LiarsToken);
    });
});