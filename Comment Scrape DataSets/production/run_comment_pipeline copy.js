console.log("PIPELINE FILE LOADED");
require("dotenv").config();

const { fetchAllComments } = require("./youtube_fetch");
const { classifyComments, prepareTopLevelComments } = require("./run_llm_classification");
const { computeCommentScore } = require("./aggregation");
const { appendMasterRow, updateCurrentScore } = require("./sheets_writer");

/* ================================
PIPELINE
================================ */

async function runPipeline(channelId) {

  console.log("\n🚀 ENTERED runPipeline()");
  console.log(`Channel ID: ${channelId}`);

  console.log("\n=== COMMENT PIPELINE START ===\n");

  /* ================================
  STEP 1 — FETCH COMMENTS
  ================================ */

  console.log("STEP 1: Fetching comments from YouTube...");

  let fetchResult;

  try {
    fetchResult = await fetchAllComments(channelId);
  } catch (err) {
    console.error("❌ ERROR during fetchAllComments:", err.message);
    throw err;
  }

  const rawComments = fetchResult.rawComments || [];

  console.log(`STEP 1 COMPLETE → Total comments: ${rawComments.length}`);

  if (!rawComments.length) {
    console.log("⚠️ No comments found.");
    return null;
  }

  /* ================================
  STEP 2 — SPLIT COMMENTS
  ================================ */

  console.log("\nSTEP 2: Splitting comments...");

  const topLevelComments = prepareTopLevelComments(rawComments);
  const replyComments = rawComments.filter(c => c.is_reply);

  console.log(`Top-level: ${topLevelComments.length}`);
  console.log(`Replies: ${replyComments.length}`);

  /* ================================
  STEP 3 — CLAUDE
  ================================ */

  console.log("\nSTEP 3: Running Claude classification...");

  let classificationResults;

  try {
    classificationResults = await classifyComments(topLevelComments);
  } catch (err) {
    console.error("❌ ERROR during classification:", err.message);
    throw err;
  }

  console.log(`STEP 3 COMPLETE → Classified: ${classificationResults.length}`);

  /* ================================
  STEP 4 — INTERACTION
  ================================ */

  console.log("\nSTEP 4: Calculating interaction ratio...");

  const interactionRatio =
    replyComments.length /
    (topLevelComments.length + replyComments.length);

  console.log(`Interaction Ratio: ${interactionRatio.toFixed(4)}`);

  /* ================================
  STEP 5 — SCORE
  ================================ */

  console.log("\nSTEP 5: Computing score...");

  let score;

  try {
    score = computeCommentScore(
      classificationResults,
      interactionRatio
    );
  } catch (err) {
    console.error("❌ ERROR during scoring:", err.message);
    throw err;
  }

  console.log("STEP 5 COMPLETE");
  console.log("\n=== COMMENT SCORE ===\n");
  console.log(score);

  /* ================================
  STEP 6 — SHEETS
  ================================ */

  console.log("\nSTEP 6: Writing to Google Sheets...");

  // 🔥 FIX: robust timestamp extraction (handles all shapes)
  const extractTimestamp = (c) => {
    return (
      c.publishedAt ||
      c.snippet?.publishedAt ||
      c.snippet?.topLevelComment?.snippet?.publishedAt ||
      null
    );
  };

  const validTimestamps = rawComments
    .map(c => extractTimestamp(c))
    .filter(ts => ts && !isNaN(new Date(ts).getTime()));

  if (!validTimestamps.length) {
    console.error("❌ DEBUG: sample comment object:");
    console.dir(rawComments[0], { depth: 3 });
    throw new Error("No valid timestamps found in comments");
  }

  const latestCommentTimestamp = new Date(
    Math.max(...validTimestamps.map(ts => new Date(ts).getTime()))
  ).toISOString();

  console.log("Latest comment timestamp:", latestCommentTimestamp);

  try {

    console.log("→ Writing MASTER...");
    await appendMasterRow({
      channelId,
      selectedVideos: fetchResult.selectedVideos,
      commentsProcessed: rawComments.length,
      score
    });

    console.log("✓ MASTER complete");

    console.log("→ Updating COMMENT_ANALYSIS...");
    await updateCurrentScore({
      channelId,
      score,
      latest_comment_timestamp: latestCommentTimestamp
    });

    console.log("✓ COMMENT_ANALYSIS updated");

  } catch (err) {
    console.error("❌ ERROR writing to sheets:", err.message);
    throw err;
  }

  console.log("\n=== PIPELINE COMPLETE ===\n");

  return {
    channelId,
    selectedVideos: fetchResult.selectedVideos,
    classificationResults,
    interactionRatio,
    rawCommentsCount: rawComments.length,
    score
  };
}

/* ================================
MAIN
================================ */

async function main() {

  console.log("🚀 main() started");

  const channelId = process.argv[2];

  console.log("Input channel ID:", channelId);

  if (!channelId) {
    console.error("Usage: node run_comment_pipeline.js <CHANNEL_ID>");
    process.exit(1);
  }

  try {

    const result = await runPipeline(channelId);

    if (!result) {
      console.log("No result returned.");
      return;
    }

    console.log("\n=== PIPELINE SUMMARY ===\n");

    console.log({
      channelId: result.channelId,
      videosAnalysed: result.selectedVideos.length,
      commentsProcessed: result.rawCommentsCount,
      interactionRatio: result.interactionRatio,
      commentScore: result.score.compositeDisplay
    });

  } catch (error) {

    console.error("\n🔥 PIPELINE FAILED");
    console.error(error);

    process.exit(1);
  }
}

main();