const { google } = require("googleapis");
const path = require("path");
const config = require("../orchestration/sheet_config");

// ----------------------------------------
// ARGUMENT (OPTIONAL)
// ----------------------------------------
const targetChannelId = process.argv[2] || null;

// ----------------------------------------
// AUTH (FIXED)
// ----------------------------------------
function getAuthConfig() {
  // Prefer environment variable (Render)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log("Using GOOGLE_APPLICATION_CREDENTIALS from environment");

    return {
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    };
  }

  // Fallback to local file
  const localPath = path.join(
    __dirname,
    "../Host Responsiveness/sheets-service-account.json"
  );

  console.log("Using LOCAL credentials file:", localPath);

  return {
    keyFile: localPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  };
}

const auth = new google.auth.GoogleAuth(getAuthConfig());

async function getSheetsClient() {
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

// ----------------------------------------
// HELPERS
// ----------------------------------------
const clean = (v) => (v ? String(v).trim() : null);
const num = (v) => (v === "" || v === undefined ? null : parseFloat(v));

// ----------------------------------------
// FETCH
// ----------------------------------------
async function fetchSheet(sheets, spreadsheetId, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range
  });
  return res.data.values || [];
}

// ----------------------------------------
// LOAD TRUST INDEX
// ----------------------------------------
async function loadTrustIndex(sheets) {

  const spreadsheetId = config.SPREADSHEETS.CORE_SYSTEM.id;
  const sheetName = config.SPREADSHEETS.CORE_SYSTEM.sheets.TRUST_INDEX_CURRENT;

  const rows = await fetchSheet(
    sheets,
    spreadsheetId,
    `${sheetName}!A:I`
  );

  const map = {};

  for (let i = 1; i < rows.length; i++) {

    const id = clean(rows[i][0]);
    if (!id) continue;

    if (targetChannelId && id !== targetChannelId) continue;

    map[id] = {
      channel_id: id,
      trust_index_score: num(rows[i][1]),
      comment_signal: num(rows[i][2]),
      survey_signal: num(rows[i][3]),
      responsiveness_signal: num(rows[i][4]),
      signals_used_count: num(rows[i][5]),
      score_type: clean(rows[i][6]),
      last_updated: clean(rows[i][7])
    };
  }

  return map;
}

// ----------------------------------------
// LOAD YOUTUBE METRICS
// ----------------------------------------
async function loadYouTubeMetrics(sheets) {

  const spreadsheetId = config.SPREADSHEETS.YOUTUBE_CHANNEL_METRICS.id;
  const sheetName = config.SPREADSHEETS.YOUTUBE_CHANNEL_METRICS.sheets.YOUTUBE_CHANNEL_METRICS;

  const rows = await fetchSheet(
    sheets,
    spreadsheetId,
    `${sheetName}!A:I`
  );

  const map = {};

  for (let i = 1; i < rows.length; i++) {

    const id = clean(rows[i][0]);
    if (!id) continue;

    if (targetChannelId && id !== targetChannelId) continue;

    map[id] = {
      channel_id: id,
      subscribers: num(rows[i][1]),
      avg_views: num(rows[i][2]),
      median_views: num(rows[i][3]),
      avg_likes: num(rows[i][4]),
      avg_comments: num(rows[i][5]),
      engagement_rate: num(rows[i][6]),
      video_count: num(rows[i][7]),
      yt_last_updated: clean(rows[i][8])
    };
  }

  return map;
}

// ----------------------------------------
// BUILD ROWS
// ----------------------------------------
function buildMasterRows(trustMap, ytMap) {

  const ids = targetChannelId
    ? [targetChannelId]
    : [...new Set([...Object.keys(trustMap), ...Object.keys(ytMap)])];

  const results = [];

  for (const id of ids) {

    const t = trustMap[id] || {};
    const y = ytMap[id] || {};

    const avg = y.avg_views;
    const med = y.median_views;

    let volatility_ratio = null;
    if (avg && med && med !== 0) {
      volatility_ratio = avg / med;
    }

    results.push({
      channel_id: id,
      trust_index_score: t.trust_index_score ?? null,
      comment_signal: t.comment_signal ?? null,
      survey_signal: t.survey_signal ?? null,
      responsiveness_signal: t.responsiveness_signal ?? null,
      signals_used_count: t.signals_used_count ?? null,
      score_type: t.score_type ?? null,
      subscribers: y.subscribers ?? null,
      avg_views: y.avg_views ?? null,
      median_views: y.median_views ?? null,
      avg_likes: y.avg_likes ?? null,
      avg_comments: y.avg_comments ?? null,
      engagement_rate: y.engagement_rate ?? null,
      video_count: y.video_count ?? null,
      volatility_ratio,
      last_updated: new Date().toISOString()
    });
  }

  return results;
}

// ----------------------------------------
// WRITE (UPSERT)
// ----------------------------------------
async function writeChannelMaster(sheets, results) {

  const spreadsheetId = config.SPREADSHEETS.CORE_SYSTEM.id;
  const sheetName = config.SPREADSHEETS.CORE_SYSTEM.sheets.CHANNEL_MASTER;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:P`
  });

  const rows = res.data.values || [];
  const indexMap = {};

  for (let i = 1; i < rows.length; i++) {
    const id = rows[i][0];
    if (id) indexMap[id] = i + 1;
  }

  for (const r of results) {

    const newRow = [
      r.channel_id,
      r.trust_index_score,
      r.comment_signal,
      r.survey_signal,
      r.responsiveness_signal,
      r.signals_used_count,
      r.score_type,
      r.subscribers,
      r.avg_views,
      r.median_views,
      r.avg_likes,
      r.avg_comments,
      r.engagement_rate,
      r.video_count,
      r.volatility_ratio,
      r.last_updated
    ];

    const rowIndex = indexMap[r.channel_id];

    if (rowIndex) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A${rowIndex}:P${rowIndex}`,
        valueInputOption: "RAW",
        resource: { values: [newRow] }
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:P`,
        valueInputOption: "RAW",
        resource: { values: [newRow] }
      });
    }
  }
}

// ----------------------------------------
// MAIN
// ----------------------------------------
async function run() {

  const sheets = await getSheetsClient();

  const trustMap = await loadTrustIndex(sheets);
  const ytMap = await loadYouTubeMetrics(sheets);

  const results = buildMasterRows(trustMap, ytMap);

  await writeChannelMaster(sheets, results);

  console.log(
    targetChannelId
      ? `Updated channel: ${targetChannelId}`
      : `CHANNEL_MASTER rebuilt: ${results.length} channels`
  );
}

run().catch(err => {
  console.error("Join pipeline failed:");
  console.error(err);
  process.exit(1);
});