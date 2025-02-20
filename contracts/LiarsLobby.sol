// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LiarsLobby is Ownable {
    // Define possible states for a lobby.
    enum LobbyState { Waiting, InGame, Ended }
    LobbyState public state;

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
     * @dev Reveals the previously submitted move to verify its validity.
     * Compares the hash of the revealed data with the stored move hash.
     * If invalid, increments the loss count for the mover.
     * @param revealedData The data that was previously committed.
     */
    function revealMove(bytes memory revealedData) external {
        require(state == LobbyState.InGame, "Game is not in progress");
        bytes32 computedHash = keccak256(revealedData);
        bool isValid = (computedHash == lastMoveHash);
        emit MoveRevealed(msg.sender, isValid);
        if (!isValid) {
            roundsLost[lastMover] += 1;
        }
        // Reset the last move data
        lastMoveHash = 0;
        lastMover = address(0);
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
    }

    /**
     * @dev Allows a player to leave the lobby.
     * @param player The address of the player leaving the lobby.
     */
    function leaveLobby(address player) external {
        require(state == LobbyState.Waiting, "Game already started");
        require(includes(player), "Player not in lobby");
        // Remove player from the players array
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i] == player) {
                players[i] = players[players.length - 1];
                players.pop();
                break;
            }
        }
        // Return stake to the player
        uint256 stake = stakes[player];
        require(liarsToken.transfer(player, stake), "Token transfer failed");
        stakes[player] = 0;
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
}
