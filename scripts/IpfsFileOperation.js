import { create } from 'ipfs-http-client';
import fs from 'fs/promises';
import path from 'path';

class IpfsFileOperation {
    constructor() {
        this.ipfs = create({
            host: 'localhost',
            port: 5001,
            protocol: 'http'
        });
    }

    // Add file or data to IPFS
    async addToIPFS(content) {
        try {
            const result = await this.ipfs.add(JSON.stringify(content));
            return result.cid.toString();
        } catch (error) {
            console.error('Error adding to IPFS:', error);
            throw error;
        }
    }

    // Get file or data from IPFS
    async getFromIPFS(cid) {
        try {
            const chunks = [];
            for await (const chunk of this.ipfs.cat(cid)) {
                chunks.push(chunk);
            }
            return JSON.parse(Buffer.concat(chunks).toString());
        } catch (error) {
            console.error('Error getting from IPFS:', error);
            throw error;
        }
    }

    // Save deployment info to IPFS and local file
    async saveDeploymentInfo(deploymentInfo) {
        try {
            // Save to IPFS
            const cid = await this.addToIPFS(deploymentInfo);

            // Create record with IPFS reference
            const record = {
                cid,
                timestamp: new Date().toISOString(),
                network: deploymentInfo.network
            };

            // Save record locally
            await fs.writeFile(
                path.join(process.cwd(), 'deployment-ipfs-record.json'),
                JSON.stringify(record, null, 2)
            );

            return cid;
        } catch (error) {
            console.error('Error saving deployment info:', error);
            throw error;
        }
    }

    // Get deployment info from local record and IPFS
    async getDeploymentInfo() {
        try {
            const recordPath = path.join(process.cwd(), 'deployment-ipfs-record.json');
            const record = JSON.parse(await fs.readFile(recordPath, 'utf8'));
            return await this.getFromIPFS(record.cid);
        } catch (error) {
            console.error('Error getting deployment info:', error);
            throw error;
        }
    }
}

// Export single instance
const ipfsOperation = new IpfsFileOperation();
export default ipfsOperation;