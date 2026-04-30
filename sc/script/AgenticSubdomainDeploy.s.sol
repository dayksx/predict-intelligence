// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {AgenticSubdomain} from "../src/AgenticSubdomain.sol";

address constant NAME_WRAPPER_SEPOLIA =
    0x0635513f179D50A207757E05759CbD106d7dFcE8;

address constant PUBLIC_RESOLVER_SEPOLIA =
    0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5;

/// @dev Step 1: deploy. Then run `AgenticSubdomainApprove` as the owner of wrapped `agentic.eth`.
contract AgenticSubdomainDeploy is Script {
    AgenticSubdomain public agenticSubdomain;
    /// @notice EIP-137 `namehash` for `agentic.eth` (labels hashed right-to-left: `eth`, then `agentic`).
    function namehashAgenticEth() private pure returns (bytes32) {
        bytes32 node = bytes32(0);
        node = keccak256(abi.encodePacked(node, keccak256(bytes("eth"))));
        node = keccak256(abi.encodePacked(node, keccak256(bytes("agentic"))));
        return node;
    }

    function setUp() public {}

    function run() public {
        vm.startBroadcast();
        agenticSubdomain = new AgenticSubdomain(
            NAME_WRAPPER_SEPOLIA,
            namehashAgenticEth(),
            PUBLIC_RESOLVER_SEPOLIA
        );
        vm.stopBroadcast();
    }
}
