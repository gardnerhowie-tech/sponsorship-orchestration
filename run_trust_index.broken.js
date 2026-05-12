console.log("=== TRUST INDEX FILE BOOT ===");

// 🔴 FORCE CLEAR CACHE
const path = require("path");
const loaderPath = path.resolve(__dirname, "./signal_loader.js");

delete require.cache[loaderPath];

console.log("Cache cleared for signal_loader");

let loadAllSignals;

try {
  const loader = require("./signal_loader");
  loadAllSignals = loader.loadAllSignals;
  console.log("signal_loader REQUIRED SUCCESSFULLY");
} catch (err) {
  console.error("❌ REQUIRE FAILED:");
  console.error(err);
  process.exit(1);
}

// ----------------------------------------
// TIMEOUT WRAPPER
// ----------------------------------------
function withTimeout(promise, label, ms = 10000) {
  let timeout;
  const timer = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timer]).finally(() => clearTimeout(timeout));
}

// ----------------------------------------
// MAIN
// ----------------------------------------
async function run() {

  console.log("=== TRUST INDEX START ===");

  console.log("Calling loadAllSignals...");

  const rows = await withTimeout(
    loadAllSignals(),
    "loadAllSignals"
  );

  console.log("Signals loaded:", rows.length);

  console.log("=== DONE ===");
}

run().catch(err => {
  console.error("❌ ERROR:");
  console.error(err.message);
  process.exit(1);
});