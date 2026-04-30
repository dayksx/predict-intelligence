// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {AgenticSubdomain} from "../src/AgenticSubdomain.sol";

/// @dev Stub aligné sur `INameWrapper.setSubnodeRecord` (2ᵉ arg = `string label`, pas le labelhash).
contract MockNameWrapper {
    function setSubnodeRecord(
        bytes32,
        string calldata,
        address,
        address,
        uint64,
        uint32,
        uint64
    ) external {}
}

contract AgenticSubdomainTest is Test {
    AgenticSubdomain public agenticSubdomain;

    function setUp() public {
        MockNameWrapper wrapper = new MockNameWrapper();
        bytes32 parentNode = keccak256("any-parent-for-test");
        agenticSubdomain = new AgenticSubdomain(
            address(wrapper),
            parentNode,
            address(0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5)
        );
    }

    /// @dev Sur la vraie chaîne, l’expiry doit être ≤ celle du parent ; le mock ne l’applique pas.
    function test_SetSubdomain() public {
        uint64 expiry = uint64(block.timestamp + 365 days);
        agenticSubdomain.setSubdomain("agenticpunk", address(0xBEEF), expiry);
    }
}
