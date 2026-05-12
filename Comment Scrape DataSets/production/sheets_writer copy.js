const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");

/* ================================
SPREADSHEET CONFIG
================================ */

const COMMENT_SPREADSHEET_ID =
  "1Gg_29S2_xEbfqTVrBflTJfu7MhdRfyZNCGDMUsjwjU4";

const RAW_CLASSIFICATION_SPREADSHEET_ID =
  "1nW07cDAotb0LP0rU0T-CSNSoNHxiEUfBfKroXYePoNo";

const COMMENT_SIGNAL_SHEET =
  "COMMENT_SIGNAL_OUTPUT";

const RAW_CLASSIFICATION_SHEET =
  "RAW_COMMENT_CLASSIFICATIONS";

/* ================================
AUTH
================================ */

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

async function getSheets() {

  const auth = getAuth();

  const client = await auth.getClient();

  return google.sheets({
    version: "v4",
    auth: client
  });
}

/* ================================
RAW CLASSIFICATIONS
================================ */

async function appendRawClassifications({
  channelId,
  selectedVideos,
  topLevelCommentsProcessed,
  replyCommentsCount,
  interactionRatio,
  score
}) {

  const sheets = await getSheets();

  const row = [

    channelId,

    new Date().toISOString(),

    "v1.1",
    "v1.1",

    selectedVideos?.[0]?.videoId || "",
    selectedVideos?.[1]?.videoId || "",
    selectedVideos?.[2]?.videoId || "",

    topLevelCommentsProcessed,

    score.sentimentScore,
    score.depthScore,
    score.parasocialScore,
    score.behaviourScore,
    score.substantiveScore,
    score.returningScore,
    score.audienceScore,

    score.sentiment_positive_pct,
    score.depth_deep_pct,
    score.parasocial_yes_pct,
    score.behaviour_yes_pct,
    score.substantive_yes_pct,
    score.returning_yes_pct,

    score.compositeInternal,
    score.compositeDisplay,

    replyCommentsCount

  ];

  await sheets.spreadsheets.values.append({

    spreadsheetId: RAW_CLASSIFICATION_SPREADSHEET_ID,

    range: `${RAW_CLASSIFICATION_SHEET}!A:X`,

    valueInputOption: "RAW",

    resource: {
      values: [row]
    }

  });

  console.log("✓ RAW_COMMENT_CLASSIFICATIONS appended");
}

/* ================================
APPEND MASTER
================================ */

async function appendMasterRow({
  channelId,
  selectedVideos,
  commentsProcessed,
  score
}) {

  const sheets = await getSheets();

  const row = [

    channelId,
    selectedVideos.length,
    commentsProcessed,
    score.compositeDisplay,
    new Date().toISOString()

  ];

  await sheets.spreadsheets.values.append({

    spreadsheetId: COMMENT_SPREADSHEET_ID,

    range: `${COMMENT_SIGNAL_SHEET}!A:E`,

    valueInputOption: "RAW",

    resource: {
      values: [row]
    }

  });

  console.log("✓ MASTER complete");
}

/* ================================
UPDATE CURRENT SCORE
================================ */

async function updateCurrentScore({
  channelId,
  score,
  latest_comment_timestamp
}) {

  const sheets = await getSheets();

  const res = await sheets.spreadsheets.values.get({

    spreadsheetId: COMMENT_SPREADSHEET_ID,

    range: `${COMMENT_SIGNAL_SHEET}!A:Z`

  });

  const rows = res.data.values || [];

  let rowIndex = -1;

  for (let i = 1; i < rows.length; i++) {

    if (rows[i][0] === channelId) {

      rowIndex = i + 1;
      break;
    }
  }

  const row = [

    channelId,

    score.compositeDisplay,

    7,

    new Date().toISOString(),

    "v1.1",
    "v1.1",

    latest_comment_timestamp

  ];

  if (rowIndex > 0) {

    await sheets.spreadsheets.values.update({

      spreadsheetId: COMMENT_SPREADSHEET_ID,

      range: `${COMMENT_SIGNAL_SHEET}!A${rowIndex}:G${rowIndex}`,

      valueInputOption: "RAW",

      resource: {
        values: [row]
      }

    });

  } else {

    await sheets.spreadsheets.values.append({

      spreadsheetId: COMMENT_SPREADSHEET_ID,

      range: `${COMMENT_SIGNAL_SHEET}!A:G`,

      valueInputOption: "RAW",

      resource: {
        values: [row]
      }

    });
  }

  console.log("✓ COMMENT_ANALYSIS updated");

  console.log("DEBUG ROW:", row);
}

module.exports = {
  appendRawClassifications,
  appendMasterRow,
  updateCurrentScore
};