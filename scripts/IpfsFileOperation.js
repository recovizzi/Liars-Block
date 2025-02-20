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

      // Ajouter après les méthodes existantes
      async saveGameMove(moveInfo) {
        try {
            const moveData = {
                playerAddress: moveInfo.playerAddress,
                lobbyAddress: moveInfo.lobbyAddress,
                cards: moveInfo.cards,
                timestamp: new Date().toISOString(),
                turn: moveInfo.turn,
                moveHash: moveInfo.moveHash
            };

            const result = await this.ipfs.add(JSON.stringify(moveData));
            return result.cid.toString();
        } catch (error) {
            console.error('Error saving game move:', error);
            throw error;
        }
    }

    async verifyMove(cid, challengedMove) {
      try {
          const moveData = await this.getFromIPFS(cid);
          
          // Compare claimed cards with actual cards
          const isValid = JSON.stringify(moveData.cards) === JSON.stringify(challengedMove.claimedCards);
          
          return {
              isValid: isValid,
              cards: moveData.cards,
              playerAddress: moveData.playerAddress
          };
      } catch (error) {
          console.error('Error verifying move:', error);
          throw error;
      }
  }

  async storeMove(gameMove) {
    try {
        const result = await this.ipfs.add(JSON.stringify(gameMove));
        return result.cid.toString();
    } catch (error) {
        console.error('Error storing move:', error);
        throw error;
    }
}

async getMove(cid) {
    try {
        const chunks = [];
        for await (const chunk of this.ipfs.cat(cid)) {
            chunks.push(chunk);
        }
        return JSON.parse(Buffer.concat(chunks).toString());
    } catch (error) {
        console.error('Error getting move:', error);
        throw error;
    }
}

async verifyLie(cid) {
  try {
      const move = await this.getMove(cid);
      
      // Extraire le nombre et le type de cartes annoncées
      const [count, cardType] = move.claimedCards.split(' ');
      
      // Vérifier si le nombre de cartes correspond
      const actualCount = move.cards.length;
      if (actualCount !== parseInt(count)) {
          return {
              isLying: true,
              actualCards: move.cards,
              claimedCards: move.claimedCards,
              timestamp: move.timestamp,
              reason: "Incorrect card count"
          };
      }

      // Vérifier si toutes les cartes sont du type annoncé
      const cardTypeChar = cardType.charAt(0); // 'K' pour Kings
      const allCardsMatch = move.cards.every(card => 
          card.charAt(0) === cardTypeChar
      );

      return {
          isLying: !allCardsMatch,
          actualCards: move.cards,
          claimedCards: move.claimedCards,
          timestamp: move.timestamp,
          reason: allCardsMatch ? "Truth" : "Wrong card type"
      };
  } catch (error) {
      console.error('Error verifying lie:', error);
      throw error;
  }
}
    
}

// Export single instance
const ipfsOperation = new IpfsFileOperation();
export default ipfsOperation;