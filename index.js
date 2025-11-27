// server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET);

// Express App
const app = express();
const port = process.env.PORT || 3000;

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.BD_USER}:${process.env.BD_PASS}@cluster0.hz6ypdj.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

// Tracking ID Generator
function generateTrackingId() {
  return "TRK-" + Math.random().toString(36).substring(2, 10).toUpperCase();
}

async function run() {
  try {
    await client.connect();
    console.log("✅ MongoDB Connected Successfully!");

    const db = client.db("zapShiftDB");
    const parcelCollection = db.collection("parcels");
    const paymentCollection = db.collection("payments");

    // GET All Parcels
    app.get("/parcels", async (req, res) => {
      try {
        const { email } = req.query;
        const filter = email ? { senderEmail: email } : {};
        const parcels = await parcelCollection.find(filter).sort({ createdAt: -1 }).toArray();
        res.send(parcels);
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // DELETE Parcel
    app.delete("/parcels/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await parcelCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 1) {
          res.send({ success: true, message: "Parcel deleted successfully!" });
        } else {
          res.send({ success: false, message: "Parcel not found" });
        }
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // STRIPE CHECKOUT
    app.post("/payment-checkout-session", async (req, res) => {
      try {
        const paymentInfo = req.body;
        const amount = parseInt(paymentInfo.cost) * 100;

        const session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price_data: {
                currency: "usd",
                unit_amount: amount,
                product_data: {
                  name: `Please pay for: ${paymentInfo.parcelName}`,
                },
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          metadata: {
            parcelId: paymentInfo.parcelId,
            parcelName: paymentInfo.parcelName,
          },
          customer_email: paymentInfo.senderEmail,
          success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancel`,
        });

        return res.send({ url: session.url });

      } catch (err) {
        console.error("STRIPE ERROR =>", err);
        return res.status(500).json({ message: err.message });
      }
    });

    // PAYMENT SUCCESS — FULL DUPLICATE PROTECTED
    app.patch("/payment-success", async (req, res) => {
      try {
        const sessionId = req.query.session_id;

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== "paid") {
          return res.send({ success: false, message: "Payment not completed" });
        }

        const transactionId = session.payment_intent;

        // 1️⃣ STOP DUPLICATE PAYMENT
        const paymentExists = await paymentCollection.findOne({ transactionId });

        if (paymentExists) {
          return res.send({
            success: true,
            message: "Payment already processed",
            transactionId: paymentExists.transactionId,
            trackingId: paymentExists.trackingId,
          });
        }

        // 2️⃣ GENERATE TRACKING ID
        const trackingId = generateTrackingId();

        // 3️⃣ UPDATE PARCEL
        const parcelId = session.metadata.parcelId;
        const parcelFilter = { _id: new ObjectId(parcelId) };

        await parcelCollection.updateOne(parcelFilter, {
          $set: {
            paymentStatus: "paid",
            trackingId: trackingId,
          },
        });

        // 4️⃣ SAVE PAYMENT
        const paymentData = {
          amount: session.amount_total / 100,
          currency: session.currency,
          customerEmail: session.customer_email,
          parcelId,
          parcelName: session.metadata.parcelName,
          transactionId,
          trackingId,
          paymentStatus: session.payment_status,
          createdAt: new Date(),
        };

        await paymentCollection.insertOne(paymentData);

        return res.send({
          success: true,
          message: "Payment processed successfully",
          transactionId,
          trackingId,
        });

      } catch (error) {
        return res.status(500).send({ success: false, message: error.message });
      }
    });

    // SINGLE PARCEL
    app.get("/parcels/:id", async (req, res) => {
      const id = req.params.id;
      const result = await parcelCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // ADD PARCEL
    app.post("/parcels", async (req, res) => {
      try {
        const parcel = req.body;
        parcel.createdAt = new Date();
        const result = await parcelCollection.insertOne(parcel);

        res.send({ success: true, message: "Parcel added successfully!", result });

      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

  } catch (err) {
    console.error("❌ MongoDB Error:", err);
  }
}

run();

app.get("/", (req, res) => {
  res.send("Zap Shift Server Running Successfully!");
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
