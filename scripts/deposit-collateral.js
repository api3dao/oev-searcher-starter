const { JsonRpcProvider, Wallet, Contract, parseEther } = require("ethers");
const api3Contracts = require("@api3/contracts");
const dotenv = require("dotenv");

dotenv.config();

const depositCollateral = async () => {
  const oevNetworkProvider = new JsonRpcProvider(process.env.OEV_NETWORK_RPC_URL);
  const oevNetworkWallet = Wallet.fromPhrase(process.env.MNEMONIC).connect(oevNetworkProvider);
  const OevAuctionHouseArtifact = await hre.artifacts.readArtifact("OevAuctionHouse");
  const OevAuctionHouse = new Contract(
    api3Contracts.deploymentAddresses.OevAuctionHouse["4913"],
    OevAuctionHouseArtifact.abi,
    oevNetworkWallet
  );

  const amount = process.env.AMOUNT ?? "0.00001";

  const depositTx = await OevAuctionHouse.deposit({
    value: parseEther(amount),
  });

  console.log(`Deposited ${amount} ETH into OevAuctionHouse\n Transaction hash:`, depositTx.hash);
};

depositCollateral();
