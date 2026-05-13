const express = require("express");
const bodyParser = require("body-parser");
const { runExecution } = require("../orchestration/system_execution_controller");

const app = express();
app.use(bodyParser.json());

function extractChannelId(url) {
  if (!url) return null;
  const match = url.match(/channel\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

app.post("/tallyWebhook", async (req, res) => {
  try {
    const data = req.body;

    const channelUrl = data?.fields?.find(f => f.key === "channel_url")?.value;
    const channelId = extractChannelId(channelUrl);

    if (!channelId) {
      console.log("Invalid channel URL");
      return res.status(400).send("Invalid channel URL");
    }

    console.log(`\n=== WEBHOOK RECEIVED: ${channelId} ===`);

    // 🔴 IMPORTANT: await execution so we SEE what happens
    await runExecution(channelId);

    console.log(`=== WEBHOOK COMPLETE: ${channelId} ===\n`);

    res.status(200).send("Webhook processed");

  } catch (err) {
    console.error("Webhook error:");
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.listen(3000, () => {
  console.log("Webhook server running on port 3000");
});