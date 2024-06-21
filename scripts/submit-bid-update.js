const {
  Wallet,
  Contract,
  JsonRpcProvider,
  keccak256,
  solidityPacked,
  AbiCoder,
  parseEther,
  hexlify,
  randomBytes,
  MaxUint256,
} = require("ethers");
const api3Contracts = require("@api3/contracts");
const deployments = require("./deployments.json");
const dotenv = require("dotenv");

dotenv.config();

// The Bid Topic is constant value used by the auctioneer to filter bids that pertain to the specific auctioneer instance.
// That is to say, different versions of the auctioneer will have different bid topics.
const getBidTopic = () => {
  return "0x76302d70726f642d61756374696f6e6565720000000000000000000000000000";
};

// Function to encode the bid details and return to bytes
const getBidDetails = (proxyAddress, condition, conditionValue, updaterAddress) => {
  const abiCoder = new AbiCoder();
  const BID_CONDITIONS = [
    { onchainIndex: 0n, description: "LTE" },
    { onchainIndex: 1n, description: "GTE" },
  ];
  const conditionIndex = BID_CONDITIONS.findIndex((c) => c.description === condition);
  return abiCoder.encode(
    ["address", "uint256", "int224", "address", "bytes32"],
    [proxyAddress, conditionIndex, conditionValue, updaterAddress, hexlify(randomBytes(32))]
  );
};

const placeBid = async () => {
  const PROXY_ADDRESS = process.env.PROXY_ADDRESS ?? "0xae2debfef62b1a0c8af55dae11d197bca1bcde3f"; // Default: MNT/USD on Mantle Mainnet
  const CHAIN_ID = process.env.CHAIN_ID ?? "5000"; // Default: mantle Mainnet
  const BID_AMOUNT = process.env.BID_AMOUNT ?? "0.000001"; // Default: 0.000001 MNT
  const BID_CONDITION = process.env.BID_CONDITION ?? "LTE"; // Default: Less than or equal to
  const BID_PRICE = process.env.BID_PRICE ?? "5"; // Default: 5

  const oevNetworkProvider = new JsonRpcProvider(process.env.OEV_NETWORK_RPC_URL);
  const oevNetworkWallet = Wallet.fromPhrase(process.env.MNEMONIC).connect(oevNetworkProvider);
  const OevAuctionHouseArtifact = await hre.artifacts.readArtifact("OevAuctionHouse");
  const OevAuctionHouse = new Contract(
    api3Contracts.deploymentAddresses.OevAuctionHouse["4913"],
    OevAuctionHouseArtifact.abi,
    oevNetworkWallet
  );

  const bidTopic = getBidTopic();

  const bidDetails = getBidDetails(
    PROXY_ADDRESS, // Proxy addressof the dAPI
    BID_CONDITION, // The condition you want to update
    parseEther(BID_PRICE), // The price you want to update
    deployments.OevSearcherMulticallV1, // Your deployed MultiCall contract Address
    hexlify(randomBytes(32)) // Random padding
  );

  // Placing our bid with the auction house on OEV testnet
  const placedbidTx = await OevAuctionHouse.placeBidWithExpiration(
    bidTopic, // The bid topic of the auctioneer instance
    parseInt(CHAIN_ID), // Chain ID of the dAPI proxy
    parseEther(BID_AMOUNT), // The amount of chain native currency you are bidding to win this auction and perform the oracle update
    bidDetails, // The details about the bid, proxy address, condition, price, your deployed multicall and random
    MaxUint256, // Collateral Basis Points is set to max
    MaxUint256, // Protocol Fee Basis Points is set to max
    Math.trunc(Date.now() / 1000) + 60 * 60 * 12 // Expiration time is set to 12 hours from now
  );
  console.log("Bid Tx Hash", placedbidTx.hash);
  console.log("Bid placed");

  // Compute the bid ID
  const bidId = keccak256(
    solidityPacked(
      ["address", "bytes32", "bytes32"],
      [
        oevNetworkWallet.address, // The wallet address if the signer doing the bid (public of your private key)
        bidTopic, // Details of the chain and price feed we want to update encoded
        keccak256(bidDetails), // The details about the bid, proxy address, condition, price, your deployed multicall and random
      ]
    )
  );

  const awardedTransaction = await new Promise(async (resolve, reject) => {
    console.log("Waiting for bid to be awarded...");
    const OevAuctionHouseFilter = OevAuctionHouse.filters.AwardedBid(null, bidTopic, bidId, null, null);
    while (true) {
      const bid = await OevAuctionHouse.bids(bidId);
      if (bid[0] === 2n) {
        console.log("Bid Awarded");
        const currentBlock = await oevNetworkProvider.getBlockNumber();
        const awardEvent = await OevAuctionHouse.queryFilter(OevAuctionHouseFilter, currentBlock - 10, currentBlock);
        resolve(awardEvent[0].args[3]);
        break;
      }
      // Sleep for 0.1 second
      await new Promise((r) => setTimeout(r, 100));
    }
  });

  const updateTx = await performOevUpdate(awardedTransaction);

  const reportTx = await reportFulfillment(updateTx, bidTopic, bidDetails, bidId);
};

const performOevUpdate = async (awardedTransaction) => {
  const CHAIN_ID = process.env.CHAIN_ID ?? "5000"; // Default: Mantle Mainnet
  const BID_AMOUNT = process.env.BID_AMOUNT ?? "0.000001"; // Default: 0.000001 MNT

  const OevSearcherMulticallV1Artifact = await hre.artifacts.readArtifact("OevSearcherMulticallV1");

  const targetNetworkProvider = new JsonRpcProvider(process.env.TARGET_NETWORK_RPC_URL);
  const targetNetworkWallet = Wallet.fromPhrase(process.env.MNEMONIC).connect(targetNetworkProvider);
  const OevSearcherMulticallV1 = new Contract(
    deployments.OevSearcherMulticallV1,
    OevSearcherMulticallV1Artifact.abi,
    targetNetworkWallet
  );

  const updateTx = await OevSearcherMulticallV1.externalMulticallWithValue(
    [api3Contracts.deploymentAddresses.Api3ServerV1[CHAIN_ID]], // Targets: [Contract Addresses] The contract that can update the price feed
    [awardedTransaction], // Data: [encoded functions] The transaction details with signature and data that allows us to update the price feed
    [parseEther(BID_AMOUNT)], // Value: [Value sent] The matching bid amount that you bid on the OEV network (must match or update will fail)
    {
      value: parseEther(BID_AMOUNT), // Passing the value on the transaction
    }
  );
  await updateTx.wait();
  console.log("Oracle update performed");
  return updateTx;
};

const reportFulfillment = async (updateTx, bidTopic, bidDetails, bidId) => {
  const oevNetworkProvider = new JsonRpcProvider(process.env.OEV_NETWORK_RPC_URL);
  const oevNetworkWallet = Wallet.fromPhrase(process.env.MNEMONIC).connect(oevNetworkProvider);
  const OevAuctionHouseArtifact = await hre.artifacts.readArtifact("OevAuctionHouse");
  const OevAuctionHouse = new Contract(
    api3Contracts.deploymentAddresses.OevAuctionHouse["4913"],
    OevAuctionHouseArtifact.abi,
    oevNetworkWallet
  );
  const bidDetailsHash = keccak256(bidDetails);

  const reportTx = await OevAuctionHouse.reportFulfillment(
    bidTopic, // The bid topic of the auctioneer instance
    bidDetailsHash, // Hash of the bid details
    updateTx.hash // The transaction hash of the update transaction
  );
  await reportTx.wait();
  console.log("Oracle update reported");

  const confirmedFulfillmentTx = await new Promise(async (resolve, reject) => {
    console.log("Waiting for confirmation of fulfillment...");
    const OevAuctionHouseFilter = OevAuctionHouse.filters.ConfirmedFulfillment(null, bidTopic, bidId, null, null);
    while (true) {
      const currentBlock = await oevNetworkProvider.getBlockNumber();
      const confirmEvent = await OevAuctionHouse.queryFilter(OevAuctionHouseFilter, currentBlock - 10, currentBlock);
      if (confirmEvent.length > 0) {
        console.log("Confirmed Fulfillment", confirmEvent[0].transactionHash);
        resolve(confirmEvent);
        break;
      }
      // Sleep for 0.1 second
      await new Promise((r) => setTimeout(r, 100));
    }
  });

  return confirmedFulfillmentTx;
};

placeBid();
