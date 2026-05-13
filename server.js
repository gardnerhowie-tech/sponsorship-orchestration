console.log("STEP 1");

const express = require("express");

console.log("STEP 2");

const bodyParser = require("body-parser");

const { runExecution } =
  require("./orchestration/system_execution_controller");

const { scanChannel } =
  require("./orchestration/scanController");

const app = express();

console.log("STEP 3");

app.use(bodyParser.json());

function extractChannelId(url) {

  if (!url) return null;

  const match =
    url.match(/channel\/([a-zA-Z0-9_-]+)/);

  return match ? match[1] : null;
}

app.get("/", (req, res) => {

  res.status(200).json({
    success: true,
    service: "sponsorship-orchestration",
    status: "running"
  });

});

app.post("/tallyWebhook", async (req, res) => {

  try {

    const data = req.body;

    const channelUrl =
      data?.fields?.find(
        (f) => f.key === "channel_url"
      )?.value;

    const channelId =
      extractChannelId(channelUrl);

    if (!channelId) {

      console.log("Invalid channel URL");

      return res
        .status(400)
        .send("Invalid channel URL");
    }

    console.log(
      `\n=== WEBHOOK RECEIVED: ${channelId} ===`
    );

    await runExecution(channelId);

    console.log(
      `=== WEBHOOK COMPLETE: ${channelId} ===\n`
    );

    res.status(200).send("Webhook processed");

  } catch (err) {

    console.error("Webhook error:");
    console.error(err);

    res.status(500).send("Server error");
  }
});

app.post("/scan", async (req, res) => {

  try {

    const { channel_id } = req.body;

    if (!channel_id) {

      return res.status(400).json({
        success: false,
        error: "Missing channel_id"
      });
    }

    console.log(
      `\n=== FRONTEND SCAN RECEIVED: ${channel_id} ===`
    );

    scanChannel(channel_id)

      .then(() => {

        console.log(
          `=== FRONTEND SCAN COMPLETE: ${channel_id} ===\n`
        );

      })

      .catch((err) => {

        console.error(
          `=== FRONTEND SCAN FAILED: ${channel_id} ===`
        );

        console.error(err);

      });

    return res.status(200).json({
      success: true,
      started: true,
      channel_id
    });

  } catch (err) {

    console.error("Scan endpoint error:");
    console.error(err);

    return res.status(500).json({
      success: false,
      error: err.message || "Scan failed"
    });
  }
});

const PORT = process.env.PORT || 3000;

console.log("STEP 4");

app.listen(PORT, "0.0.0.0", () => {

  console.log("STEP 5");

  console.log(
    `Orchestration server running on port ${PORT}`
  );

});
