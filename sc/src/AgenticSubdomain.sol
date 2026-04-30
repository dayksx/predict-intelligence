// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

// Minimal ABI for ENS NameWrapper.setSubnodeRecord (wrapped names).
// Second arg must be the plain label string; the wrapper hashes it internally (not bytes32 labelhash).
interface INameWrapper {
    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address owner,
        address resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    ) external;
}

// Registers subnames under a wrapped parent (parentNode = namehash of e.g. agentic.eth; label = first segment only).
contract AgenticSubdomain {
    // Sepolia NameWrapper 0x0635513f179D50A207757E05759CbD106d7dFcE8 — ERC-1155 balances live there, not here.
    INameWrapper public immutable nameWrapper;

    // namehash(parent ENS name), must match the wrapped parent configured at deploy.
    bytes32 public immutable parentNode;

    // Sepolia PublicResolver 0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5 for new subname records.
    address public publicResolver;

    constructor(address _nameWrapper, bytes32 _parentNode, address _publicResolver) {
        nameWrapper = INameWrapper(_nameWrapper);
        parentNode = _parentNode;
        publicResolver = _publicResolver;
    }

    // label = UTF-8 segment without dots; agentAddress = wrapped owner; _expiry = NameWrapper expiry.
    function setSubdomain(string calldata label, address agentAddress, uint64 _expiry) public {
        nameWrapper.setSubnodeRecord(
            parentNode,
            label,
            agentAddress,
            publicResolver,
            0, // TTL default via ENS/resolver
            0, // no extra fuses burned here
            _expiry
        );
    }
}
