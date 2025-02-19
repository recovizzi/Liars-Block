const IPFS = require('ipfs');
const fs = require('fs');
const path = require('path');

async function testIPFSTransfer() {
  try {
    // Crée un nœud IPFS
    const ipfs = await IPFS.create();

    // Chemin vers le fichier à ajouter
    const filePath = path.resolve(__dirname, 'test-file.txt');

    // Lis le contenu du fichier
    const fileContent = fs.readFileSync(filePath);

    // Ajoute le fichier à IPFS
    const result = await ipfs.add({
      path: 'test-file.txt',
      content: fileContent
    });

    console.log('File added to IPFS with CID:', result.cid.toString());

    // Récupère le fichier depuis IPFS
    const fileBuffer = await ipfs.cat(result.cid);
    let content = '';
    for await (const chunk of fileBuffer) {
      content += chunk.toString();
    }

    console.log('File content retrieved from IPFS:', content);

    // Arrête le nœud IPFS
    await ipfs.stop();
    console.log('IPFS Node stopped');
  } catch (error) {
    console.error('Error during IPFS transfer test:', error);
  }
}

testIPFSTransfer();
