// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {AgenticSubdomain} from "../src/AgenticSubdomain.sol";

/// @dev Minimal stub so `setSubnodeRecord` succeeds without a forked NameWrapper.
contract MockNameWrapper {
    function setSubnodeRecord(
        bytes32,
        bytes32,
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

    function test_SetSubdomain() public {
        agenticSubdomain.setSubdomain("agenticpunk", address(0xBEEF), type(uint64).max);
    }
}
