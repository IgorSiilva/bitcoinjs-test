const bitcoin = require("bitcoinjs-lib");
const bip39 = require("bip39");
var crypto = require("crypto");
const axios = require("axios");
const bip65 = require("bip65");
let coinSelect = require("coinselect");

const fetchAddressCollectionStats = async (node) => {
  const baseUrl = "https://blockstream.info/testnet/api";

  let gap = 0;
  let addressIndex = 0;
  let balance = 0;
  let pendingBalance = 0;
  let addresses = [];
  let addressesWithUtxo = [];
  let nextUnusedAddress;
  while (gap < 20) {
    const childNode = node.derive(addressIndex);
    /*     const { address } = bitcoin.payments.p2wpkh({
      pubkey: childNode.publicKey,
      network: bitcoin.networks.testnet,
    }); */

    const { address } = bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({
        pubkey: childNode.publicKey,
        network: bitcoin.networks.testnet,
      }),
      network: bitcoin.networks.testnet,
    });

    const addressStats = await axios.get(`${baseUrl}/address/${address}`);

    console.log(addressStats.data);

    const { chain_stats, mempool_stats } = addressStats.data;

    const isUsedAddress =
      chain_stats.funded_txo_count > 0 ||
      chain_stats.spent_txo_count > 0 ||
      mempool_stats.funded_txo_count > 0 ||
      mempool_stats.spent_txo_count > 0;

    const addressBalance =
      chain_stats.funded_txo_sum - chain_stats.spent_txo_sum;

    balance += addressBalance;
    pendingBalance +=
      mempool_stats.funded_txo_sum - mempool_stats.spent_txo_sum;

    const addressMetadata = {
      address: address,
      derivationPath: `${node.index}/${addressIndex}`,
      publicKey: childNode.publicKey,
    };

    addresses.push(addressMetadata);

    if (addressBalance > 0) {
      addressesWithUtxo.push(addressMetadata);
    }

    if (!isUsedAddress && !nextUnusedAddress) {
      nextUnusedAddress = addressMetadata;
    }

    if (!isUsedAddress) {
      gap++;
    } else {
      gap = 0;
    }

    addressIndex++;
  }

  return {
    balance,
    pendingBalance,
    addresses,
    addressesWithUtxo,
    nextUnusedAddress: nextUnusedAddress,
  };
};

const fetchUtxos = async (addressesWithUtxo = []) => {
  const totalUtxos = [];
  const baseUrl = "https://blockstream.info/testnet/api";
  for (const addressWithUtxo of addressesWithUtxo) {
    const res = await axios.get(
      `${baseUrl}/address/${addressWithUtxo.address}/utxo`
    );

    const utxos = res.data;

    for (const utxo of utxos) {
      totalUtxos.push({
        ...utxo,
        address: addressWithUtxo.address,
        derivationPath: addressWithUtxo.derivationPath,
      });
    }
  }

  return totalUtxos;
};

const fetchWalletStats = async (masterPublicKey) => {
  const hdNode = bitcoin.bip32.fromBase58(
    masterPublicKey,
    bitcoin.networks.testnet
  );
  const [addressesData, changeAddressesData] = await Promise.all([
    fetchAddressCollectionStats(hdNode.derive(0)),
    fetchAddressCollectionStats(hdNode.derive(1)),
  ]);

  const balance = addressesData.balance + changeAddressesData.balance;
  const pendingBalance =
    addressesData.pendingBalance + changeAddressesData.pendingBalance;
  const nextUnusedAddress = addressesData.nextUnusedAddress;
  const nextUnusedChangeAddress = changeAddressesData.nextUnusedAddress;
  const addresses = addressesData.addresses;
  const changeAddresses = changeAddressesData.addresses;
  const addressesWithUtxo = addressesData.addressesWithUtxo.concat(
    changeAddressesData.addressesWithUtxo
  );

  return {
    balance,
    pendingBalance,
    nextUnusedAddress,
    nextUnusedChangeAddress,
    addresses,
    changeAddresses,
    addressesWithUtxo,
  };
};

const findPublicKeyForAddress = (address, addressesMetadata) =>
  addressesMetadata.find(
    (addressMetadata) => address === addressMetadata.address
  ).publicKey;

const createTransaction = async (
  addressesWithUtxo = [],
  targetAddress,
  feeRate,
  changeAddress,
  mnemonic,
  masterPublicKey
) => {
  const utxos = await fetchUtxos(addressesWithUtxo);

  let { inputs, outputs, fee } = coinSelect(utxos, [targetAddress], feeRate);

  var bitcoinNetwork = bitcoin.networks.testnet;

  const seed = await bip39.mnemonicToSeed(mnemonic);
  const hdRoot = bitcoin.bip32.fromSeed(seed, bitcoinNetwork);

  if (!inputs || !outputs) {
    throw new Error("Not enough balance. Try sending a smaller amount.");
  }

  const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });
  const derivationPath = "m/84'/0'/0'";

  for (const input of inputs) {
    const inputPublicKey = findPublicKeyForAddress(
      input.address,
      addressesWithUtxo
    );

    if (!inputPublicKey) {
      throw new Error("Could not find public key for input");
    }

    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: inputPublicKey });

    psbt.addInput({
      hash: input.txid,
      index: input.vout,
      bip32Derivation: [
        {
          masterFingerprint: hdRoot.fingerprint,
          path: `${derivationPath}/${input.derivationPath}`,
          pubkey: inputPublicKey,
        },
      ],
      witnessUtxo: {
        script: p2wpkh.output,
        value: input.value,
      },
    });
  }

  for (const output of outputs) {
    if (!output.address) {
      output.address = changeAddress;
    }

    psbt.addOutput({
      address: output.address,
      value: output.value,
    });
  }

  await psbt.signAllInputsHDAsync(hdRoot);

  const transaction = psbt.finalizeAllInputs().extractTransaction();

  console.log(transaction.toHex());

  console.log(transaction);

  //return { transaction, utxos, targetAddress, fee };
};

async function generateWallet() {
  const mnemonic = bip39.generateMnemonic();

  const seed = await bip39.mnemonicToSeed(
    "idea auction predict senior clinic extra common holiday match happy afford distance"
  );

  var bitcoinNetwork = bitcoin.networks.testnet;

  var hdMaster = bitcoin.bip32.fromSeed(seed, bitcoinNetwork);

  //const child = hdMaster.derivePath("m/84'/0'/0'");

  var derivedNode = hdMaster.derivePath("m/84'/0'/0'").neutered();

  const masterPublicKey = derivedNode.toBase58();

  /*   const hdNode = bitcoin.bip32.fromBase58(masterPublicKey, bitcoinNetwork);

  const teste = await fetchAddressCollectionStats(hdNode.derive(0));
  const teste1 = await fetchAddressCollectionStats(hdNode.derive(1)); */
  const walletStatistics = await fetchWalletStats(masterPublicKey);

  const transactionMetadata = await createTransaction(
    walletStatistics.addressesWithUtxo,
    { address: "2N3ScVtHRYgz6qYmeKDAf3fmwJinV3xhRsy", value: 40000 },
    40,
    walletStatistics.nextUnusedChangeAddress.address,
    "idea auction predict senior clinic extra common holiday match happy afford distance",
    masterPublicKey
  );

  //const key = bitcoin.ECPair.fromWIF(key1.toWIF(), bitcoin.networks.testnet);

  //console.log(key1.toWIF());

  /*  const { address } = bitcoin.payments.p2sh({
    redeem: bitcoin.payments.p2wpkh({
      pubkey: key.publicKey,
      network: bitcoin.networks.testnet,
    }),
    network: bitcoin.networks.testnet,
  });

  console.log(address);

  const baseUrl = "https://blockstream.info/testnet/api";

  const utxosAddress = await axios.get(`${baseUrl}/address/${address}/utxo`);

  console.log(utxosAddress.data); */

  /*   let alice = bitcoin.ECPair.fromWIF(key1.toWIF(), bitcoin.networks.testnet);
  let bob = bitcoin.ECPair.fromWIF(
    "cMkopUXKWsEzAjfa1zApksGRwjVpJRB3831qM9W4gKZsLwjHXA9x",
    bitcoin.networks.testnet
  );

  let lockTime = bip65.encode({
    utc: new Date(new Date().toUTCString()) + 3600 * 3,
  });

  let redeemScript = cltvCheckSigOutput(alice, bob, lockTime);
  let scriptPubKey = bitcoin.script.scriptHash.output.encode(
    bitcoin.crypto.hash160(redeemScript)
  );
  console.log(
    bitcoin.address.fromOutputScript(scriptPubKey, bitcoin.networks.testnet)
  ); */

  /* 
  const { address } = bitcoin.payments.p2sh({
    redeem: bitcoin.payments.p2wpkh({
      pubkey: child.publicKey,
      network: bitcoin.networks.testnet,
    }),
    network: bitcoin.networks.testnet,
  });

  console.log(address); */

  /*   const derivedNode = hdMaster.derivePath("m/84'/0'/0'").neutered();
  const masterPublicKey = derivedNode.toBase58();

  const hdNode = bitcoin.bip32.fromBase58(masterPublicKey, bitcoinNetwork);

  const childNode1 = hdNode.derive(0).derive(0);
  const childNode2 = hdNode.derive(1).derive(1);

  const { address } = bitcoin.payments.p2wpkh({
    pubkey: childNode1.publicKey,
  });

  console.log(address);

  const res = await axios.get(`${baseUrl}/address/${address}`);

  console.log(res.data); */
}

generateWallet();

//console.log(seed);

//let keypair = bitcoin.ECPair.makeRandom({ network: testnet });
/* bitcoin.bip32;
console.log(keypair); */
