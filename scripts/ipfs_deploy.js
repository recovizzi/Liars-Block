const IPFS = require('ipfs');

async function startIPFSNode() {
  try {
    // Crée un nœud IPFS
    const node = await IPFS.create();

    // Affiche l'ID du nœud
    const id = await node.id();
    console.log('IPFS Node ID:', id.id);

    // Ajoute un fichier test hello.txt au nœud IPFS
    const file = {
      path: 'hello.txt',
      content: 'Hello, IPFS!'
    };

    const addedFile = await node.add(file);
    console.log('Added file:', addedFile.path, addedFile.cid.toString());

    // Récupère le fichier ajouté
    const fileBuffer = await node.cat(addedFile.cid);
    for await (const chunk of fileBuffer) {
      console.log('File content:', chunk.toString());
    }

    // Arrête le nœud IPFS
    await node.stop();
    console.log('IPFS Node stopped');
  } catch (error) {
    console.error('Error starting IPFS node:', error);
  }
}

startIPFSNode();

// pour exécuter le script
// $ node deploy-ipfs.js
