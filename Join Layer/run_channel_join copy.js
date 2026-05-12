const { google } = require("googleapis");
const config = require("../orchestration/sheet_config");

// ----------------------------------------
// AUTH
// ----------------------------------------
const auth = new google.auth.GoogleAuth({
  keyFile: "../Host Responsiveness/sheets-service-account.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

async function getSheetsClient() {
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

// ----------------------------------------
// READ HELPERS
// ----------------------------------------
async function fetchSheet(sheets, spreadsheetId, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range
  });
  return res.data.values || [];
}

const clean = (v) => (v ? String(v).trim() : null);
const num = (v) => (v === "" || v === undefined ? null : parseFloat(v));

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

    const row = rows[i];

    const channel_id = clean(row[0]);
    if (!channel_id) continue;

    map[channel_id] = {
      channel_id,
      trust_index_score: num(row[1]),
      comment_signal: num(row[2]),
      survey_signal: num(row[3]),
      responsiveness_signal: num(row[4]),
      signals_used_count: num(row[5]),
      score_type: clean(row[6]),
      last_updated: clean(row[7])
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

    const row = rows[i];

    const channel_id = clean(row[0]);
    if (!channel_id) continue;

    map[channel_id] = {
      channel_id,
      subscribers: num(row[1]),
      avg_views: num(row[2]),
      median_views: num(row[3]),
      avg_likes: num(row[4]),
      avg_comments: num(row[5]),
      engagement_rate: num(row[6]),
      video_count: num(row[7]),
      yt_last_updated: clean(row[8])
    };
  }

  return map;
}

// ----------------------------------------
// JOIN LOGIC
// ----------------------------------------
function buildMasterRows(trustMap, ytMap) {

  const allIds = new Set([
    ...Object.keys(trustMap),
    ...Object.keys(ytMap)
  ]);

  const results = [];

  for (const id of allIds) {

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

      // Trust
      trust_index_score: t.trust_index_score ?? null,
      comment_signal: t.comment_signal ?? null,
      survey_signal: t.survey_signal ?? null,
      responsiveness_signal: t.responsiveness_signal ?? null,
      signals_used_count: t.signals_used_count ?? null,
      score_type: t.score_type ?? null,

      // YouTube
      subscribers: y.subscribers ?? null,
      avg_views: y.avg_views ?? null,
      median_views: y.median_views ?? null,
      avg_likes: y.avg_likes ?? null,
      avg_comments: y.avg_comments ?? null,
      engagement_rate: y.engagement_rate ?? null,
      video_count: y.video_count ?? null,

      // Derived
      volatility_ratio,

      // Metadata
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
    range: `${sheetName}!A:Q`
  });

  const rows = res.data.values || [];
  const indexMap = {};

  for (let i = 1; i < rows.length; i++) {
    const channel_id = rows[i][0];
    if (channel_id) {
      indexMap[channel_id] = i + 1;
    }
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

    const existingRowIndex = indexMap[r.channel_id];

    if (existingRowIndex) {

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A${existingRowIndex}:P${existingRowIndex}`,
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

  console.log(`CHANNEL_MASTER updated: ${results.length} channels`);
}

run();