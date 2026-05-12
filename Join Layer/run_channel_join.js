const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");
const config = require("../orchestration/sheet_config");

const targetChannelId = process.argv[2] || null;

function getAuthConfig() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return {
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    };
  }

  const localPath = path.resolve(
    __dirname,
    "../Host Responsiveness/sheets-service-account.json"
  );

  if (!fs.existsSync(localPath)) {
    throw new Error(`Credentials file not found at: ${localPath}`);
  }

  return {
    keyFile: localPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  };
}

const auth = new google.auth.GoogleAuth(getAuthConfig());

async function getSheetsClient() {
  const client = await auth.getClient();

  return google.sheets({
    version: "v4",
    auth: client
  });
}

const clean = (v) => (v ? String(v).trim() : null);

const num = (v) => {
  if (v === "" || v === undefined || v === null) return null;

  const n = parseFloat(v);

  return Number.isFinite(n) ? n : null;
};

async function fetchSheet(sheets, spreadsheetId, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range
  });

  return res.data.values || [];
}

async function loadTrustIndex(sheets) {
  const rows = await fetchSheet(
    sheets,
    config.SPREADSHEETS.CORE_SYSTEM.id,
    `${config.SPREADSHEETS.CORE_SYSTEM.sheets.TRUST_INDEX_CURRENT}!A:I`
  );

  const map = {};

  for (let i = 1; i < rows.length; i++) {
    const id = clean(rows[i][0]);

    if (!id) continue;

    if (targetChannelId && id !== targetChannelId) continue;

    const trustScore = num(rows[i][1]);
    const commentSignal = num(rows[i][2]);
    const surveySignal = num(rows[i][3]);
    const responsivenessSignal = num(rows[i][4]);
    const signalsUsed = num(rows[i][5]);

    map[id] = {
      channel_id: id,

      trust_index_score: trustScore,

      comment_signal: commentSignal,

      survey_signal: surveySignal,

      responsiveness_signal: responsivenessSignal,

      signals_used_count: signalsUsed ?? 0,

      score_type:
        clean(rows[i][6]) ||
        (signalsUsed > 0 ? "partial" : "insufficient")
    };
  }

  return map;
}

async function loadYouTubeMetrics(sheets) {
  const rows = await fetchSheet(
    sheets,
    config.SPREADSHEETS.YOUTUBE_CHANNEL_METRICS.id,
    `${config.SPREADSHEETS.YOUTUBE_CHANNEL_METRICS.sheets.YOUTUBE_CHANNEL_METRICS}!A:K`
  );

  const map = {};

  for (let i = 1; i < rows.length; i++) {
    const id = clean(rows[i][0]);

    if (!id) continue;

    if (targetChannelId && id !== targetChannelId) continue;

    map[id] = {
      channel_id: id,

      channel_name: clean(rows[i][1]),

      channel_thumbnail: clean(rows[i][2]),

      subscribers: num(rows[i][3]),

      avg_views: num(rows[i][4]),

      median_views: num(rows[i][5]),

      avg_likes: num(rows[i][6]),

      avg_comments: num(rows[i][7]),

      engagement_rate: num(rows[i][8]),

      video_count: num(rows[i][9])
    };
  }

  return map;
}

function buildRows(trustMap, ytMap) {
  const ids = targetChannelId
    ? [targetChannelId]
    : [...new Set([...Object.keys(trustMap), ...Object.keys(ytMap)])];

  return ids.map(id => {
    const t = trustMap[id] || {};
    const y = ytMap[id] || {};

    const hasTrustScore =
      t.trust_index_score !== null &&
      t.trust_index_score !== undefined;

    const signalsUsed = t.signals_used_count ?? 0;

    let volatilityRatio = null;

    if (y.avg_views && y.median_views && y.median_views !== 0) {
      volatilityRatio = y.avg_views / y.median_views;
    }

    return {
      channel_id: id,

      channel_name: y.channel_name ?? null,

      channel_thumbnail: y.channel_thumbnail ?? null,

      trust_index_score:
        hasTrustScore ? t.trust_index_score : null,

      comment_signal: t.comment_signal ?? null,

      survey_signal: t.survey_signal ?? null,

      responsiveness_signal:
        t.responsiveness_signal ?? null,

      signals_used_count: signalsUsed,

      score_type:
        hasTrustScore
          ? (t.score_type || "partial")
          : "insufficient",

      subscribers: y.subscribers ?? null,

      avg_views: y.avg_views ?? null,

      median_views: y.median_views ?? null,

      avg_likes: y.avg_likes ?? null,

      avg_comments: y.avg_comments ?? null,

      engagement_rate: y.engagement_rate ?? null,

      video_count: y.video_count ?? null,

      volatility_ratio: volatilityRatio,

      last_updated: new Date().toISOString()
    };
  });
}

async function writeChannelMaster(sheets, results) {
  const spreadsheetId = config.SPREADSHEETS.CORE_SYSTEM.id;

  const sheetName =
    config.SPREADSHEETS.CORE_SYSTEM.sheets.CHANNEL_MASTER;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:R`
  });

  const rows = res.data.values || [];

  const indexMap = {};

  for (let i = 1; i < rows.length; i++) {
    const id = rows[i][0];

    if (id) indexMap[id] = i + 1;
  }

  for (const r of results) {
    console.log("Updating channel:", r.channel_id);

    const row = [
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
  r.last_updated,
  r.channel_name,
  r.channel_thumbnail
];

    const existingRow = indexMap[r.channel_id];

    if (existingRow) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,

        range: `${sheetName}!A${existingRow}:R${existingRow}`,

        valueInputOption: "RAW",

        resource: {
          values: [row]
        }
      });

    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId,

        range: `${sheetName}!A:R`,

        valueInputOption: "RAW",

        resource: {
          values: [row]
        }
      });
    }
  }
}

async function run() {
  console.log("=== CHANNEL JOIN START ===");

  const sheets = await getSheetsClient();

  const trustMap = await loadTrustIndex(sheets);

  const ytMap = await loadYouTubeMetrics(sheets);

  const results = buildRows(trustMap, ytMap);

  await writeChannelMaster(sheets, results);

  console.log(
    `=== CHANNEL_MASTER UPDATED: ${results.length} rows ===`
  );
}

run().catch(err => {
  console.error("CHANNEL JOIN FAILED:");

  console.error(err);

  process.exit(1);
});