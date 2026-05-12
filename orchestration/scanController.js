const { exec } = require("child_process");
const util = require("util");
const path = require("path");

const execAsync = util.promisify(exec);

const { runCommentPipeline } = require("./triggers/runCommentPipeline");

const {
  runHostResponsivenessPipeline
} = require("./triggers/runHostResponsivenessPipeline");

const { runExecution } =
  require("./system_execution_controller");

function formatDuration(ms) {
  return `${(ms / 1000).toFixed(2)}s`;
}

async function runYouTubeEnrichment(channel_id) {
  console.log(`📊 Running YouTube enrichment for ${channel_id}`);

const folderPath = path.join(
  __dirname,
  "..",
  "Audience and Performance"
);

  const command =
    `cd "${folderPath}" && node run_youtube_enrichment.js ${channel_id}`;

  const { stdout, stderr } =
    await execAsync(command, {
      maxBuffer: 1024 * 1024 * 20
    });

  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);

  console.log("✅ YouTube enrichment complete");
}

async function scanChannel(channel_id) {
  if (!channel_id) {
    throw new Error("channel_id is required");
  }

  const scanStart = Date.now();

  console.log(`\n🚀 Starting scan for ${channel_id}`);
  console.log(`🕒 Scan started at: ${new Date(scanStart).toISOString()}`);

  try {
    const commentStart = Date.now();

    console.log("\n→ STEP 1: Comment Analysis");
    await runCommentPipeline(channel_id);

    const commentEnd = Date.now();
    console.log(`⏱️ Comment Analysis took: ${formatDuration(commentEnd - commentStart)}`);

    const responsivenessStart = Date.now();

    console.log("\n→ STEP 2: Host Responsiveness");
    await runHostResponsivenessPipeline(channel_id);

    const responsivenessEnd = Date.now();
    console.log(`⏱️ Host Responsiveness took: ${formatDuration(responsivenessEnd - responsivenessStart)}`);

    const enrichmentStart = Date.now();

    console.log("\n→ STEP 3: YouTube Enrichment");
    await runYouTubeEnrichment(channel_id);

    const enrichmentEnd = Date.now();
    console.log(`⏱️ YouTube Enrichment took: ${formatDuration(enrichmentEnd - enrichmentStart)}`);

    const executionStart = Date.now();

    console.log("\n→ STEP 4: Execution Layer");
    await runExecution(channel_id);

    const executionEnd = Date.now();
    console.log(`⏱️ Execution Layer took: ${formatDuration(executionEnd - executionStart)}`);

    const scanEnd = Date.now();

    console.log(`\n🕒 Scan finished at: ${new Date(scanEnd).toISOString()}`);
    console.log(`⏱️ TOTAL SCAN TIME: ${formatDuration(scanEnd - scanStart)}`);
    console.log(`\n✅ Scan complete for ${channel_id}`);

  } catch (err) {
    const errorTime = Date.now();

    console.error("\n❌ Scan failed");
    console.error(`🕒 Failed at: ${new Date(errorTime).toISOString()}`);
    console.error(`⏱️ Time before failure: ${formatDuration(errorTime - scanStart)}`);
    console.error(err);

    process.exitCode = 1;
  }
}

const channel_id = process.argv[2];

if (channel_id) {
  scanChannel(channel_id);
}

module.exports = {
  scanChannel
};
