const { loadAllSignals } = require("./signal_loader");
const { computeBatch } = require("./weighting_engine");
const { writeTrustIndex } = require("./trust_index_aggregation");

const AGGREGATION_VERSION = "v1.0";

async function run() {

  console.log("=== TRUST INDEX START ===");

  // STEP 1 — LOAD SIGNALS
  const rows = await loadAllSignals();
  console.log(`Loaded ${rows.length} channels`);

  // STEP 2 — COMPUTE
  const scored = computeBatch(rows);

  // STEP 3 — FORMAT
  const results = scored
    .filter(r => r.trust_index_score !== null)
    .map(r => ({
      channel_id: r.channel_id,
      trust_index_score: r.trust_index_score,
      comment_signal: r.comment_signal ?? null,
      survey_signal: r.survey_signal ?? null,
      responsiveness_signal: r.responsiveness_signal ?? null,
      signals_used_count: r.signals_used_count ?? 0,
      score_type: r.score_type ?? "partial",
      last_updated: new Date().toISOString(),
      aggregation_version: AGGREGATION_VERSION
    }));

  console.log(`Valid scores: ${results.length}`);

  if (results.length === 0) {
    console.log("No valid scores — exiting");
    return;
  }

  // STEP 4 — WRITE
  await writeTrustIndex(results);

  console.log("=== TRUST INDEX COMPLETE ===");
}

run().catch(err => {
  console.error("Trust index failed:");
  console.error(err);
  process.exit(1);
});