import { BigNumber, Wallet } from 'ethers'
import { waffle } from "@nomiclabs/buidler";
import { executeSendSuccess, executeSendFailure } from "./helpers"

const toAddresses = (wallets: Wallet[]): string[] => wallets.map(w => w.address)

describe('SimpleMultiSig', () => {
    const provider = waffle.provider;
    let wallets = provider.getWallets();
    // sort wallets by address
    for (let i = 0; i < wallets.length; i++) {
        for (let j = i; j < wallets.length; j++) {
            if (BigNumber.from(wallets[j].address) < BigNumber.from(wallets[i].address)) {
                const temp = wallets[j];
                wallets[j] = wallets[i];
                wallets[i] = temp;
            }
        }
    }

  describe("3 signers, threshold 2", () => {
    const owners = toAddresses(wallets.slice(0, 3))
    const threshold = 2;

    it("should succeed with signers 0, 1", async () => {
        const signers = [wallets[0], wallets[1]]
        await executeSendSuccess(signers, owners, threshold)
    })

    it("should succeed with signers 0, 2", async () => {
        const signers = [wallets[0], wallets[2]]
        await executeSendSuccess(signers, owners, threshold)
    })

    it("should succeed with signers 1, 2", async () => {
        const signers = [wallets[1], wallets[2]]
        await executeSendSuccess(signers, owners, threshold)
    })

    it("should succeed with signers 1, 2, 3", async () => {
        const signers = wallets.slice(0, 3)
        await executeSendSuccess(signers, owners, threshold)
    })

    it("should fail due to non-owner signer", async () => {
        const signers = [wallets[0], wallets[3]]
        await executeSendFailure(signers, owners, threshold)
    })

    it("should fail with fewers signers than the threshold", async () => {
        const signers = [wallets[0]]
        await executeSendFailure(signers, owners, threshold, "not enough signatures")
    })

    it("should fail with one signer signing twice", async () => {
        const signers = [wallets[0], wallets[0]]
        await executeSendFailure(signers, owners, threshold, "sender not in increasing order")
    })

    it("should fail with signers in decreasing order", async () => {
        const signers = wallets.slice(0, 2).reverse()
        await executeSendFailure(signers, owners, threshold, "sender not in increasing order")
    })

    it("should fail with the wrong nonce", async () => {
        const signers = [wallets[0], wallets[1]]
        await executeSendFailure(signers, owners, threshold, "recovered sender is not an owner", 1)
    })
  })
})
