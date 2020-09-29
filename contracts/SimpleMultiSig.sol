pragma solidity ^0.6.6;

// import "@nomiclabs/buidler/console.sol";

contract SimpleMultiSig {
  uint public nonce;                 // (only) mutable state

  uint public threshold;             // immutable state
  mapping (address => bool) isOwner; // immutable state
  address[] public ownersArr;        // immutable state

  // Note that owners_ must be strictly increasing, in order to prevent duplicates
  constructor(uint threshold_, address[] memory owners_) public {
    require(owners_.length <= 10 && threshold_ <= owners_.length && threshold_ > 0);

    address lastAdd = address(0);
    for (uint i = 0; i < owners_.length; i++) {
      require(owners_[i] > lastAdd, "sender not in increasing order");
      isOwner[owners_[i]] = true;
      lastAdd = owners_[i];
    }
    ownersArr = owners_;
    threshold = threshold_;
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
    require(sigR.length >= threshold, "not enough signatures");
    uint length = sigR.length;
    require(length == sigS.length && sigR.length == sigV.length);
    require(executor == msg.sender || executor == address(0));

    bytes32 hash = keccak256(abi.encodePacked(
        gasLimit, destination, value, keccak256(data), address(this), executor, nonce++
    ));
    // TODO: Re-enable this
    // hash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    // console.logBytes32(hash);

    address lastAdd = address(0); // cannot have address(0) as an owner
    for (uint i = 0; i < length; i++) {
      address recovered = ecrecover(hash, sigV[i], sigR[i], sigS[i]);
      require(recovered > lastAdd, "sender not in increasing order");
      require(isOwner[recovered], "recovered sender is not an owner");
      lastAdd = recovered;
    }

    // If we make it here all signatures are accounted for.
    // The address.call() syntax is no longer recommended, see:
    // https://github.com/ethereum/solidity/issues/2884
    bool success = false;
    assembly { success := call(gasLimit, destination, value, add(data, 0x20), mload(data), 0, 0) }
    require(success);
  }

  receive () payable external {}
}
