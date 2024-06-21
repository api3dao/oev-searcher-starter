const { JsonRpcProvider, Wallet, Contract, parseEther } = require("ethers");
const api3Contracts = require("@api3/contracts");
const dotenv = require("dotenv");

dotenv.config();

const oevNetworkProvider = new JsonRpcProvider(process.env.OEV_NETWORK_RPC_URL);
const targetNetworkProvider = new JsonRpcProvider(process.env.TARGET_NETWORK_RPC_URL);

const oevNetworkWallet = new Wallet.fromPhrase(process.env.MNEMONIC).connect(oevNetworkProvider);
const targetNetworkWallet = new Wallet.fromPhrase(process.env.MNEMONIC).connect(targetNetworkProvider);

const OevAuctionHouseArtifact = await hre.artifacts.readArtifact("OevAuctionHouse");

const OevAuctionHouse = new Contract(
  api3Contracts.deploymentAddresses.OevAuctionHouse,
  OevAuctionHouseArtifact.abi,
  oevNetworkWallet
);

const OevSearcherMulticallV1Factory = api3Contracts.OevSearcherMulticallV1__factory.connect(targetNetworkWallet);
const OevSearcherMulticallV1 = await OevSearcherMulticallV1Factory.deploy();

console.log("OevSearcherMulticallV1 deployed at:", OevSearcherMulticallV1.address);

const deposit = async () => {
  const tx = await OevAuctionHouse.deposit({
    value: parseEther("0.0001"),
  });
};
