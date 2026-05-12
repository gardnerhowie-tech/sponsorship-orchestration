const { exec } = require('child_process');
const path = require('path');
const { google } = require('googleapis');
const fs = require('fs');

// -----------------------------
// CONFIG (HARDCODED FOR STABILITY)
// -----------------------------
const SPREADSHEET_ID = '1Gg_29S2_xEbfqTVrBflTJfu7MhdRfyZNCGDMUsjwjU4';
const SHEET_NAME = 'COMMENT_SIGNAL_OUTPUT';

// -----------------------------
// GOOGLE AUTH
// -----------------------------
function getAuth() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
  }

  const fallback = path.resolve(
    __dirname,
    "../../Host Responsiveness/sheets-service-account.json"
  );

  if (!fs.existsSync(fallback)) {
    throw new Error("Missing Google credentials");
  }

  return new google.auth.GoogleAuth({
    keyFile: fallback,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}

// -----------------------------
// GET SHEETS CLIENT
// -----------------------------
async function getSheets() {
  const auth = getAuth();
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

// -----------------------------
// FETCH LAST RUN TIMESTAMP (FIXED)
// -----------------------------
async function getLastRunTimestamp(channel_id) {
  const sheets = await getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:Z`
  });

  const rows = res.data.values || [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    if (row[0] === channel_id) {
      const runTimestamp = row[3]; // ✅ FIXED: run_timestamp column
      return runTimestamp || null;
    }
  }

  return null;
}

// -----------------------------
// ORIGINAL PIPELINE EXECUTION (UNCHANGED)
// -----------------------------
function runPipeline(channel_id) {
  return new Promise((resolve, reject) => {
    console.log(`💬 Running Comment Pipeline for ${channel_id}`);

    const scriptDir = path.resolve(
      __dirname,
      "../../Comment Scrape DataSets/production"
    );

    const scriptPath = path.join(scriptDir, "run_comment_pipeline.js");

    const command = `node "${scriptPath}" ${channel_id}`;

    console.log("DEBUG PATH:", scriptPath);

    const process = exec(command, { cwd: scriptDir });

    process.stdout.on('data', (data) => {
      console.log(data.toString());
    });

    process.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    process.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Comment Pipeline complete');
        resolve();
      } else {
        reject(new Error(`Comment pipeline failed with code ${code}`));
      }
    });
  });
}

// -----------------------------
// MAIN WRAPPER (30-DAY RULE)
// -----------------------------
async function runCommentPipeline(channel_id) {
  console.log(`\n🔍 Checking Comment Analysis validity for ${channel_id}`);

  try {
    const lastRun = await getLastRunTimestamp(channel_id);

    console.log("Last run timestamp:", lastRun);

    if (!lastRun) {
      console.log("🚀 No existing data → running pipeline");
      return await runPipeline(channel_id);
    }

    const now = new Date();
    const lastRunDate = new Date(lastRun);

    if (isNaN(lastRunDate.getTime())) {
      console.log("⚠️ Invalid timestamp → running pipeline");
      return await runPipeline(channel_id);
    }

    const daysSinceRun =
      (now - lastRunDate) / (1000 * 60 * 60 * 24);

    console.log("Days since last run:", daysSinceRun.toFixed(2));

    if (daysSinceRun < 30) {
      console.log("⏭️ Score still valid (<30 days) → skipping Comment Analysis");
      return;
    }

    console.log("🚀 Score expired (>30 days) → running pipeline");
    return await runPipeline(channel_id);

  } catch (err) {
    console.error("⚠️ Check failed → fallback to pipeline");
    console.error(err.message);
    return await runPipeline(channel_id);
  }
}

module.exports = { runCommentPipeline };