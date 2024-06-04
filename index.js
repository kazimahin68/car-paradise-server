const express = require("express");
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const app = express();
const port =process.env.PORT || 5000;



app.use(cors());
app.use(express.json());

const uri =
  `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qhxef8v.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const carParadise = client.db("carParadise");
    const carCollection = carParadise.collection("carCollection");

    app.get("/cars", async (req, res) => {
      const carsData = carCollection.find();
      const result = await carsData.toArray();
      res.send(result);
    });
    app.get("/cars/:id", async (req, res) => {
      const id = req.params.id;
      const result = await carCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.post("/cars", async (req, res) => {
      const addCar = req.body;
      const result = await carCollection.insertOne(addCar);
      res.send(result);
    });

    app.delete("/cars/:id", async (req, res) => {
      const id = req.params.id;
      const result = await carCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });
    app.patch("/cars/:id", async (req, res) => {
      const id = req.params.id;
      const updateData = req.body;
      const result = carCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
      res.send(result);
    });
    console.log("Server is Connected");
  } finally {
    // await client.close();
  }
}
run().catch(console.log);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
