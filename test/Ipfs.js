import { expect } from 'chai';
import ipfsOperation from '../scripts/IpfsFileOperation.js';

describe("IPFS Game Verification Tests", function() {
    describe("Move Verification", function() {
        it("Should store and verify a player's move", async function() {
            const gameMove = {
                playerAddress: "0x123...",
                lobbyId: "1",
                turn: 1,
                cards: ["K♠", "K♥"],
                claimedCards: "2 Kings", // Ce que le joueur annonce
                timestamp: new Date().toISOString()
            };

            // Sauvegarde du coup sur IPFS
            const cid = await ipfsOperation.storeMove(gameMove);
            
            // Récupération pour vérification
            const storedMove = await ipfsOperation.getMove(cid);
            
            expect(storedMove.cards).to.deep.equal(gameMove.cards);
            expect(storedMove.claimedCards).to.equal(gameMove.claimedCards);
        });

        it("Should detect a lie when challenged", async function() {
            const gameMove = {
                playerAddress: "0x123...",
                lobbyId: "1",
                turn: 1,
                cards: ["Q♠", "Q♥"],      // Les vraies cartes jouées
                claimedCards: "2 Kings",   // Ce que le joueur a annoncé
                timestamp: new Date().toISOString()
            };

            const cid = await ipfsOperation.storeMove(gameMove);
            
            // Vérification lors d'un challenge "Liar"
            const verification = await ipfsOperation.verifyLie(cid);
            
            expect(verification.isLying).to.be.true;
            expect(verification.actualCards).to.deep.equal(gameMove.cards);
            expect(verification.claimedCards).to.equal(gameMove.claimedCards);
        });

        it("Should confirm truth when challenged wrongly", async function() {
            const gameMove = {
                playerAddress: "0x123...",
                lobbyId: "1",
                turn: 1,
                cards: ["K♠", "K♥"],      // Les vraies cartes correspondent
                claimedCards: "2 Kings",   // à ce qui a été annoncé
                timestamp: new Date().toISOString()
            };

            const cid = await ipfsOperation.storeMove(gameMove);
            
            // Vérification lors d'un challenge "Liar"
            const verification = await ipfsOperation.verifyLie(cid);
            
            expect(verification.isLying).to.be.false;
            expect(verification.actualCards).to.deep.equal(gameMove.cards);
        });
    });
});