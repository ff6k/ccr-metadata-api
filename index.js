const express = require("express")
const path = require("path")
const { CONTRACT_ADDRESS, PROVIDER, HOST_URL } = require("./src/constants")
const { ABI } = require('./src/abi.js')
const cors = require('cors');
const Web3EthContract = require('web3-eth-contract');
const { artImage } = require('./src/art_image');

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
    const timeStamp = await contract.methods.tokenTimeStamp(tokenId).call();
    const mintDate = (new Date(timeStamp * 1000)).toLocaleDateString();
    const imageURL = encodeURI(`${HOST_URL}/api/tokenImage/?claimer=${claimer}&urlMemo=${urlMemo}&mintDate=${mintDate}&tonsCO2=${tonsCO2}`);

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
      "image": imageURL
    }
    res.send(data);
  } catch (error) {
    res.status(500).send("Server Error");
  }
})

app.get("/api/tokenImage", async function (req, res) {
  try {
    const { claimer, urlMemo, mintDate, tonsCO2 } = req.query;
    res.send(artImage({ claimer, urlMemo, mintDate, tonsCO2 }));
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
})

app.listen(app.get("port"), function () {
  console.log("Node app is running on port", app.get("port"));
})
