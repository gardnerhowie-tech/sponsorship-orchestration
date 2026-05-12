const { google } = require("googleapis");
const path = require("path");

// 🔴 DO NOT load config at top level

// ----------------------------------------
// AUTH
// ----------------------------------------
function getAuth() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log("Using ENV credentials");
    return new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
  }

  const localPath = path.join(
    __dirname,
    "../Host Responsiveness/sheets-service-account.json"
  );

  console.log("Using LOCAL credentials:", localPath);

  return new google.auth.GoogleAuth({
    keyFile: localPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}

async function getSheetsClient() {
  const auth = getAuth();
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

// ----------------------------------------
// TIMEOUT
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
// FETCH
// ----------------------------------------
async function fetchSheet(sheets, spreadsheetId, range) {
  const res = await withTimeout(
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    }),
    `fetchSheet ${range}`
  );

  return res.data.values || [];
}

// ----------------------------------------
// HELPERS
// ----------------------------------------
const clean = (v) => (v ? String(v).trim() : null);
const valid = (v) => v !== null && v !== undefined && !isNaN(v);

// ----------------------------------------
// LOAD ALL SIGNALS
// ----------------------------------------
async function loadAllSignals() {

  console.log("Loading signals...");

  // 🔴 LAZY LOAD CONFIG HERE
  const config = require("./sheet_config");

  const sheets = await getSheetsClient();

  // COMMENT
  const commentRows = await fetchSheet(
    sheets,
    config.SPREADSHEETS.COMMENT_ANALYSIS.id,
    `${config.SPREADSHEETS.COMMENT_ANALYSIS.sheets.COMMENT_SIGNAL_OUTPUT}!A:F`
  );

  const comment = {};
  for (let i = 1; i < commentRows.length; i++) {
    const id = clean(commentRows[i][0]);
    const val = parseFloat(commentRows[i][1]);
    if (id && valid(val)) comment[id] = val;
  }

  // SURVEY
  const surveyRows = await fetchSheet(
    sheets,
    config.SPREADSHEETS.CORE_SYSTEM.id,
    `${config.SPREADSHEETS.CORE_SYSTEM.sheets.HOST_SURVEY}!A:E`
  );

  const latestSurvey = {};

  for (let i = 1; i < surveyRows.length; i++) {
    const id = clean(surveyRows[i][0]);
    const val = parseFloat(surveyRows[i][2]);
    const ts = new Date(surveyRows[i][3]).getTime();

    if (!id || !valid(val) || !ts) continue;

    if (!latestSurvey[id] || ts > latestSurvey[id].ts) {
      latestSurvey[id] = { score: val, ts };
    }
  }

  const survey = {};
  for (const id in latestSurvey) {
    survey[id] = latestSurvey[id].score;
  }

  // RESPONSIVENESS
  const respRows = await fetchSheet(
    sheets,
    config.SPREADSHEETS.HOST_RESPONSIVENESS.id,
    "HOST_RESPONSIVENESS!A:C"
  );

  const latestResp = {};
  for (let i = 1; i < respRows.length; i++) {
    const id = clean(respRows[i][0]);
    const score = parseFloat(respRows[i][1]);
    const ts = new Date(respRows[i][2]).getTime();

    if (!id || !valid(score)) continue;

    if (!latestResp[id] || ts > latestResp[id].ts) {
      latestResp[id] = { score, ts };
    }
  }

  const resp = {};
  for (const id in latestResp) {
    resp[id] = latestResp[id].score / 100;
  }

  const channels = new Set([
    ...Object.keys(comment),
    ...Object.keys(survey),
    ...Object.keys(resp)
  ]);

  const result = [...channels].map(id => ({
    channel_id: id,
    comment_signal: comment[id] ?? null,
    survey_signal: survey[id] ?? null,
    responsiveness_signal: resp[id] ?? null,
    live_events_signal: null
  }));

  console.log("Loaded channels:", result.length);

  return result;
}

module.exports = { loadAllSignals };