// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

contract LiarsGameManager is Ownable {

    enum LobbyState { Waiting, InGame, Closed }

    struct Lobby {
        uint256 id;
        address creator;
        address[] players;
        LobbyState state;
        string code; // optional lobby code
    }

    uint256 public lobbyCount;
    mapping(uint256 => Lobby) public lobbies;
    mapping(string => uint256) private codeToLobbyId;

    // Events for logging purposes
    event LobbyCreated(uint256 indexed lobbyId, address indexed creator, string code);
    event PlayerJoined(uint256 indexed lobbyId, address indexed player);
    event LobbyClosed(uint256 indexed lobbyId);

    /**
     * @dev Creates a new lobby. The caller becomes the creator and is automatically added as the first player.
     * @param code An optional code for the lobby.
     * @return lobbyId The unique identifier of the created lobby.
     */
    function createLobby(string memory code) external returns (uint256 lobbyId) {
        lobbyCount++;
        lobbyId = lobbyCount;

        Lobby storage newLobby = lobbies[lobbyId];
        newLobby.id = lobbyId;
        newLobby.creator = msg.sender;
        newLobby.state = LobbyState.Waiting;
        newLobby.code = code;
        newLobby.players.push(msg.sender);

        if (bytes(code).length > 0) {
            codeToLobbyId[code] = lobbyId;
        }

        emit LobbyCreated(lobbyId, msg.sender, code);
    }

    /**
     * @dev Allows a player to join an existing lobby by its ID.
     * @param lobbyId The identifier of the lobby to join.
     */
    function joinLobby(uint256 lobbyId) external {
        Lobby storage lobby = lobbies[lobbyId];
        require(lobby.id != 0, "Lobby does not exist");
        require(lobby.state == LobbyState.Waiting || lobby.state == LobbyState.InGame, "Lobby is closed");

        // Prevent duplicate joins
        for (uint i = 0; i < lobby.players.length; i++) {
            require(lobby.players[i] != msg.sender, "Already joined");
        }

        lobby.players.push(msg.sender);
        emit PlayerJoined(lobbyId, msg.sender);
    }

    /**
     * @dev Allows a player to join a lobby by its unique code.
     * @param code The code of the lobby to join.
     */
    function joinLobbyByCode(string memory code) external {
        uint256 lobbyId = codeToLobbyId[code];
        require(lobbyId != 0, "Lobby with given code does not exist");
        joinLobby(lobbyId);
    }

    /**
     * @dev Returns the details of a lobby.
     * @param lobbyId The identifier of the lobby.
     */
    function getLobbyDetails(uint256 lobbyId) external view returns (
        uint256 id,
        address creator,
        address[] memory players,
        LobbyState state,
        string memory code
    ) {
        Lobby storage lobby = lobbies[lobbyId];
        require(lobby.id != 0, "Lobby does not exist");
        return (lobby.id, lobby.creator, lobby.players, lobby.state, lobby.code);
    }

    /**
     * @dev Closes a lobby. Only the owner can close a lobby.
     * @param lobbyId The identifier of the lobby to close.
     */
    function closeLobby(uint256 lobbyId) external onlyOwner {
        Lobby storage lobby = lobbies[lobbyId];
        require(lobby.id != 0, "Lobby does not exist");
        require(lobby.state != LobbyState.Closed, "Lobby already closed");

        lobby.state = LobbyState.Closed;
        emit LobbyClosed(lobbyId);
    }
}
