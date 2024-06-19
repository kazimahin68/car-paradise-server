const express = require("express");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.static("public"));
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  verifyJWT.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decode = decode;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qhxef8v.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    const userCollection = carParadise.collection("userCollection");

    // JWT
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1hr",
      });
      res.send(token);
    });

    // User related API
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exist" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });


    app.get("/users", async(req, res) => {
      const result = await carCollection.find().toArray();
      res.send(result)
    })

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.patch("/users/:email", async (req, res) => {
      const email = req.params.email;
      const updateData = req.body;
      const result = await userCollection.updateOne({email: email}, {$set: updateData}, {upsert: true})
      res.send(result)

    });

    // Cars API

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
      const result = await carCollection.updateOne(
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


app.get("/", (req, res) => {
    res.send("Car Paradise Server is Running")
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
