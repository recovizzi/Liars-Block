// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LiarsToken is ERC20, Ownable {
    // Token metadata structure
    struct TokenMetadata {
        string name;
        string tokenType;
        uint256 value;
        string ipfsHash;
        address[] previousOwners;
        uint256 createdAt;
        uint256 lastTransferAt;
    }

    // Constants
    uint256 public constant TOKENS_PER_ETH = 1000 * 10**18;
    uint256 public constant VIP_CLAIM_AMOUNT = 100 * 10**18;
    uint256 public constant VIP_CLAIM_INTERVAL = 10 minutes;

    // Mappings
    mapping(address => bool) public vipList;
    mapping(address => uint256) public lastClaimTime;
    mapping(uint256 => TokenMetadata) public tokenMetadata;
    
    // Token ID counter
    uint256 private _tokenIdCounter;

    constructor() ERC20("Liars Token", "LIE") Ownable(msg.sender) {}

    function buyTokens() external payable {
        require(msg.value > 0, "You must send ETH to purchase tokens.");
        uint256 tokensToMint = (msg.value * TOKENS_PER_ETH) / 1 ether;
        
        // Create metadata for the new tokens
        uint256 tokenId = _tokenIdCounter++;
        address[] memory emptyArray = new address[](0);
        
        tokenMetadata[tokenId] = TokenMetadata({
            name: "Liars Token",
            tokenType: "Currency",
            value: msg.value,
            ipfsHash: "",
            previousOwners: emptyArray,
            createdAt: block.timestamp,
            lastTransferAt: block.timestamp
        });

        _mint(msg.sender, tokensToMint);
    }

    function addVIP(address account) external onlyOwner {
        vipList[account] = true;
    }

    function removeVIP(address account) external onlyOwner {
        vipList[account] = false;
    }

    function claimVipTokens() external {
        require(vipList[msg.sender], "You are not a VIP.");
        require(
            block.timestamp >= lastClaimTime[msg.sender] + VIP_CLAIM_INTERVAL,
            "Claim not available yet."
        );
        
        uint256 tokenId = _tokenIdCounter++;
        address[] memory emptyArray = new address[](0);
        
        // Create metadata for VIP tokens
        tokenMetadata[tokenId] = TokenMetadata({
            name: "Liars VIP Token",
            tokenType: "VIP",
            value: VIP_CLAIM_AMOUNT,
            ipfsHash: "",
            previousOwners: emptyArray,
            createdAt: block.timestamp,
            lastTransferAt: block.timestamp
        });

        lastClaimTime[msg.sender] = block.timestamp;
        _mint(msg.sender, VIP_CLAIM_AMOUNT);
    }

    function withdraw() external onlyOwner {
        require(address(this).balance > 0, "No ETH");
        payable(owner()).transfer(address(this).balance);
    }

    function isVIP(address account) external view returns (bool) {
        return vipList[account];
    }

    function timeUntilNextClaim(address account) external view returns (uint256) {
        if (block.timestamp >= lastClaimTime[account] + VIP_CLAIM_INTERVAL) {
            return 0;
        } else {
            return (lastClaimTime[account] + VIP_CLAIM_INTERVAL) - block.timestamp;
        }
    }

    function getTokenMetadata(uint256 tokenId) external view returns (
        string memory name,
        string memory tokenType,
        uint256 value,
        string memory ipfsHash,
        address[] memory previousOwners,
        uint256 createdAt,
        uint256 lastTransferAt
    ) {
        TokenMetadata storage metadata = tokenMetadata[tokenId];
        return (
            metadata.name,
            metadata.tokenType,
            metadata.value,
            metadata.ipfsHash,
            metadata.previousOwners,
            metadata.createdAt,
            metadata.lastTransferAt
        );
    }

}