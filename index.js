// Imports
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// Express App
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());

// MongoDB Setup
const uri = `mongodb+srv://${process.env.BD_USER}:${process.env.BD_PASS}@cluster0.hz6ypdj.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

// DB Connection
async function run() {
  try {
    await client.connect();
    console.log("✅ MongoDB Connected Successfully!");

    const db = client.db("zapShiftDB");
    const parcelCollection = db.collection("parcels");

    // GET: Parcels (Filter by Email)
    app.get("/parcels", async (req, res) => {
      try {
        const { email } = req.query;
        const query = {};
        if (email) query.senderEmail = email;

        const parcels = await parcelCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();

        res.send(parcels);
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

// DELETE: Delete a parcel by ID
app.delete("/parcels/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await parcelCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 1) {
      res.send({ success: true, message: "Parcel deleted successfully!", deletedCount: 1 });
    } else {
      res.send({ success: false, message: "Parcel not found", deletedCount: 0 });
    }
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});


    // POST: Add New Parcel
    app.post("/parcels", async (req, res) => {
      try {
        const parcel = req.body;
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

// Start Server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
