// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

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
     * @dev Constructor initializes the lobby with an initial set of players.
     * @param _players The addresses of players who joined the lobby.
     */
    constructor(address[] memory _players) {
        require(_players.length > 1, "At least 2 players required");
        players = _players;
        state = LobbyState.Waiting;
        currentTurnIndex = 0;
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
     * In a complete implementation, tokens would be transferred from the player to the contract.
     * @param amount The amount of tokens to stake.
     */
    function depositStake(uint256 amount) external {
        require(state == LobbyState.Waiting || state == LobbyState.InGame, "Game is not active");
        // Record the stake (token transfer logic should be integrated in a full version)
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
        for (uint i = 1; i < players.length; i++) {
            if (roundsLost[players[i]] < minLoss) {
                minLoss = roundsLost[players[i]];
                winner = players[i];
            }
        }
        uint256 totalPot = 0;
        for (uint i = 0; i < players.length; i++) {
            totalPot += stakes[players[i]];
        }
        emit RewardsDistributed(winner, totalPot);
        state = LobbyState.Ended;
        // In a full implementation, token transfers would send the rewards to the winner.
    }

    /**
     * @dev Emergency withdrawal to reset stakes in critical situations.
     * Only callable by the contract owner.
     */
    function emergencyWithdraw() external onlyOwner {
        for (uint i = 0; i < players.length; i++) {
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
}

}
