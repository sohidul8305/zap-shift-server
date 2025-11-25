const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

// ✅ CORS middleware
app.use(cors({
  origin: "http://localhost:5173", // frontend URL
  credentials: true,               // allow cookies/auth
}));

app.use(express.json());

// ------------------------------
// MongoDB URI
// ------------------------------
const uri = `mongodb+srv://${process.env.BD_USER}:${process.env.BD_PASS}@cluster0.hz6ypdj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Mongo Client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// ------------------------------
// DB Connection
// ------------------------------
async function run() {
  try {
    await client.connect();
    console.log("✅ MongoDB Connected Successfully!");

    const db = client.db("zapShiftDB");
    const parcelCollection = db.collection("parcels");

    // GET: All Parcels
    app.get("/parcels", async (req, res) => {
     const query = {}

     const {email} = req.query;
     if(email){
        query.senderEmail = email;
     }

     const options = {sort: {createdAt: -1 } }

     const cursor = parcelCollection.find(query, options)
     const result = await cursor.toArray();
     res.send(result);

    });

    // POST: Store Parcel
    app.post("/parcels", async (req, res) => {
      try {
        const parcel = req.body;
        //cteate time
        parcel.createdAt = new Date();

        const result = await parcelCollection.insertOne(parcel);

        res.send({
          success: true,
          message: "Parcel added successfully!",
          result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err);
  }
}

run();

// Default Route
app.get("/", (req, res) => {
  res.send("Zap Shift Server Running Successfully!");
});

// Server Listener
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
