// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Import OpenZeppelin standard contracts for ERC20 and Ownable functionalities.
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LiarsToken is ERC20, Ownable {
    // Conversion rate: for example, 1 ETH yields 1000 tokens (adjustable as needed).
    uint256 public constant TOKENS_PER_ETH = 1000 * 10**18; // 18 decimals

    // VIP claim constants:
    // Amount of tokens a VIP can claim per interval.
    uint256 public constant VIP_CLAIM_AMOUNT = 100 * 10**18;
    // Time interval between claims for VIPs.
    uint256 public constant VIP_CLAIM_INTERVAL = 10 minutes;

    // Mapping to track VIP addresses.
    mapping(address => bool) public vipList;
    // Mapping to track the last claim time for each VIP address.
    mapping(address => uint256) public lastClaimTime;

    // Constructor initializes the token with its name and symbol and passes msg.sender as the initial owner.
    constructor() ERC20("Liars Token", "LIE") Ownable(msg.sender) {}

    /**
     * @dev Allows a user to purchase tokens by sending ETH.
     * The function calculates the number of tokens to mint based on the amount of ETH sent.
     */
    function buyTokens() external payable {
        require(msg.value > 0, "You must send ETH to purchase tokens.");
        uint256 tokensToMint = (msg.value * TOKENS_PER_ETH) / 1 ether;
        _mint(msg.sender, tokensToMint);
    }

    /**
     * @dev Allows the owner to add an address to the VIP list.
     */
    function addVIP(address account) external onlyOwner {
        vipList[account] = true;
    }

    /**
     * @dev Allows the owner to remove an address from the VIP list.
     */
    function removeVIP(address account) external onlyOwner {
        vipList[account] = false;
    }

    /**
     * @dev Allows VIP users to claim VIP tokens if 10 minutes have passed since their last claim.
     * The function updates the last claim timestamp and mints VIP_CLAIM_AMOUNT tokens to the caller.
     */
    function claimVipTokens() external {
        require(vipList[msg.sender], "You are not a VIP.");
        require(
            block.timestamp >= lastClaimTime[msg.sender] + VIP_CLAIM_INTERVAL,
            "Claim not available yet."
        );
        lastClaimTime[msg.sender] = block.timestamp;
        _mint(msg.sender, VIP_CLAIM_AMOUNT);
    }

    /**
     * @dev Allows the owner to withdraw the ETH accumulated in the contract from token purchases.
     */
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    /**
     * @dev Returns true if the given account is a VIP.
     */
    function isVIP(address account) external view returns (bool) {
        return vipList[account];
    }

    /**
     * @dev Returns the time remaining (in seconds) before the account can claim VIP tokens again.
     * Returns 0 if the claim is already available.
     */
    function timeUntilNextClaim(address account) external view returns (uint256) {
        if (block.timestamp >= lastClaimTime[account] + VIP_CLAIM_INTERVAL) {
            return 0;
        } else {
            return (lastClaimTime[account] + VIP_CLAIM_INTERVAL) - block.timestamp;
        }
    }
}
