const { createWalletClient, createPublicClient, http, getContract, parseAbi, Hex } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { base, polygon } = require("viem/chains");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
    const chainName = process.argv[2] || "base";
    const chainMap = { base, polygon };
    const chain = chainMap[chainName];

    if (!chain) {
        console.error(`Invalid chain: ${chainName}. Use 'base' or 'polygon'`);
        process.exit(1);
    }

    const rpcUrl = process.env[`RPC_URL_${chain.id}`];
    const privateKey = process.env.PRIVATE_KEY;

    if (!rpcUrl || !privateKey) {
        console.error(`Missing RPC_URL_${chain.id} or PRIVATE_KEY in .env`);
        process.exit(1);
    }

    const account = privateKeyToAccount(`0x${privateKey.replace("0x", "")}`);
    const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

    const balancerVault = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";

    // Load artifact
    const artifactPath = path.join(__dirname, "../artifacts/contracts/AtomicBroker.sol/AtomicBroker.json");
    if (!fs.existsSync(artifactPath)) {
        console.error("Artifact not found. Run 'npx hardhat compile' first.");
        process.exit(1);
    }
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    console.log(`Deploying AtomicBroker to ${chain.name}...`);

    const hash = await walletClient.deployContract({
        abi: artifact.abi,
        account,
        args: [],
        bytecode: artifact.bytecode,
    });

    console.log(`Transaction submitted: ${hash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`AtomicBroker deployed to: ${receipt.contractAddress}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
