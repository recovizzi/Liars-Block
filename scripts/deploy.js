const { ignition } = require("hardhat");

async function main() {
  // Déploiement du module LiarsTokenModule.
  // Remarque : ici nous importons le module depuis le chemin relatif.
  const { liarsToken } = await ignition.deploy(require("../ignition/modules/LiarsTokenModule"));

  // Récupérer l'adresse du contrat déployé avec ethers v6 : utilisez getAddress()
  const deployedAddress = await liarsToken.getAddress();
  console.log("LiarsToken deployed to:", deployedAddress);

  // Récupérer et afficher quelques informations post-déploiement.
  const totalSupply = await liarsToken.totalSupply();
  console.log("Initial total supply:", totalSupply.toString());

  const owner = await liarsToken.owner();
  console.log("Contract owner:", owner);

  // Par exemple, récupérer le solde du contrat lui-même (pour comparer avec totalSupply si nécessaire)
  const contractBalance = await liarsToken.balanceOf(deployedAddress);
  console.log("Contract balance:", contractBalance.toString());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
