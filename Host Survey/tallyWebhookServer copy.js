console.log("FILE LOADED AT:", new Date().toISOString());
console.log("RUNNING FILE:", __filename);

require("dotenv").config();

const express = require("express");
const app = express();

const normalize = require("./normalizeTallyPayload");
const score = require("./hostSurveyScore");
const appendToSheet = require("./appendToSheet");

// === NEW: EXECUTION LAYER ===
const { executeChannelUpdate } = require("../orchestration/system_execution_controller");

app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send("Server is alive");
});

app.get("/tallyWebhook", (req, res) => {
  res.status(200).send("Webhook endpoint is live");
});

app.post("/tallyWebhook", async (req, res) => {
  console.log("\n=== WEBHOOK RECEIVED ===");

  try {
    const payload = req.body;

    const normalized = normalize(payload);
    console.log("NORMALIZED DATA:", normalized);

    // === HARD VALIDATION ===
    if (!normalized.channel_id) {
      console.log("❌ INVALID CHANNEL ID");

      return res.status(400).send({
        success: false,
        error: "Invalid YouTube channel URL. Must be /channel/UC format."
      });
    }

    // === SCORE ===
    const result = score(normalized);
    console.log("Host Survey Score:", result);

    const survey_signal = result.hostSurveyScore100 / 100;

    // === STEP 1: WRITE TO SHEET (BLOCKING) ===
    console.log("Writing to sheet...");

    await appendToSheet({
      channel_id: normalized.channel_id,
      channel_url: normalized.channel_url,
      survey_signal: survey_signal
    });

    console.log("Sheet write complete");

    // === STEP 2: EXECUTION LAYER ===
    console.log("Triggering execution layer...");

    await executeChannelUpdate(normalized.channel_id);

    console.log("Execution layer complete");

    // === FINAL RESPONSE ===
    res.status(200).send({
      success: true,
      channel_id: normalized.channel_id
    });

  } catch (err) {
    console.error("❌ WEBHOOK ERROR:", err);

    res.status(500).send({
      success: false,
      error: "Internal error",
      message: err.message
    });
  }
});

const PORT = process.env.PORT || 3100;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Webhook server running on port ${PORT}`);
});