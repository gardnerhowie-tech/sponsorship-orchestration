const { runCommentPipeline } = require('./triggers/runCommentPipeline');
const { runHostResponsivenessPipeline } = require('./triggers/runHostResponsivenessPipeline');
const { runExecution } = require('./system_execution_controller');

async function scanChannel(channel_id) {
  if (!channel_id) {
    throw new Error('channel_id is required');
  }

  console.log(`\n🚀 Starting scan for ${channel_id}`);

  try {
    // STEP 1 — Comment Analysis
    console.log('\n→ STEP 1: Comment Analysis');
    await runCommentPipeline(channel_id);

    // STEP 2 — Host Responsiveness
    console.log('\n→ STEP 2: Host Responsiveness');
    await runHostResponsivenessPipeline(channel_id);

    // STEP 3 — Execution Layer
    console.log('\n→ STEP 3: Execution Layer');
    await runExecution(channel_id);

    console.log(`\n✅ Scan complete for ${channel_id}`);
  } catch (err) {
    console.error('\n❌ Scan failed');
    console.error(err);
  }
}

// CLI usage
const channel_id = process.argv[2];

if (channel_id) {
  scanChannel(channel_id);
}

module.exports = { scanChannel };
