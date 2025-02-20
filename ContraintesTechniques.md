 # Contraintes techniques et fonctionnelles

    La blockchain choisie est Ethereum. Solidity ayant été abordé en cours et plus simple d'utilisation comparé à Rust, le choix s'est donc porté sur Ethereum.

- **Blockchain**: Ethereum
- **Language**: Solidity
- **Framework**: Hardhat
- **Storage**: IPFS
- **Tests**: Hardhat & Chai

## 1. Tokenisation des ressources
  
Deux types de tokens sont utilisés : les tokens classiques pour lancer les parties et les tokens VIP.

**LiarsToken (ERC-20)**
Le token ERC-20 sert de monnaie dans le jeu avec les caractéristiques suivantes :

- Utilisé pour les mises et récompenses
- Transferts contrôlés avec de la sécurité

## 2. Échanges de tokens

Deux mécanismes d'échanges : les achats de tokens standards et les échanges de transactions des tokens.

Les règles existantes comprennent :

- Limite maximum de tokens par compte (50000)
- Tokens VIP non transférables
- Vérification du statut VIP pour certaines opérations
- Période de cooldown pour les claims VIP (10 minutes)

## 3. Limites de possession

Les joueurs sont limités à une mise de 1000 tokens par partie. et ne peut être présent que dans une seule partie à la fois.

### Tours de Jeu
- 2 minutes maximum par tour
- 30 secondes pour contester la (les) cartes jouées
- Cooldown de 1 minute entre les parties

### Lobbies
- Durée maximale d'une partie: 30 minutes
- Temps minimum avant fermeture: 5 minutes
- Délai de réclamation des gains: 24 heures

## 4. Contraintes temporelles

Pour rappel, la demande de token VIP par les joueurs VIP sont limitées dans le temps à 10 minutes.

Les limites temporelles sont strictement définies :

- Tour par joueur : 2 minutes maximum en tour par tour
- Contestations : 30 secondes
- Cooldown entre parties : 1 minute

## 5. Utilisation d’IPFS

Utilisation d'IPFS pour stocker le json des cartes jouées.
IPFS stocke l'addresse du lobby, les cartes jouées par les joueurs et les id des joueurs

## 6. Tests unitaires avec Hardhat ou Anchor

### Couverture de Tests
- Tests unitaires: >90%
- Tests d'intégration
- Tests de charge

