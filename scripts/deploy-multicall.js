const { JsonRpcProvider, Wallet } = require("ethers");
const fs = require("fs");
const api3Contracts = require("@api3/contracts");
const dotenv = require("dotenv");

dotenv.config();

const deployMulticall = async () => {
  const targetNetworkProvider = new JsonRpcProvider(process.env.TARGET_NETWORK_RPC_URL);

  const targetNetworkWallet = Wallet.fromPhrase(process.env.MNEMONIC).connect(targetNetworkProvider);

  const OevSearcherMulticallV1Factory = new api3Contracts.OevSearcherMulticallV1__factory(targetNetworkWallet);
  const OevSearcherMulticallV1 = await OevSearcherMulticallV1Factory.deploy();

  console.log("OevSearcherMulticallV1 deployed at:", OevSearcherMulticallV1.target);

  // Save the address to deployments.json, creating the file if it does not exist
  const deployments = fs.existsSync("scripts/deployments.json") ? JSON.parse(fs.readFileSync("scripts/deployments.json")) : {};
  deployments.OevSearcherMulticallV1 = OevSearcherMulticallV1.target;
  fs.writeFileSync("scripts/deployments.json", JSON.stringify(deployments, null, 2));
};

deployMulticall();
