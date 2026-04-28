// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract AgenticSubdomain {
    string public subdomain;

    constructor(string memory _subdomain) {
        subdomain = _subdomain;
    }

    function setSubdomain(string memory _subdomain) public {
        subdomain = _subdomain;
    }
}
