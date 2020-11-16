const bitcoin = require("bitcoinjs-lib");
const bip39 = require("bip39");
var crypto = require("crypto");
const axios = require("axios");

async function generateWallet() {
  const mnemonic = bip39.generateMnemonic();

  const seed = await bip39.mnemonicToSeed(mnemonic);

  //console.log(mnemonic);

  var bitcoinNetwork = bitcoin.networks.testnet;
  var hdMaster = bitcoin.bip32.fromSeed(seed, bitcoinNetwork);
  var derivedNode = hdMaster.derivePath("m/84'/0'/0'").neutered();
  const masterPublicKey = derivedNode.toBase58();

  const hdNode = bitcoin.bip32.fromBase58(
    masterPublicKey,
    bitcoin.networks.testnet
  );

  const childNode = hdNode.derive(0);

  const { address } = bitcoin.payments.p2sh({
    redeem: bitcoin.payments.p2wpkh({
      pubkey: childNode.publicKey,
      network: bitcoin.networks.testnet,
    }),
    network: bitcoin.networks.testnet,
  });

  console.log(address);
  /* var key1 = hdMaster.derivePath("m/0");
  var key2 = hdMaster.derivePath("m/1");
 */
  //console.log(key1.toWIF());
  //console.log(key2.toWIF());

  //const key = bitcoin.ECPair.fromPrivateKey(key1);

  //console.log(key.publicKey());

  //const key = bitcoin.ECPair.fromWIF(key1.toWIF(), bitcoin.networks.testnet);

  //console.log(bitcoin.bip32.fromBase58(key.publicKey));

  //console.log(key.);

  /*   const { address } = bitcoin.payments.p2sh({
    redeem: bitcoin.payments.p2wpkh({ pubkey: key.publicKey }),
  }); */

  /*   const { address } = bitcoin.payments.p2pkh({
    pubkey: key.publicKey,
    network: bitcoin.networks.testnet,
  }); */

  //console.log(address);

  /*   const baseUrl = "https://blockstream.info/testnet/api";
  const myAddress = "mvk9UjVXrZZEVbCBBTxBvPaWVRCxWAujsB";

  const res = await axios.get(`${baseUrl}/address/${myAddress}`);

  const walletInfo = res.data; */
  //console.log(walletInfo);

  /* const { chain_stats, mempool_stats } = walletInfo;

  let balance = 0;
  let pendingBalance = 0;

  const addressBalance = chain_stats.funded_txo_sum - chain_stats.spent_txo_sum;

  balance += addressBalance;
  pendingBalance += mempool_stats.funded_txo_sum - mempool_stats.spent_txo_sum;

  console.log({
    balance,
    pendingBalance,
  });

  const utxosAddress = await axios.get(`${baseUrl}/address/${myAddress}/utxo`);

  const hdNode = bitcoin.bip32.fromBase58(key1);

  const [addressesData, changeAddressesData] = await Promise.all([
    this.fetchAddressCollectionStats(hdNode.derive(0)),
    this.fetchAddressCollectionStats(hdNode.derive(1)),
  ]);

  console.log(addressesData); */
  //console.log(utxosAddress.data);

  /*   const totalUtxos = [];

  const utxos = utxosAddress.data;

  for (const utxo of utxos) {
    totalUtxos.push({
      ...utxo,
      address: addressWithUtxo.address,
      derivationPath: addressWithUtxo.derivationPath,
    });
  }

  console.log(utxos); */
}

generateWallet();

//console.log(seed);

//let keypair = bitcoin.ECPair.makeRandom({ network: testnet });
/* bitcoin.bip32;
console.log(keypair); */
