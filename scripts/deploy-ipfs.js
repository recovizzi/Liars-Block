const IPFS = require('ipfs');

let ipfsNode;

// Start le noeud IPFS
async function startIPFSNode() {
    try {
        // Crée un nœud IPFS
        ipfsNode = await IPFS.create();

        // Affiche l'ID du nœud et son status
        const id = await ipfsNode.id();
        console.log('IPFS Node ID:', id.id);
        console.log('IPFS Node started with ID:', id.id);
    } catch (error) {
        console.error('Error starting IPFS node:', error);
    }
}
// Arrête le nœud IPFS
async function stopIPFSNode() {
    if (ipfsNode) {
        await ipfsNode.stop();
        console.log('IPFS Node stopped');
    }
    }
    
    module.exports = {
        startIPFSNode,
        stopIPFSNode,
        getIPFSNode: () => ipfsNode
    };

// pour exécuter le script
// $ node deploy-ipfs.js
