import { ethers, BigNumberish, Wallet } from 'ethers'
import {
  BytesLike,
  keccak256,
  solidityKeccak256,
  parseEther,
} from 'ethers/lib/utils'
import { deployContract } from 'ethereum-waffle'
import SimpleMultiSig from "../build/SimpleMultiSig.json"
import TestRegistry  from "../build/TestRegistry.json"
import { expect } from 'chai'

const ZEROADDR = ethers.constants.AddressZero
const EMPTY_DATA = '0x'
const amount = parseEther('0.1')
const value = parseEther('0.01')


export const createSigs = async (
    wallets: Wallet[], 
    multisigAddr: string, 
    nonce: BigNumberish,
    destinationAddr: string, 
    value: BigNumberish, 
    data: BytesLike, 
    executor: string, 
    gasLimit: BigNumberish,
) => {
    // sign all the data
    let hash = solidityKeccak256(
        ['uint256', 'address', 'uint256', 'bytes32', 'address', 'address', 'uint256'],
        [gasLimit, destinationAddr, value, keccak256(data), multisigAddr, executor, nonce]
    )

    let sigV = []
    let sigR = []
    let sigS = []

    for (let i = 0; i < wallets.length; i++) {
        // TODO: Re-enable this
        const sig = wallets[i]._signingKey().signDigest(hash);
        // const sig = splitSignature(await wallets[i].signMessage(hash))
        sigV.push(sig.v)
        sigR.push(sig.r)
        sigS.push(sig.s)
    }

    return {sigV, sigR, sigS}
}

export const executeSendSuccess = async (wallets: Wallet[], owners: string[], threshold: number, requiredSignerIdxs: number[] = []) => {
    const provider = wallets[0].provider
    const deployer = wallets[0]
    const executor = wallets[0].address
    const msgSender = wallets[0].address

    const multisig = await deployContract(deployer, SimpleMultiSig, [threshold, owners, requiredSignerIdxs])
    const randomAddr = Wallet.createRandom().address

    // Receive funds
    await deployer.sendTransaction({
        to: multisig.address,
        value: amount,
    })

    let nonce = await multisig.nonce.call()
    expect(nonce).to.equal(0)
    expect(await provider.getBalance(multisig.address)).to.equal(amount)

    // check that owners are stored correctly
    for (var i=0; i < owners.length; i++) {
        expect(await multisig.ownersArr(i)).to.equal(owners[i])
    }

    let sigs = await createSigs(wallets, multisig.address, nonce, randomAddr, value, EMPTY_DATA, executor, 21000)
    await multisig.execute(sigs.sigV, sigs.sigR, sigs.sigS, randomAddr, value, EMPTY_DATA, executor, 21000, { from: msgSender })

    // Check funds sent
    expect(await provider.getBalance(randomAddr)).to.equal(value)

    // Check nonce updated
    nonce = await multisig.nonce.call()
    expect(nonce).to.equal(1)

    // Check that it succeeds with executor = Zero address
    sigs = await createSigs(wallets, multisig.address, nonce, randomAddr, value, EMPTY_DATA, ZEROADDR, 21000)
    await multisig.execute(sigs.sigV, sigs.sigR, sigs.sigS, randomAddr, value, EMPTY_DATA, ZEROADDR, 21000, { from: msgSender })

    // Check funds
    expect(await provider.getBalance(randomAddr)).to.equal(value.mul(2))
    expect(await provider.getBalance(multisig.address)).to.equal(amount.sub(value.mul(2)))

    // Check nonce updated
    nonce = await multisig.nonce.call()
    expect(nonce).to.equal(2)

    // Test contract interactions
    const reg = await deployContract(deployer, TestRegistry)

    const number = 12345
    const data = reg.interface.encodeFunctionData('register', [number])

    sigs = await createSigs(wallets, multisig.address, nonce, reg.address, 0, data, executor, 100000)
    await multisig.execute(sigs.sigV, sigs.sigR, sigs.sigS, reg.address, 0, data, executor, 100000, { from: msgSender })

    // Check that number has been set in registry
    expect(await reg.registry(multisig.address)).to.eq(number)

    // Check nonce updated
    nonce = await multisig.nonce.call()
    expect(nonce).to.equal(3)
}

export const executeSendFailure = async (wallets: Wallet[], owners: string[], threshold: number, reason = "recovered sender is not an owner", nonceOffset: number = 0, requiredSignerIdxs: number[] = []) => {
    const deployer = wallets[0]
    const executor = wallets[0].address
    const msgSender = wallets[0].address

    const multisig = await deployContract(deployer, SimpleMultiSig, [threshold, owners, requiredSignerIdxs])
    const randomAddr = Wallet.createRandom().address

    // Receive funds
    await deployer.sendTransaction({
        to: multisig.address,
        value: amount,
    })

    let nonce = await multisig.nonce.call()
    let sigs = await createSigs(wallets, multisig.address, nonce + nonceOffset, randomAddr, value, EMPTY_DATA, executor, 21000)
    await expect(multisig.execute(sigs.sigV, sigs.sigR, sigs.sigS, randomAddr, value, EMPTY_DATA, executor, 21000, { from: msgSender })).to.revertedWith(reason)
}
