// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title PortfolioRegistry
/// @notice Minimal on-chain portfolio storage keyed by bytes32 asset ids (e.g., keccak256 of a symbol or token identifier).
///         Stores amounts per user; supports batch set and batch get. No access control beyond msg.sender's own storage.
contract PortfolioRegistry {
    // owner => assetId => amount (scaled, e.g., 1e18)
    mapping(address => mapping(bytes32 => uint128)) public amountOf;

    event AssetUpdated(address indexed owner, bytes32 indexed assetId, uint128 amount);
    event AssetsBatchUpdated(address indexed owner, uint256 count);

    /// @notice Set a single asset amount for the caller
    function set(bytes32 assetId, uint128 amount) external {
        amountOf[msg.sender][assetId] = amount;
        emit AssetUpdated(msg.sender, assetId, amount);
    }

    /// @notice Batch set multiple asset amounts for the caller
    function setMany(bytes32[] calldata assetIds, uint128[] calldata amounts) external {
        require(assetIds.length == amounts.length, "Length mismatch");
        for (uint256 i = 0; i < assetIds.length; i++) {
            amountOf[msg.sender][assetIds[i]] = amounts[i];
            emit AssetUpdated(msg.sender, assetIds[i], amounts[i]);
        }
        emit AssetsBatchUpdated(msg.sender, assetIds.length);
    }

    /// @notice Batch read amounts for an owner
    function getMany(address owner, bytes32[] calldata assetIds) external view returns (uint128[] memory amounts) {
        amounts = new uint128[](assetIds.length);
        for (uint256 i = 0; i < assetIds.length; i++) {
            amounts[i] = amountOf[owner][assetIds[i]];
        }
    }
}


