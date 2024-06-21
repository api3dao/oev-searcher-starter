# OEV Searcher Starter

>   An Example project to demonstrate how to use the OEV Network to place bids on dAPI proxies and then update those proxies using the encoded data from the OEV Network.

## Instructions

### Install dependencies

- Create a `.env` file similar to `example.env`. The scripts work with mantle mainnet by default, but you can change the network to any of the networks supported by the [API3 Market](market.api3.org).

```bash
yarn
```
### Deploy the Multicall contract

- Deploy a multicall contract on the target chain. The multicall contract is used to perform the oracle update and any other subsequent calls in a single transaction. You can use the `deploy-multicall` script to deploy the contract.
```bash
yarn deploy-multicall
```

### Bridge and Deposit

- Bridge ETH to the OEV Network using the [OEV Network bridge](https://oev-network.bridge.caldera.xyz/)

- After Bridging ETH to the OEV Network, deposit ETH to the `OevAuctionHouse` contract. Use the `deposit-collateral` script to deposit ETH to the contract.

```bash
yarn deposit-collateral
```

Note: The script deposits `0.00001` ETH to the contract. You can change the amount by passing the `AMOUNT` environment variable.

```
AMOUNT=0.1 yarn deposit-collateral 
```

### Place Bid and Update dAPI Proxy

- You can now place bid, retrieve the encoded data and update the dAPI proxy using the `submit-bid-update` script. The script also reports the fulfillment of the oracle update which is required to release the collateral.

```bash
yarn submit-bid-update
```

- The script places a bid of `.000001` MNT on the condition that the price of MNT is less than or equal to `5`. This condition is immediately satisfied upon placing the bid and the bid gets immediately rewarded with the encoded OEV update transaction details. The update transaction details are then used to update the dAPI proxy. 

- You can change the bid amount, proxy address, chain id, bid condition and bid price by passing the respective environment variables. For example to update the [ETH/USD dAPI proxy](https://market.api3.org/mode/eth-usd/integrate) on Mantle mainnet with a bid amount of `0.00001` MNT, a bid condition of `LTE` and a bid price of `4000`, you can run the following command:

```
BID_AMOUNT=0.00001 PROXY_ADDRESS=0xa47Fd122b11CdD7aad7c3e8B740FB91D83Ce43D1 CHAIN_ID=5000 BID_CONDITION=LTE BID_PRICE=4000 yarn submit-bid-update
```

Note: Make sure the multicall contract is deployed on the target chain before running the script.