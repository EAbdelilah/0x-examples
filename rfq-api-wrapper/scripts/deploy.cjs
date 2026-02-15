const hre = require("hardhat");

async function main() {
    const balancerVault = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
    const zeroExProxy = "0xdef1c0ded9bec7f1a1670819833240f027b25eff"; // Standard 0x Proxy

    console.log("Deploying AtomicBroker...");

    const AtomicBroker = await hre.viem.deployContract("AtomicBroker", [
        balancerVault,
        zeroExProxy
    ]);

    console.log(`AtomicBroker deployed to: ${AtomicBroker.address}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
