# saiterm
Saiterm Smart Contract

# install required modules
npm install

# test smart contract
truffe test

# deploy smart contract

# flatten all classes
truffle-flattener contracts/SaiexSale.sol   > flats/SaiexSale.sol

# copy&paste content of flats/SaiexSale.sol
https://remix.ethereum.org/

# deploy both contracts 

1) SaiexToken

totalAmount: 100000000000000000000000000

saleAmount: 50000000000000000000000000

_fundAmount: 50000000000000000000000000

_fundWallet: 0x123... # fund wallet


2) SaiexCrowdsale

_openingTime: 1543622400  # 2018-12-01 00:00:00

_closingTime: 1557446400  # 2019-05-10 00:00:00

_rate: 100                # USD/ETH rate

_fundWallet: 0x123        # fund wallet

_token:  0x6789..         # SaiexToken address

_timeBonus: [1547510400,130,1549238400,125,1550966400,120,1552262400,115,1553558400,110,1554854400,105,0,100]

_amountBonus: 

["50000000000000000000000",120,"25000000000000000000000",115,"500000000000000000000",110,0,100]



