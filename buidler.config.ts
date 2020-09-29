import { config } from "dotenv"

import { usePlugin } from "@nomiclabs/buidler/config";

const INFURA_API_KEY = process.env.INFURA_API_KEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

usePlugin("@nomiclabs/buidler-waffle");

export default {
    defaultNetwork: "buidlerevm",
    // networks: {
    //     mainnet: {
    //         url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
    //             accounts: [PRIVATE_KEY]
    //     },
    //     rinkeby: {
    //         url: `https://rinkeby.infura.io/v3/${INFURA_API_KEY}`,
    //             accounts: [PRIVATE_KEY]
    //     },
    // },
    solc: {
        version: "0.6.6",
        optimizer: {
            enabled: true,
            runs: 200,
        }
    },
    paths: {
        artifacts: "./build"
    }
};
