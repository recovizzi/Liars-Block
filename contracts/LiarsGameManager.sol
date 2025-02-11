// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./LiarsLobby.sol";

contract LiarsGameManager is Ownable {
    constructor() Ownable(msg.sender) {}

    uint8 private constant MIN_PLAYERS = 2;
    uint8 private constant MAX_PLAYERS = 4;

    enum LobbyState { Waiting, InGame, Closed }

    struct Lobby {
        uint256 id;
        address[] players;
        LobbyState state;
        bytes32 codeHash;
        uint256 createdAt;
        uint8 maxPlayers;
        uint256 stake;
        address lobbyContract; // Address of the LiarsLobby contract
    }

    uint256 public lobbyCount;
    mapping(uint256 => Lobby) public lobbies;
    mapping(bytes32 => uint256) private codeHashToLobbyId;
    mapping(uint256 => mapping(address => bool)) private playerInLobby;
    IERC20 public liarsToken;
    Clones public clones;

    // Events
    event LobbyCreated(uint256 indexed lobbyId, bytes32 codeHash, address indexed lobbyContract);
    event PlayerJoined(uint256 indexed lobbyId, address indexed player, bytes32 codeHash);
    event PlayerLeft(uint256 indexed lobbyId, address indexed player);
    event GameStarted(uint256 indexed lobbyId);
    event StakeSet(uint256 indexed lobbyId, uint256 stake);
    event RewardsDistributed(uint256 indexed lobbyId, address indexed winner, uint256 rewardAmount);

    // Modifiers
    modifier validLobbyId(uint256 lobbyId) {
        require(lobbies[lobbyId].id != 0, "Lobby does not exist");
        _;
    }

    modifier lobbyInState(uint256 lobbyId, LobbyState state) {
        require(lobbies[lobbyId].state == state, "Invalid lobby state");
        _;
    }

    /**
     * @dev Sets the LiarsToken contract address
     */
    function setLiarsToken(address _liarsToken) external onlyOwner {
        liarsToken = IERC20(_liarsToken);
    }

    /**
     * @dev Sets the implementation address for clones
     */
    function setImplementation(address _implementation) external onlyOwner {
        clones.setImplementation(_implementation);
    }

    /**
     * @dev Public function to create a new lobby
     */
    function createPublicLobby(string calldata code, uint8 maxPlayers, uint256 stake) external returns (uint256) {
        return _createLobby(code, maxPlayers, stake);
    }

    /**
     * @dev Internal function to create a new lobby
     */
    function _createLobby(string memory code, uint8 maxPlayers, uint256 stake) internal returns (uint256) {
        require(maxPlayers >= MIN_PLAYERS && maxPlayers <= MAX_PLAYERS, "Invalid player count");
        require(bytes(code).length > 0, "Code cannot be empty");
        require(stake > 0, "Stake must be greater than zero");

        bytes32 codeHash = keccak256(abi.encodePacked(code));
        require(codeHashToLobbyId[codeHash] == 0, "Code already in use");

        lobbyCount++;
        uint256 lobbyId = lobbyCount;

        Lobby storage newLobby = lobbies[lobbyId];
        newLobby.id = lobbyId;
        newLobby.state = LobbyState.Waiting;
        newLobby.codeHash = codeHash;
        newLobby.createdAt = block.timestamp;
        newLobby.maxPlayers = maxPlayers;
        newLobby.stake = stake;

        // Deploy a new LiarsLobby contract using clones
        address lobbyContract = clones.createClone(lobbyId);
        newLobby.lobbyContract = lobbyContract;

        codeHashToLobbyId[codeHash] = lobbyId;

        emit LobbyCreated(lobbyId, codeHash, lobbyContract);
        emit StakeSet(lobbyId, stake);
        return lobbyId;
    }

    /**
     * @dev Joins a lobby by code or redirects to a random lobby if code is invalid or lobby is full
     * @param code The code of the lobby to join
     */
    function joinLobbyByCode(string calldata code) external {
        bytes32 codeHash = keccak256(abi.encodePacked(code));
        uint256 lobbyId = codeHashToLobbyId[codeHash];

        if (lobbyId == 0 || lobbies[lobbyId].players.length >= lobbies[lobbyId].maxPlayers) {
            // Redirect to a random lobby or create a new one
            lobbyId = getOrCreateRandomLobby();
        }

        _joinLobby(lobbyId);
    }

    /**
     * @dev Joins a random lobby or creates a new one if none are available
     */
    function joinRandomLobby() external {
        uint256 lobbyId = getOrCreateRandomLobby();
        _joinLobby(lobbyId);
    }

    /**
     * @dev Leaves the lobby
     * @param lobbyId The identifier of the lobby to leave
     */
    function leaveLobby(uint256 lobbyId) external validLobbyId(lobbyId) lobbyInState(lobbyId, LobbyState.Waiting) {
        require(playerInLobby[lobbyId][msg.sender], "Not in lobby");

        // Return stake to player
        uint256 stake = lobbies[lobbyId].stake;
        require(liarsToken.transfer(msg.sender, stake), "Token transfer failed");

        _removePlayer(lobbyId, msg.sender);
        emit PlayerLeft(lobbyId, msg.sender);

        // Automatically close the lobby if it's empty
        if (lobbies[lobbyId].players.length == 0) {
            lobbies[lobbyId].state = LobbyState.Closed;
            delete codeHashToLobbyId[lobbies[lobbyId].codeHash];
        }
    }

    /**
     * @dev Starts the game for a lobby
     * @param lobbyId The identifier of the lobby to start
     */
    function startGame(uint256 lobbyId)
        external
        validLobbyId(lobbyId)
        lobbyInState(lobbyId, LobbyState.Waiting)
    {
        Lobby storage lobby = lobbies[lobbyId];
        require(lobby.players.length >= MIN_PLAYERS, "Not enough players");

        lobby.state = LobbyState.InGame;
        emit GameStarted(lobbyId);

        // Call the startGame function on the LiarsLobby contract
        LiarsLobby(lobby.lobbyContract).startGame();
    }

    /**
     * @dev Distributes rewards to the winner
     * @param lobbyId The identifier of the lobby
     * @param winner The address of the winner
     */
    function distributeRewards(uint256 lobbyId, address winner) external validLobbyId(lobbyId) {
        Lobby storage lobby = lobbies[lobbyId];
        require(lobby.state == LobbyState.InGame, "Game is not in progress");

        uint256 totalStake = lobby.stake * lobby.players.length;
        require(liarsToken.transfer(winner, totalStake), "Token transfer failed");

        lobby.state = LobbyState.Closed;
        emit RewardsDistributed(lobbyId, winner, totalStake);
    }

    // Internal functions
    function _joinLobby(uint256 lobbyId) internal validLobbyId(lobbyId) lobbyInState(lobbyId, LobbyState.Waiting) {
        Lobby storage lobby = lobbies[lobbyId];
        require(!playerInLobby[lobbyId][msg.sender], "Already in lobby");
        require(lobby.players.length < lobby.maxPlayers, "Lobby full");

        uint256 stake = lobby.stake;
        require(liarsToken.transferFrom(msg.sender, address(this), stake), "Token transfer failed");

        lobby.players.push(msg.sender);
        playerInLobby[lobbyId][msg.sender] = true;
        emit PlayerJoined(lobbyId, msg.sender, lobby.codeHash);
    }

    function _removePlayer(uint256 lobbyId, address player) internal {
        Lobby storage lobby = lobbies[lobbyId];
        uint256 length = lobby.players.length;

        for (uint256 i = 0; i < length; i++) {
            if (lobby.players[i] == player) {
                lobby.players[i] = lobby.players[length - 1];
                lobby.players.pop();
                playerInLobby[lobbyId][player] = false;
                break;
            }
        }
    }

    function getOrCreateRandomLobby() internal returns (uint256) {
        for (uint256 i = 1; i <= lobbyCount; i++) {
            if (lobbies[i].state == LobbyState.Waiting && lobbies[i].players.length < lobbies[i].maxPlayers) {
                return i;
            }
        }
        // If no available lobby, create a new one
        string memory defaultCode = uint2str(lobbyCount + 1);
        uint8 defaultMaxPlayers = MAX_PLAYERS;
        uint256 defaultStake = 10 * (10**18); // Example default stake
        return _createLobby(defaultCode, defaultMaxPlayers, defaultStake);
    }

    // View functions
    function getLobbyDetails(uint256 lobbyId) external view validLobbyId(lobbyId) returns (
        uint256 id,
        address[] memory players,
        LobbyState state,
        uint8 maxPlayers,
        uint256 createdAt,
        uint256 stake,
        bytes32 codeHash
    ) {
        Lobby storage lobby = lobbies[lobbyId];
        return (
            lobby.id,
            lobby.players,
            lobby.state,
            lobby.maxPlayers,
            lobby.createdAt,
            lobby.stake,
            lobby.codeHash
        );
    }

    function isPlayerInLobby(uint256 lobbyId, address player) external view returns (bool) {
        return playerInLobby[lobbyId][player];
    }

    // Helper function to convert uint to string
    function uint2str(uint256 _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}
