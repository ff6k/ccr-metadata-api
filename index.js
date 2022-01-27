const express = require("express")
const path = require("path")
const fs = require("fs");
const { CCR_CONTRACT_ADDRESS, CRC_CONTRACT_ADDRESS, PROVIDER } = require("./src/constants")
const { CCR_ABI } = require('./src/ccr_abi.js')
const { CRC_ABI } = require('./src/crc_abi.js')
const cors = require('cors');
const Web3EthContract = require('web3-eth-contract');
const { artImage } = require('./src/art_image');
const axios = require('axios');
const Web3WsProvider = require('web3-providers-ws');
const HDWalletProvider = require("truffle-hdwallet-provider");
const Web3 = require('web3');

const connectionProvider = new Web3WsProvider(PROVIDER);
const zeroExPrivateKeys = ["3a30f6a3d4dee81eacc917782b58f40c9d2846251866d35c2180e83ea94982d9"];

const walletProvider = new HDWalletProvider(zeroExPrivateKeys, connectionProvider);
const web3 = new Web3(walletProvider);

const corsOpts = {
  origin: '*',
  methods: [
    'GET',
    'POST',
  ],

  allowedHeaders: [
    'Content-Type',
  ],
};

const PORT = process.env.PORT || 5000

const app = express()
  .set("port", PORT)
  .set("views", path.join(__dirname, "views"))
  .set("view engine", "ejs")

app.use(cors(corsOpts));

// Static public files
app.use(express.static(path.join(__dirname, "public")))

const initCRCClaimListener = () => {
  // Set provider for all later instances to use
  Web3EthContract.setProvider(PROVIDER);
  const CRC_CONTRACT = new Web3EthContract(CRC_ABI, CRC_CONTRACT_ADDRESS);
  CRC_CONTRACT.events.Claim(async (error, events) => {
    try {
      console.log("claim event")
      const { tonsCO2, claimer, claimerMemo, tokenOwner } = events.returnValues;
      let artHash, metaHash;
      while (true) {
        let temp = await uploadArtImage(claimer, claimerMemo, tonsCO2);
        if (temp) {
          artHash = temp; break;
        }
        continue;
      }

      while (true) {
        let temp = await uploadMetaJson(claimer, claimerMemo, tonsCO2, artHash);
        if (temp) {
          metaHash = temp; break;
        }
        continue;
      }
      const tokenURI = `ipfs://${metaHash}`
      await mintCCRToken(tokenOwner, claimer, claimerMemo, tonsCO2, tokenURI);
      console.log('token minted'); return;
    } catch (e) {
      console.log(e)
    }
  }).on('error', (e) => {
    initCRCClaimListener();
    console.log('--ClaimEvent--Error');
  })
}

const btoa = (text) => {
  return Buffer.from(text, 'binary').toString('base64');
};

const mintCCRToken = async (tokenOwner, claimer, URLmemo, tonsCO2, tokenURI) => {
  const CCR_CONTRACT = new web3.eth.Contract(CCR_ABI, CCR_CONTRACT_ADDRESS);
  const [account] = await web3.eth.getAccounts();
  const nonce = await web3.eth.getTransactionCount(account)
  const accountNonce = '0x' + (nonce).toString(16);
  return CCR_CONTRACT.methods.mintCCR(tokenOwner, tonsCO2, claimer, URLmemo, tokenURI)
    .send({
      from: account,
      nonce: accountNonce
    })
}

const uploadArtImage = async (claimer, urlMemo, tonsCO2) => {
  try {
    const ipfsArray = [];
    const mintDate = (new Date()).toLocaleDateString();
    const image = artImage({ claimer, urlMemo, mintDate, tonsCO2 });
    ipfsArray.push({
      path: `art.svg`,
      content: btoa(image)
    })

    const results = await axios.post("https://deep-index.moralis.io/api/v2/ipfs/uploadFolder",
      ipfsArray,
      {
        headers: {
          "X-API-KEY": 'H3fVuMfmzdzUloT47ASDQWRfkaS1Lhg5o4iGqslch2jWftrHYRS0HaYRlogdz2QI',
          "Content-Type": "application/json",
          "accept": "application/json"
        }
      }
    )
    const [pathArray] = results.data;
    let { path } = pathArray;
    console.log("uploaded art image", path);

    return (path.split("ipfs/"))[1];
  } catch (error) {
    console.log(error);
    return null;
  }
}

const uploadMetaJson = async (claimer, urlMemo, tonsCO2, artHash) => {
  try {
    const ipfsArray = [];
    ipfsArray.push({
      path: `metadata.json`,
      content: {
        "name": "Certificate of Carbon Removal",
        "description": "Record of Carbon Removal Credits (CRC) claimed",
        "external_url": "https://www.carbonlandtrust.com/",
        "attributes": [
          {
            "trait_type": "Claimer",
            "value": claimer
          },
          {
            "trait_type": "TonsCO2",
            "value": tonsCO2
          },
          {
            "trait_type": "ClaimerMemo",
            "value": urlMemo
          }
        ],
        "image": `ipfs://${artHash}`
      }
    })

    const results = await axios.post("https://deep-index.moralis.io/api/v2/ipfs/uploadFolder",
      ipfsArray,
      {
        headers: {
          "X-API-KEY": 'H3fVuMfmzdzUloT47ASDQWRfkaS1Lhg5o4iGqslch2jWftrHYRS0HaYRlogdz2QI',
          "Content-Type": "application/json",
          "accept": "application/json"
        }
      }
    )
    const [pathArray] = results.data;
    let { path } = pathArray;
    console.log("uploaded meta json", path);

    return (path.split("ipfs/"))[1];
  } catch (error) {
    return null;
  }
}

initCRCClaimListener();

app.listen(app.get("port"), function () {
  console.log("Node app is running on port", app.get("port"));
})