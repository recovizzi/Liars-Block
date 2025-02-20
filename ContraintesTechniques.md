 # Contraintes techniques et fonctionnelles

Vous pourrez choisir la blockchain de votre choix, Ethereum ou Solana.

## 1. Tokenisation des ressources
Les ressources manipulées doivent être représentées sous forme de tokens ayant différents niveaux (par exemple : catégories comme "maison", "gare", "hôtel" dans le Monopoly).

## 2. Échanges de tokens

    Implémentation d'un mécanisme d'échange de tokens entre utilisateurs.
    Définition de règles précises pour valider les transactions (par exemple, conversion entre types de tokens).

## 3. Limites de possession

    Chaque utilisateur ne peut posséder qu'un nombre limité de ressources (par exemple, maximum de 4 ressources).

## 4. Contraintes temporelles

    Cooldown d'un délai défini (exemple : 5 minutes) entre deux transactions successives par un utilisateur.
    Lock temporaire après une action critique (exemple : 10 minutes après une acquisition).

## 5. Utilisation d’IPFS

    Les métadonnées des ressources (comme des documents numériques ou des images) doivent être stockées sur IPFS.

## 6. Tests unitaires avec Hardhat ou Anchor

    L'ensemble des smart contracts doit être testé avec une couverture de tests significative à l’aide de Hardhat.