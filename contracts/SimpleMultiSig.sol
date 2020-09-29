pragma solidity ^0.6.6;

// import "@nomiclabs/buidler/console.sol";

contract SimpleMultiSig {
  uint public nonce;                 // (only) mutable state

  uint public threshold;             // immutable state
  mapping (address => bool) isOwner; // immutable state
  address[] public ownersArr;        // immutable state
  uint256[] public requiredSignersIdxs;        // immutable state

  // Note that owners_ must be strictly increasing, in order to prevent duplicates
  constructor(uint threshold_, address[] memory owners_, uint256[] memory requiredSignersIdxs_) public {
    require(owners_.length <= 10 && threshold_ <= owners_.length && threshold_ > 0);

    address lastAdd = address(0);
    for (uint i = 0; i < owners_.length; i++) {
      require(owners_[i] > lastAdd, "sender not in increasing order");
      isOwner[owners_[i]] = true;
      lastAdd = owners_[i];
    }
    ownersArr = owners_;
    threshold = threshold_;
    requiredSignersIdxs = requiredSignersIdxs_;
  }

  // Note that address recovered from signatures must be strictly increasing, in order to prevent duplicates
  function execute(
      uint8[] memory sigV, 
      bytes32[] memory sigR, 
      bytes32[] memory sigS, 
      address destination, 
      uint value, 
      bytes memory data, 
      address executor, 
      uint gasLimit
  ) public {
    require(executor == msg.sender || executor == address(0));
    bytes32 hash = keccak256(abi.encodePacked(
        gasLimit, destination, value, keccak256(data), address(this), executor, nonce++
    ));

    checkAuthorized(sigV, sigR, sigS, hash);

    // If we make it here all signatures are accounted for.
    // The address.call() syntax is no longer recommended, see:
    // https://github.com/ethereum/solidity/issues/2884
    bool success = false;
    assembly { success := call(gasLimit, destination, value, add(data, 0x20), mload(data), 0, 0) }
    require(success);
  }

  // enforces the multisig requirements
  function checkAuthorized(
      uint8[] memory sigV, 
      bytes32[] memory sigR, 
      bytes32[] memory sigS, 
      bytes32 hash
  ) private view {
    require(sigR.length >= threshold, "not enough signatures");
    require(sigR.length == sigS.length && sigR.length == sigV.length, "sig arrays lengths do not match");
    // TODO: Re-enable this
    // hash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    // console.logBytes32(hash);
    address lastAdd = address(0); // cannot have address(0) as an owner
    uint length = sigV.length;

    uint numRequiredSigners = 0;
    address[] memory _owners = ownersArr;
    uint256[] memory _requiredSignersIdxs = requiredSignersIdxs;
    for (uint i = 0; i < length; i++) {
      address recovered = ecrecover(hash, sigV[i], sigR[i], sigS[i]);
      require(recovered > lastAdd, "sender not in increasing order");
      require(isOwner[recovered], "recovered sender is not an owner");
      lastAdd = recovered;

      if (isRequiredSigner(recovered, _owners, _requiredSignersIdxs)) {
          numRequiredSigners++;
      }
    }

    require(numRequiredSigners >= _requiredSignersIdxs.length, "not enough final signers authorized the call");
  }

  function isRequiredSigner(address addr, address[] memory owners, uint256[] memory _requiredSignerIdxs) private pure returns (bool) {
      uint length = _requiredSignerIdxs.length;
      for (uint i = 0; i < length; i++) {
          if (owners[_requiredSignerIdxs[i]] == addr) {
              return true;
          }
      }
      return false;
  }

  receive () payable external {}
}
