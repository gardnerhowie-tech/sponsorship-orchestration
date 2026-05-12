const { appendMasterRow, updateCurrentScore } = require("./sheets_writer");

async function runTest() {
  console.log("\n=== SHEETS WRITE TEST START ===\n");

  const testData = {
    channelId: "TEST_CHANNEL",

    selectedVideos: [
      { videoId: "video1" },
      { videoId: "video2" },
      { videoId: "video3" }
    ],

    commentsProcessed: 120,

    score: {
      sentimentScore: 8,
      depthScore: 6,
      parasocialScore: 4,
      behaviourScore: 4,
      substantiveScore: 10,
      returningScore: 6,
      audienceScore: 8,

      sentiment_positive_pct: 0.74,
      depth_deep_pct: 0.29,
      parasocial_yes_pct: 0.13,
      behaviour_yes_pct: 0.10,
      substantive_yes_pct: 0.42,
      returning_yes_pct: 0.19,

      compositeInternal: 7.42,
      compositeDisplay: 74.2,
      comments_reply_count: 32
    }
  };

  try {
    console.log("1) Starting MASTER write...");
    const t1 = Date.now();

    await appendMasterRow(testData);

    console.log("✓ MASTER write completed in", Date.now() - t1, "ms");

    console.log("\n2) Starting COMMENT_ANALYSIS upsert...");
    const t2 = Date.now();

    await updateCurrentScore(testData);

    console.log("✓ COMMENT_ANALYSIS write completed in", Date.now() - t2, "ms");

    console.log("\n=== TEST COMPLETED SUCCESSFULLY ===\n");
    console.log("Expected COMMENT_ANALYSIS overall_comment_signal: 0.742");
  } catch (err) {
    console.error("\n❌ SHEETS WRITE FAILED\n");
    console.error(err);
  }
}

runTest();