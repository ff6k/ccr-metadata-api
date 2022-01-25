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

const CCR_CONTRACT = new web3.eth.Contract(CCR_ABI, CCR_CONTRACT_ADDRESS);
// const CRC_CONTRACT = new web3.eth.Contract(CRC_ABI, CRC_CONTRACT_ADDRESS);

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

const initCRCClaimListener = () => {
  // Set provider for all later instances to use
  Web3EthContract.setProvider(PROVIDER);
  const CRC_CONTRACT = new Web3EthContract(CRC_ABI, CRC_CONTRACT_ADDRESS);
  CRC_CONTRACT.events.Claim(async (error, events) => {
    // try {
    //   console.log("claim event")
    //   const { tonsCO2, claimer, URLmemo } = events.returnValues;
    //   let artHash, metaHash;
    //   while (true) {
    //     let temp = await uploadArtImage(claimer, URLmemo, tonsCO2);
    //     if (temp) {
    //       artHash = temp; break;
    //     }
    //     continue;
    //   }

    //   while (true) {
    //     let temp = await uploadMetaJson(claimer, URLmemo, tonsCO2, artHash);
    //     if (temp) {
    //       metaHash = temp; break;
    //     }
    //     continue;
    //   }
    //   const tokenURI = `ipfs://${metaHash}`
    //   await mintCCRToken("0x2d0852bE35a8b4e4Ff7e88D69d9e9abF98859b7D", claimer, URLmemo, tonsCO2, tokenURI);
    //   console.log('token minted'); return;
    // } catch (e) {
    //   console.log(e)
    // }
  }).on('data', (e) => {
    try {
      console.log("claim event")
      const { tonsCO2, claimer, URLmemo } = e.returnValues;
      let artHash, metaHash;
      while (true) {
        let temp = await uploadArtImage(claimer, URLmemo, tonsCO2);
        if (temp) {
          artHash = temp; break;
        }
        continue;
      }

      while (true) {
        let temp = await uploadMetaJson(claimer, URLmemo, tonsCO2, artHash);
        if (temp) {
          metaHash = temp; break;
        }
        continue;
      }
      const tokenURI = `ipfs://${metaHash}`
      await mintCCRToken("0x2d0852bE35a8b4e4Ff7e88D69d9e9abF98859b7D", claimer, URLmemo, tonsCO2, tokenURI);
      console.log('token minted'); return;
    } catch (e) {
      console.log(e)
    }
  })
    .on('error', (e) => {
      initCRCClaimListener();
      console.log('--ClaimEvent--Error');
    })
}

const btoa = (text) => {
  return Buffer.from(text, 'binary').toString('base64');
};

const mintCCRToken = async (tokenOwner, claimer, URLmemo, tonsCO2, tokenURI) => {
  const [account] = await web3.eth.getAccounts();
  const nonce = await web3.eth.getTransactionCount(account) + 1
  const accountNonce = '0x' + (nonce).toString(16);

  await CCR_CONTRACT.methods.mintCCR(tokenOwner, tonsCO2, claimer, URLmemo, tokenURI)
    .send({
      from: account,
      nonce: accountNonce
    })
  console.log("received res")

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
            "trait_type": "URLMemo",
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
    console.log("[[[]", error);
    return null;
  }
}

initCRCClaimListener();

app.listen(app.get("port"), function () {
  console.log("Node app is running on port", app.get("port"));
})



// app.get("/ipfs/upload_image", async function (req, res) {
//   try {
//     const ipfs = await IPFS.create();
//     const multihash = await ipfs.object.new('unixfs-dir')
//     // const cid = await ipfs.object.patch.setData(multihash, "asdasdasldjaskld");
//     // console.log(cid)

//     const node = await ipfs.object.get(multihash);
//     const cid = await ipfs.object.patch.addLink(node, {
//       name: 'QmPTkMuuL6PD8L2SwTwbcs1NPg14U8mRzerB1ZrrBrkSDD',
//       size: 10,
//       cid: new IPFS.CID('Qmef7ScwzJUCg1zUSrCmPAz45m8uP5jU7SLgt2EffjBmbL')
//     })
//     console.log(cid)
//     // const cid = await ipfs.object.patch.appendData(multihash, new Buffer('more data'))
//     // console.log(cid)
//     // const links = await ipfs.object.links(multihash)
//     // const hashes = links.map((link) => link.Hash.toString())
//     // console.log(hashes)
//     // const obj = {
//     //   Data: new Buffer('Some data'),
//     //   Links: []
//     // }
//     // const cid = await ipfs.object.put(obj)
//     // const node = await ipfs.object.get("QmdfTbBqBPQ7VNxZEYEj14VmRuZBkqFbiwReogJgS1zR1n")
//     // console.log(node.data)
//     // const { cid } = await ipfs.add('Hello world')
//     // console.info(cid)
//     // const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;
//     // axios
//     //   .post(url, {
//     //     pinataOptions: {
//     //       wrapWithDirectory: true
//     //     },
//     //     pinataMetadata: {
//     //       name: 'ItemStatus',
//     //       keyvalues: {
//     //         ItemID: 'bbb',
//     //         CheckpointID: 'Checkpoint002',
//     //         Source: 'CompanyA',
//     //         WeightInKilos: 5.25
//     //       }
//     //     },
//     //     pinataContent: {
//     //       itemName: 'exampleItemName',
//     //       inspectedBy: 'Inspector001',
//     //       dataValues: [
//     //         {
//     //           ItemID: 'bbbb',
//     //           CheckpointID: 'Checkpoint002',
//     //           Source: 'CompanyA',
//     //           WeightInKilos: 5.25
//     //         }
//     //       ]
//     //     }
//     //   }, {
//     //     headers: {
//     //       pinata_api_key: 'aeeadf412d71efb3c6fc',
//     //       pinata_secret_api_key: '7314ead172b06da4ec58916f600db16dd9dd4d73c673d7f205065aa47dd4dede',
//     //       path: "metadata"
//     //     }
//     //   })
//     //   .then(function (response) {
//     //     console.log("respose", response)
//     //     res.send(response);
//     //     //handle response here
//     //   })
//     //   .catch(function (error) {
//     //     console.log("error", error)
//     //     res.send(error);
//     //     //handle error here
//     //   });
//     // let data = new FormData();
//     // // console.log(fs.createReadStream('./ipfs.txt'));
//     // data.append('file', fs.createReadStream('./yourfile.png'));

//     // const metadata = JSON.stringify({
//     //   name: 'testname',
//     //   keyvalues: {
//     //     exampleKey: 'exampleValue'
//     //   }
//     // });
//     // data.append('pinataMetadata', metadata);

//     // const pinataOptions = JSON.stringify({
//     //   cidVersion: 0,
//     //   customPinPolicy: {
//     //     regions: [
//     //       {
//     //         id: 'FRA1',
//     //         desiredReplicationCount: 1
//     //       },
//     //       {
//     //         id: 'NYC1',
//     //         desiredReplicationCount: 2
//     //       }
//     //     ]
//     //   }
//     // });

//     // data.append('pinataOptions', pinataOptions);

//     // // console.log(data);

//     // axios
//     //   .post(url, data, {
//     //     maxBodyLength: 'Infinity', //this is needed to prevent axios from erroring out with large files
//     //     headers: {
//     //       'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
//     //       pinata_api_key: 'aeeadf412d71efb3c6fc',
//     //       pinata_secret_api_key: '7314ead172b06da4ec58916f600db16dd9dd4d73c673d7f205065aa47dd4dede'
//     //     }
//     //   })
//     //   .then(function (response) {
//     //     res.send(response);
//     //     //handle response here
//     //   })
//     //   .catch(function (error) {
//     //     res.send(error);
//     //     // console.log(error)
//     //     //handle error here
//     //   });
//   } catch (error) {
//     console.log(error);
//     console.log("==============asdasdsad")
//     // console.log(error);
//   }
// })

// crc_contract.getPastEvents('Transfer', function (error, events) {
//   console.log(events);
//   console.log(error);
// }).then(function (events) {
//   console.log("events:", events);
// })

// app.get("/ipfs_hash_data", async function (req, res) {
//   try {
//     let hash_data = await fs.readFileSync(`${__dirname}/ipfs.txt`, 'utf8');
//     res.send(hash_data);
//   } catch (error) {
//     res.status(500).send("Server Error");
//   }
// })

// app.get("/api/token/:token_id", async function (req, res) {
//   try {
//     const tokenId = parseInt(req.params.token_id).toString();
//     const claimer = await contract.methods.tokenClaimer(tokenId).call();
//     const tonsCO2 = await contract.methods.tokenTonsCO2(tokenId).call();
//     const urlMemo = await contract.methods.tokenURLAndMemo(tokenId).call();
//     let hash_data = await fs.readFileSync(`${__dirname}/ipfs.txt`, 'utf8');
//     hash_data = JSON.parse(hash_data);
//     const IPFS_HASH = hash_data[CONTRACT_ADDRESS];
//     if(!IPFS_HASH) IPFS_HASH = {};
//     if (!IPFS_HASH[tokenId]) {
//       const ipfsArray = [];
//       const date = await contract.methods.tokenTimeStamp(tokenId).call();
//       const mintDate = (new Date(date * 1000)).toLocaleDateString();
//       const image = artImage({ claimer, urlMemo, mintDate, tonsCO2 });
//       ipfsArray.push({
//         path: `images/${tokenId}.svg`,
//         content: btoa(image)
//       })
//       const results = await axios.post("https://deep-index.moralis.io/api/v2/ipfs/uploadFolder",
//         ipfsArray,
//         {
//           headers: {
//             "X-API-KEY": 'H3fVuMfmzdzUloT47ASDQWRfkaS1Lhg5o4iGqslch2jWftrHYRS0HaYRlogdz2QI',
//             "Content-Type": "application/json",
//             "accept": "application/json"
//           }
//         }
//       )
//       const [result] = results.data;
//       let { path } = result;
//       path = ((path.split("ipfs/"))[1].split("/images"))[0];
//       if (!hash_data[CONTRACT_ADDRESS]) hash_data[CONTRACT_ADDRESS] = {};
//       hash_data[CONTRACT_ADDRESS][tokenId] = path;
//       await fs.writeFileSync(`${__dirname}/ipfs.txt`, JSON.stringify(hash_data));
//     }
// const data = {
//   "name": "Certificate of Carbon Removal",
//   "description": "Record of Carbon Removal Credits (CRC) claimed",
//   "external_url": "https://www.carbonlandtrust.com/",
//   "attributes": [
//     {
//       "trait_type": "Claimer",
//       "value": claimer
//     },
//     {
//       "trait_type": "TonsCO2",
//       "value": tonsCO2
//     },
//     {
//       "trait_type": "URLMemo",
//       "value": urlMemo
//     }
//   ],
//   "image": IPFS_HASH[tokenId] ? `ipfs://${IPFS_HASH[tokenId]}/images/${tokenId}.svg` : ""
// }
//     res.send(data);
//   } catch (error) {
//     console.log(error);
//     res.status(500).send("Server Error");
//   }
// })

// app.get("/api/ipfs_hash", function (req, res) {
//   res.send(IPFS_HASH);
// })

// app.get("/api/tokenImage", async function (req, res) {
//   try {
//     const ipfsArray = [];
//     const { claimer, urlMemo, mintDate, tonsCO2 } = req.query;
//     const image = artImage({ claimer, urlMemo, mintDate, tonsCO2 });
//     const tokenId = await contract.methods.totalSupply().call();
//     ipfsArray.push({
//       path: `images/${tokenId}.svg`,
//       content: btoa(image)
//     })
//     const results = await axios.post("https://deep-index.moralis.io/api/v2/ipfs/uploadFolder",
//       ipfsArray,
//       {
//         headers: {
//           "X-API-KEY": 'H3fVuMfmzdzUloT47ASDQWRfkaS1Lhg5o4iGqslch2jWftrHYRS0HaYRlogdz2QI',
//           "Content-Type": "application/json",
//           "accept": "application/json"
//         }
//       }
//     )
//     const [result] = results.data;
//     let { path } = result;
//     path = ((path.split("ipfs/"))[1].split("/images"))[0];
//     let hash_data = await fs.readFileSync(`${__dirname}/ipfs.txt`, 'utf8');
//     hash_data = JSON.parse(hash_data);
//     if (!hash_data[CONTRACT_ADDRESS]) hash_data[CONTRACT_ADDRESS] = {};
//     hash_data[CONTRACT_ADDRESS][tokenId] = path;
//     await fs.writeFileSync(`${__dirname}/ipfs.txt`, JSON.stringify(hash_data));
//     res.send(results.data);
//   } catch (error) {
//     console.log(error);
//     res.status(500).send("Server Error");
//   }
// })

