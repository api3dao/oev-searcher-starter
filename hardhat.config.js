require('@nomicfoundation/hardhat-toolbox');

const {
  api3Chains: { hardhatConfig },
} = require('@api3/dapi-management');
require('dotenv').config();

module.exports = {
  networks: hardhatConfig.networks(),
  solidity: {
    version: '0.8.17',
  },
};