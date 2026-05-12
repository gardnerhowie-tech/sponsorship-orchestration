const { spawn } = require("child_process");
const path = require("path");

// Absolute paths
const ORCHESTRATION_DIR = __dirname;
const JOIN_LAYER_DIR = path.resolve(__dirname, "../Join Layer");

// Scripts
const TRUST_INDEX_SCRIPT = "run_trust_index.js";
const CHANNEL_JOIN_SCRIPT = "run_channel_join.js";

// ----------------------------------------
// RUN SCRIPT (PROMISE WRAPPER)
// ----------------------------------------
function runScript(command, args, cwd) {
  return new Promise((resolve, reject) => {

    const process = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: true
    });

    process.on("close", (code) => {
  if (code === 0) {
    resolve();
  } else {
    console.error(`\n❌ FAILED PROCESS`);
    console.error(`Command: ${command}`);
    console.error(`Args:`, args);
    console.error(`cwd: ${cwd}`);
    console.error(`Exit code: ${code}`);

    reject(new Error(`${args[0]} exited with code ${code}`));
  }
});

    process.on("error", (err) => {
      reject(err);
    });
  });
}

// ----------------------------------------
// MAIN EXECUTION FLOW
// ----------------------------------------
async function runExecution(channelId) {

  if (!channelId) {
    throw new Error("Missing channel_id");
  }

  console.log(`\n=== EXECUTION START: ${channelId} ===`);

  // STEP 1 — TRUST INDEX
  console.log("\n→ Running Trust Index...");
  await runScript(
    "node",
    [TRUST_INDEX_SCRIPT, channelId],
    ORCHESTRATION_DIR
  );

  // STEP 2 — CHANNEL JOIN
  console.log("\n→ Running Channel Join...");
  await runScript(
    "node",
    [CHANNEL_JOIN_SCRIPT, channelId],
    JOIN_LAYER_DIR
  );

  console.log(`\n=== EXECUTION COMPLETE: ${channelId} ===\n`);
}

module.exports = { runExecution };