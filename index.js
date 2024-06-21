const express = require("express");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(`${process.env.PAYMENT_SECRET}`);
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
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
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
    const cartItemCollection = carParadise.collection("cartItemCollection");
    const paymentCollection = carParadise.collection("paymentCollection");

    // JWT
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1hr",
      });
      res.send({ token });
    });

    // Verify Merchant :: TODO

    const verifyMerchant = async (req, res, next) => {
      const email = req.decoded.email;
      console.log(email);
      const query = { email: email };
      const user = await userCollection.findOne(query);
      console.log(user);
      if (user?.role !== "merchant") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

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

    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.patch("/users/:email", async (req, res) => {
      const email = req.params.email;
      const updateData = req.body;
      const result = await userCollection.updateOne(
        { email: email },
        { $set: updateData },
        { upsert: true }
      );
      res.send(result);
    });

    // Cars API

    app.get("/cars", async (req, res) => {
      // const email = req.query.email;
      // const decodedEmail = req.decoded;
      // if(email !== decodedEmail){
      //   return res.status(403).send({error: true, message: "forbidden access"})
      // }
      const carsData = carCollection.find();
      const result = await carsData.toArray();
      res.send(result);
    });

    //Public
    app.get("/cars/popular", async (req, res) => {
      const result = await carCollection
        .find({ status: "approved" })
        .sort({ sold: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // Get user cars(private)
    app.get("/cars/user/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { merchant_email: email };
      const result = await carCollection.find(query).toArray();
      res.send(result);
    });

    //Get car info for edit page(private)
    app.get("/cars/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const result = await carCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    //Add new car (Private)
    app.post("/cars", verifyJWT, async (req, res) => {
      const addCar = req.body;
      const result = await carCollection.insertOne(addCar);
      res.send(result);
    });

    //Delete car data (private)
    app.delete("/cars/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const result = await carCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    //Update car info (private)
    app.patch("/cars/:id", async (req, res) => {
      const id = req.params.id;
      const updateData = req.body;
      const result = await carCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
      res.send(result);
    });

    // Cart Items API

    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { buyer_email: email };
      const result = await cartItemCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/cars/cartItem", verifyJWT, async (req, res) => {
      const cartItems = req.body;
      const result = await cartItemCollection.insertOne(cartItems);
      res.send(result);
    });

    //CartItem delete
    app.delete("/cars/cartItem/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const result = await cartItemCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });
    app.get("/cars/cartItem/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const result = await cartItemCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // Payment API
    // Create payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      app.post("/payments", verifyJWT, async (req, res) => {
        const payment = req.body;
        const insertResult = await paymentCollection.insertOne(payment);
        const id = payment.deleteId;
        console.log(id)
        // const query = { _id: new ObjectId(id) };
        // console.log(query)
        // const selectedClassId = payment.id;
        // console.log(selectedClassId)
        // const filter = { _id: new ObjectId(selectedClassId) };
        // // console.log(query, filter);
        // const update = {
        //   $inc: {
        //     seats: -1,
        //     enrolled: 1,
        //   },
        // };
        // const updateResult = await classCollection.updateOne(filter, update);
        // const deleteResult = await selectedClassCollection.deleteOne(query);
        res.send(insertResult);
        // console.log(updateResult, deleteResult)
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    console.log("Server is Connected");
  } finally {
    // await client.close();
  }
}
run().catch(console.log);

app.get("/", (req, res) => {
  res.send("Car Paradise Server is Running");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
