const { getIPFSNode } = require('./deploy-ipfs');

// Ajoute un fichier à IPFS
async function addFile(path, content) {
  const ipfs = getIPFSNode();
  if (!ipfs) {
    throw new Error('IPFS node is not running');
  }

  const file = { path, content };
  const result = await ipfs.add(file);
  console.log('Added file:', result.path, result.cid.toString());
  return result;
}

// récupère le fichier IPFS
async function getFile(cid) {
  const ipfs = getIPFSNode();
  if (!ipfs) {
    throw new Error('IPFS node is not running');
  }

  const fileBuffer = await ipfs.cat(cid);
  let content = '';
  for await (const chunk of fileBuffer) {
    content += chunk.toString();
  }
  console.log('File content:', content);
  return content;
}

module.exports = {
  addFile,
  getFile
};
