// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LiarsLobby is Ownable {
    // Ajouter la constante pour la limite de mise
    uint256 public constant MAX_STAKE = 1000 * 1e18;  // 1000 tokens avec 18 décimales

    // Ajouter l'événement pour la défaite
    event PlayerDefeated(address indexed player, uint256 stakeLost);

    // Define possible states for a lobby.
    enum LobbyState { Waiting, InGame, Ended }
    LobbyState public state;

    // Ajout des nouvelles énumérations et variables d'état
    enum RoundPhase { Distribution, Gameplay }
    RoundPhase public currentRoundPhase;
    
    uint8[] private deck;
    mapping(address => uint8[5]) private playerHands;
    mapping(address => bytes32) private handCommitments;
    mapping(address => bytes32) private playerKeyHashes;

    // Array of players in the lobby.
    address[] public players;

    // Index to track whose turn it is.
    uint256 public currentTurnIndex;

    // Game reference: e.g., the card type chosen at the start of the game.
    bytes32 public gameReference;

    // Variables to manage move submission.
    bytes32 public lastMoveHash;
    address public lastMover;

    // Mapping to record how many rounds each player has lost (for penalty logic).
    mapping(address => uint256) public roundsLost;

    // Mapping to record stakes deposited by each player.
    mapping(address => uint256) public stakes;

    // Ajouter avec les autres variables d'état
    mapping(address => string) public playerLastMoveCID;
    mapping(address => bool) public predictions;
    address public lastChallenger;

    // Address of the LiarsToken contract.
    IERC20 public liarsToken;

    // EVENTS
    event GameStarted(bytes32 gameReference);
    event StakeDeposited(address indexed player, uint256 amount);
    event MoveSubmitted(address indexed player, bytes32 moveHash);
    event MoveChallenged(address challenger, address challenged);
    event MoveRevealed(address revealer, bool isValid);
    event PenaltyExecuted(address player, bool eliminated);
    event RewardsDistributed(address winner, uint256 rewardAmount);
    event GameStateUpdated(bytes32 ipfsHash);
    event EmergencyWithdrawal();
    event PlayerJoined(address indexed player);
    event PlayerLeft(address indexed player);

    // Ajouter un événement pour la roulette russe
    event RussianRouletteResult(address player, uint256 chamberNumber, bool survived);

    // Ajout des nouveaux événements
    event HandDistributed(address indexed player, bytes32 commitment);
    event RoundPhaseAdvanced(RoundPhase newPhase);

    // Ajouter avec les autres variables d'état au début du contrat
    uint256 public constant TURN_TIMEOUT = 5 minutes;
    uint256 public turnStartTimestamp;
    mapping(address => bool) public eliminated;

    // Ajouter avec les autres events
    event PlayerTimedOut(address indexed player);

    /**
     * @dev Constructor becomes empty since we'll use initialize for clones
     */
    constructor() Ownable(msg.sender) {}


    // Ajouter avec les autres fonctions
    function submitMove(bytes32 encryptedMoveHash, string calldata ipfsCID) external {
        require(state == LobbyState.InGame, "Game is not in progress");
        require(msg.sender == players[currentTurnIndex], "Not your turn");
        
        lastMoveHash = encryptedMoveHash;
        lastMover = msg.sender;
        playerLastMoveCID[msg.sender] = ipfsCID;
        
        emit MoveSubmitted(msg.sender, encryptedMoveHash);
        currentTurnIndex = (currentTurnIndex + 1) % players.length;
    }

    function challengeMove(bool isLiar) external {
        require(state == LobbyState.InGame, "Game is not in progress");
        require(msg.sender != lastMover, "Cannot challenge your own move");
        require(bytes(playerLastMoveCID[lastMover]).length > 0, "No move to challenge");
        
        predictions[msg.sender] = isLiar;
        lastChallenger = msg.sender;
        
        emit MoveChallenged(msg.sender, lastMover);
    }


    /**
     * @dev Initialization function for clones
     */
    function initialize(address[] memory _players, address _liarsToken) external {
        require(address(liarsToken) == address(0), "Already initialized");
        if (_players.length > 0) {
            require(_players.length > 1, "At least 2 players required");
            players = _players;
        }
        state = LobbyState.Waiting;
        currentTurnIndex = 0;
        liarsToken = IERC20(_liarsToken);
        _initializeDeck();
        currentRoundPhase = RoundPhase.Distribution;
    }

    function registerPlayerKey(bytes32 keyHash) external {
        require(playerKeyHashes[msg.sender] == 0, "Key already registered");
        bool isPlayer = false;
        for (uint i = 0; i < players.length; i++) {
            if (players[i] == msg.sender) {
                isPlayer = true;
                break;
            }
        }
        require(isPlayer, "Not a player");
        playerKeyHashes[msg.sender] = keyHash;
    }

    function requestHand(string memory secret) external {
        require(playerKeyHashes[msg.sender] != 0, "Player key not registered");
        require(currentRoundPhase == RoundPhase.Distribution, "Not in distribution phase");
        require(handCommitments[msg.sender] == 0, "Hand already requested");
        require(keccak256(abi.encodePacked(secret)) == playerKeyHashes[msg.sender], "Invalid secret");
        
        uint8[5] memory hand = _drawCards(5);
        bytes32 commitment = keccak256(abi.encodePacked(hand, secret));
        
        playerHands[msg.sender] = hand;
        handCommitments[msg.sender] = commitment;
        
        emit HandDistributed(msg.sender, commitment);
        
        if(_allHandsDistributed()) {
            currentRoundPhase = RoundPhase.Gameplay;
            emit RoundPhaseAdvanced(currentRoundPhase);
        }
    }

    function getMyHand(string memory secret) external view returns (uint8[5] memory) {
        require(handCommitments[msg.sender] != 0, "Hand not distributed");
        require(keccak256(abi.encodePacked(secret)) == playerKeyHashes[msg.sender], "Invalid secret");
        return playerHands[msg.sender];
    }

    function _drawCards(uint256 count) internal returns (uint8[5] memory) {
        require(deck.length >= count, "Not enough cards left");
        uint8[5] memory hand;
        for (uint256 i = 0; i < count; i++) {
            uint256 randIndex = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, i))) % deck.length;
            hand[i] = deck[randIndex];
            deck[randIndex] = deck[deck.length - 1];
            deck.pop();
        }
        return hand;
    }

    function _initializeDeck() internal {
        // Initialisation avec 6 As (1), 6 Rois (2), 6 Reines (3) et 2 Jokers (4)
        for (uint8 i = 0; i < 6; i++) {
            deck.push(1); // As
            deck.push(2); // Roi
            deck.push(3); // Reine
        }
        deck.push(4); // Joker
        deck.push(4); // Joker
    }

    function _allHandsDistributed() internal view returns (bool) {
        for (uint256 i = 0; i < players.length; i++) {
            if (handCommitments[players[i]] == 0) {
                return false;
            }
        }
        return true;
    }

    /**
     * @dev Starts the game. Can be called once the required number of players has joined.
     * It changes the state to InGame and initializes the game reference (e.g. card type).
     */
    function startGame() external {
        require(state == LobbyState.Waiting, "Game already started");
        require(players.length >= 2, "Not enough players to start");
        state = LobbyState.InGame;
        // Initialize gameReference with pseudo-randomness (for v1, not secure)
        gameReference = keccak256(abi.encodePacked(block.timestamp, players));
        emit GameStarted(gameReference);
    }

    /**
     * @dev Allows a player to deposit their stake.
     * @param amount The amount of tokens to stake.
     */
    function depositStake(uint256 amount) external {
        require(state == LobbyState.Waiting || state == LobbyState.InGame, "Game is not active");
        require(amount <= MAX_STAKE, "Stake exceeds maximum limit");  // Ajout de la vérification
        require(liarsToken.transferFrom(msg.sender, address(this), amount), "Token transfer failed");
        stakes[msg.sender] += amount;
        emit StakeDeposited(msg.sender, amount);
    }

    /**
     * @dev Returns the address of the player whose turn it is.
     */
    function getCurrentTurn() external view returns (address) {
        require(state == LobbyState.InGame, "Game is not in progress");
        return players[currentTurnIndex];
    }

    /**
     * @dev Returns the list of players in the lobby.
     */
    function getPlayerList() external view returns (address[] memory) {
        return players;
    }

    /**
     * @dev Allows the current player to submit a move.
     * The move is submitted as an encrypted hash (e.g., a commit in a commit–reveal scheme).
     * After submission, the turn advances to the next player.
     * @param encryptedMoveHash The hash representing the player's move.
     */
    function submitMove(bytes32 encryptedMoveHash) external {
        require(state == LobbyState.InGame, "Game is not in progress");
        require(msg.sender == players[currentTurnIndex], "Not your turn");
        lastMoveHash = encryptedMoveHash;
        lastMover = msg.sender;
        emit MoveSubmitted(msg.sender, encryptedMoveHash);
        // Advance turn index in a circular fashion
        currentTurnIndex = (currentTurnIndex + 1) % players.length;
    }

    /**
     * @dev Allows any player (other than the one who submitted the move) to challenge the previous move.
     * This function emits an event; further off-chain or on-chain logic will handle the challenge.
     */
    function challengeMove() external {
        require(state == LobbyState.InGame, "Game is not in progress");
        require(msg.sender != lastMover, "Cannot challenge your own move");
        emit MoveChallenged(msg.sender, lastMover);
        // Additional logic for challenge resolution should be added in a full implementation.
    }

    /**
     * @dev Reveals the previously submitted move and handles the Russian Roulette mechanic if the move is invalid
     * @param revealedData The data that was previously committed.
     */
    function revealMove(bytes memory revealedData) external {
        require(state == LobbyState.InGame, "Game is not in progress");
        bytes32 computedHash = keccak256(revealedData);
        bool isValid = (computedHash == lastMoveHash);
        emit MoveRevealed(msg.sender, isValid);
        
        if (!isValid) {
            // Increment lost rounds counter
            roundsLost[lastMover] += 1;
            
            // Russian Roulette mechanic
            // Generate a pseudo-random number between 1 and 6 (representing chambers)
            uint256 chamberNumber = uint256(
                keccak256(
                    abi.encodePacked(
                        block.timestamp,
                        block.prevrandao,
                        lastMover,
                        roundsLost[lastMover]
                    )
                )
            ) % 6 + 1; // 1 to 6
            
            // The player survives if the chamber number is greater than (6 - rounds lost)
            // More rounds lost = more dangerous
            bool survived = chamberNumber > (6 - roundsLost[lastMover]);
            
            emit RussianRouletteResult(lastMover, chamberNumber, survived);
            
            // If the player doesn't survive, they are eliminated
            if (!survived) {
                uint256 stake = stakes[lastMover];
                stakes[lastMover] = 0;
                emit PlayerDefeated(lastMover, stake);
                // Remove the player from the game
                _removePlayer(lastMover);
            }
        }
        
        // Reset the last move data
        lastMoveHash = 0;
        lastMover = address(0);
    }

    /**
     * @dev Internal function to remove a player from the game
     */
    function _removePlayer(address player) internal {
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i] == player) {
                players[i] = players[players.length - 1];
                players.pop();
                break;
            }
        }
    }

    /**
     * @dev Executes the penalty on a player based on the number of rounds lost.
     * For this v1, if a player has lost 3 or more rounds, they are considered eliminated.
     * @param player The address of the player to penalize.
     */
    function executePenalty(address player) external {
        uint256 lostRounds = roundsLost[player];
        require(lostRounds > 0, "No penalty to execute");
        bool eliminated = lostRounds >= 3; // Example threshold
        emit PenaltyExecuted(player, eliminated);
        // In a full implementation, elimination logic (e.g. removal from the players array) would be added.
    }

    /**
     * @dev Distributes the rewards to the winner(s) at the end of the game.
     * For this v1, the winner is determined as the player with the fewest rounds lost.
     */
    function distributeRewards() external {
        require(state == LobbyState.InGame, "Game is not in progress");
        address winner = players[0];
        uint256 minLoss = roundsLost[winner];
        for (uint256 i = 1; i < players.length; i++) {
            if (roundsLost[players[i]] < minLoss) {
                minLoss = roundsLost[players[i]];
                winner = players[i];
            }
        }
        uint256 totalPot = 0;
        for (uint256 i = 0; i < players.length; i++) {
            totalPot += stakes[players[i]];
        }
        require(liarsToken.transfer(winner, totalPot), "Token transfer failed");
        emit RewardsDistributed(winner, totalPot);
        state = LobbyState.Ended;
    }

    /**
     * @dev Emergency withdrawal to reset stakes in critical situations.
     * Only callable by the contract owner.
     */
    function emergencyWithdraw() external onlyOwner {
        for (uint256 i = 0; i < players.length; i++) {
            stakes[players[i]] = 0;
        }
        state = LobbyState.Ended;
        emit EmergencyWithdrawal();
    }

    /**
     * @dev Updates the game state by recording an IPFS hash of off-chain data.
     * This can be used to log a detailed history of moves or game state.
     * @param ipfsHash The IPFS hash representing the current game state.
     */
    function updateGameState(bytes32 ipfsHash) external {
        emit GameStateUpdated(ipfsHash);
    }

    /**
     * @dev Allows a player to join the lobby.
     * @param player The address of the player joining the lobby.
     */
    function joinLobby(address player) external {
        require(state == LobbyState.Waiting, "Game already started");
        require(!includes(player), "Player already in lobby");
        players.push(player);
        emit PlayerJoined(player);
    }

    /**
     * @dev Allows a player to leave the lobby.
     * @param player The address of the player leaving the lobby.
     */
    function leaveLobby(address player) external {
        require(includes(player), "Player not in lobby");
        
        // Remove player from the players array
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i] == player) {
                players[i] = players[players.length - 1];
                players.pop();
                break;
            }
        }

        uint256 stake = stakes[player];
        stakes[player] = 0;

        if (state == LobbyState.Waiting) {
            // Si le jeu n'a pas commencé, remboursement de la mise
            if (stake > 0) {
                require(liarsToken.transfer(player, stake), "Token transfer failed");
            }
        } else {
            // Si le jeu a commencé, le joueur perd sa mise
            if (stake > 0) {
                emit PlayerDefeated(player, stake);
                // La mise reste dans le pot pour les autres joueurs
            }
        }
        
        emit PlayerLeft(player);
    }

    // Add helper function for includes check
    function includes(address player) private view returns (bool) {
        for (uint i = 0; i < players.length; i++) {
            if (players[i] == player) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Handles the timeout of a player's turn
     * @param player The address of the player who timed out
     */
    function handleTimeout(address player) external {
        require(state == LobbyState.InGame, "Game not in progress");
        require(!eliminated[player], "Player already eliminated");
        require(player == players[currentTurnIndex], "Not player's turn");
        require(block.timestamp > turnStartTimestamp + TURN_TIMEOUT, "Turn not timed out");
        
        eliminated[player] = true;
        uint256 playerStake = stakes[player];
        stakes[player] = 0;
        
        emit PlayerTimedOut(player);
        emit PlayerDefeated(player, playerStake);
        
        _removePlayer(player);
        
        // Check if only one player remains
        if (players.length == 1) {
            // Game ends when only one player remains
            // distributeRewards();
        } else {
            // Advance to next player
            currentTurnIndex = currentTurnIndex % players.length;
        }
    }
}
