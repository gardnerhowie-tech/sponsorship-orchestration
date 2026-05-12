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
  classificationResults,
  score
}) {

  console.log(
    "RAW CLASSIFICATION ROWS:",
    classificationResults?.length
  );

  const sheets = await getSheets();

  const row = [

    String(channelId).trim(),

    new Date().toISOString(),

    "v2.7",
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

  console.log("Appending RAW row:", row);

  console.log("🔥 ABOUT TO APPEND RAW CLASSIFICATION");

  const appendResponse =
    await sheets.spreadsheets.values.append({

      spreadsheetId:
        RAW_CLASSIFICATION_SPREADSHEET_ID,

      range:
        `${RAW_CLASSIFICATION_SHEET}!A1`,

      valueInputOption: "RAW",

      resource: {
        values: [row]
      }

    });

  console.log(
    "🔥 RAW APPEND RESPONSE:"
  );

  console.dir(
    appendResponse.data,
    { depth: null }
  );

  console.log("🔥 RAW APPEND FINISHED");

  console.log(
    "✓ RAW_COMMENT_CLASSIFICATIONS appended"
  );
}

/* ================================
APPEND MASTER
(legacy helper — not authoritative)
================================ */

async function appendMasterRow({
  channelId,
  selectedVideos,
  commentsProcessed,
  score
}) {

  console.log(
    "appendMasterRow() called (legacy helper)"
  );

  const sheets = await getSheets();

  const row = [

    String(channelId).trim(),

    selectedVideos.length,

    commentsProcessed,

    Number(score.compositeInternal) / 10,

    new Date().toISOString()

  ];

  await sheets.spreadsheets.values.append({

    spreadsheetId:
      COMMENT_SPREADSHEET_ID,

    range:
      `${COMMENT_SIGNAL_SHEET}!A:E`,

    valueInputOption: "RAW",

    resource: {
      values: [row]
    }

  });

  console.log("✓ MASTER append complete");
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

  const res =
    await sheets.spreadsheets.values.get({

      spreadsheetId:
        COMMENT_SPREADSHEET_ID,

      range:
        `${COMMENT_SIGNAL_SHEET}!A:G`

    });

  const rows =
    res.data.values || [];

  const cleanChannelId =
    String(channelId).trim();

  let rowIndex = -1;

  /* ================================
  FIND EXISTING ROW
  ================================ */

  for (let i = 1; i < rows.length; i++) {

    const existingChannelId =
      String(rows[i][0] || "").trim();

    if (
      existingChannelId === cleanChannelId
    ) {

      rowIndex = i + 1;

      console.log(
        `Found existing COMMENT_ANALYSIS row at ${rowIndex}`
      );

      break;
    }
  }

  /* ================================
  NORMALISE SCORE
  ================================ */

  console.log(
    "COMPOSITE INTERNAL:",
    score.compositeInternal
  );

  console.log(
    "COMPOSITE DISPLAY:",
    score.compositeDisplay
  );

  const normalisedScore =
    Number(score.compositeInternal) / 10;

  console.log(
    "NORMALISED SCORE:",
    normalisedScore
  );

  const row = [

    cleanChannelId,

    normalisedScore,

    7,

    new Date().toISOString(),

    "v2.7",

    "v1.1",

    latest_comment_timestamp || ""

  ];

  console.log(
    "COMMENT_ANALYSIS row:",
    row
  );

  /* ================================
  UPDATE EXISTING ROW
  ================================ */

  if (rowIndex > 0) {

    console.log(
      `Updating COMMENT_ANALYSIS row ${rowIndex}`
    );

    await sheets.spreadsheets.values.update({

      spreadsheetId:
        COMMENT_SPREADSHEET_ID,

      range:
        `${COMMENT_SIGNAL_SHEET}!A${rowIndex}:G${rowIndex}`,

      valueInputOption: "RAW",

      resource: {
        values: [row]
      }

    });

  }

  /* ================================
  APPEND NEW ROW
  ================================ */

  else {

    console.log(
      "No existing COMMENT_ANALYSIS row found — appending"
    );

    await sheets.spreadsheets.values.append({

      spreadsheetId:
        COMMENT_SPREADSHEET_ID,

      range:
        `${COMMENT_SIGNAL_SHEET}!A:G`,

      valueInputOption: "RAW",

      resource: {
        values: [row]
      }

    });
  }

  console.log(
    "✓ COMMENT_ANALYSIS updated"
  );
}

module.exports = {
  appendRawClassifications,
  appendMasterRow,
  updateCurrentScore
};