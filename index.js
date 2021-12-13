const express = require("express")
const path = require("path")
const { CONTRACT_ADDRESS, PROVIDER, HOST_URL } = require("./src/constants")
const { ABI } = require('./src/abi.js')
const cors = require('cors');
const Web3EthContract = require('web3-eth-contract');
const { artImage } = require('./src/art_image');
const axios = require('axios');

let IPFS_HASH = [];

// Set provider for all later instances to use
Web3EthContract.setProvider(PROVIDER);

const contract = new Web3EthContract(ABI, CONTRACT_ADDRESS);

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

app.get("/", function (req, res) {
  res.send("Get ready for OpenSea!");
})

app.get("/api/token/:token_id", async function (req, res) {
  try {
    const tokenId = parseInt(req.params.token_id).toString();
    const claimer = await contract.methods.tokenClaimer(tokenId).call();
    const tonsCO2 = await contract.methods.tokenTonsCO2(tokenId).call();
    const urlMemo = await contract.methods.tokenURLAndMemo(tokenId).call();

    const data = {
      "name": "Certificate of Carbon Removal",
      "description": "CCR full desription",
      "external_url": "https://carboncapturebackers.com/",
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
          "trait_type": "URLMemo",
          "value": urlMemo
        }
      ],
      "image": IPFS_HASH[tokenId] ? `ipfs://${IPFS_HASH[tokenId]}/images/${tokenId}.svg` : ""
    }
    res.send(data);
  } catch (error) {
    res.status(500).send("Server Error");
  }
})

app.get("/api/ipfs_hash", function (req, res) {
  res.send(IPFS_HASH);
})

const btoa = (text) => {
  return Buffer.from(text, 'binary').toString('base64');
};

app.get("/api/tokenImage", async function (req, res) {
  try {
    const ipfsArray = [];
    const { claimer, urlMemo, mintDate, tonsCO2 } = req.query;
    const image = artImage({ claimer, urlMemo, mintDate, tonsCO2 });
    const tokenId = await contract.methods.totalSupply().call();
    ipfsArray.push({
      path: `images/${tokenId}.svg`,
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
    const [result] = results.data;
    let { path } = result;
    path = ((path.split("ipfs/"))[1].split("/images"))[0];
    IPFS_HASH[tokenId] = path;
    res.send(results.data);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
})

app.listen(app.get("port"), function () {
  console.log("Node app is running on port", app.get("port"));
})
