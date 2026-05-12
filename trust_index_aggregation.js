const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const config = require("./sheet_config");

// -----------------------------
// AUTH (JWT → ACCESS TOKEN)
// -----------------------------
async function getAccessToken() {
  const creds = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../Host Responsiveness/sheets-service-account.json")
    )
  );

  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };

  const claim = {
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const base64url = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const unsigned = `${base64url(header)}.${base64url(claim)}`;

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsigned);

  const signature = sign
    .sign(creds.private_key, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  const data = await res.json();

  if (!data.access_token) {
    throw new Error("Failed to get access token");
  }

  return data.access_token;
}

// -----------------------------
// GOOGLE SHEETS HELPERS
// -----------------------------
async function getRows(spreadsheetId, range, token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return data.values || [];
}

async function appendRows(spreadsheetId, range, values, token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      values
    })
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error.message);
  }
}

async function updateRow(spreadsheetId, range, values, token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      values
    })
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error.message);
  }
}

// -----------------------------
// ROW FORMAT
// -----------------------------
function formatTrustIndexRow(r) {
  return [
    r.channel_id,
    r.trust_index_score,
    r.comment_signal,
    r.survey_signal,
    r.responsiveness_signal,
    r.signals_used_count,
    r.score_type,
    r.last_updated,
    r.aggregation_version
  ];
}

// -----------------------------
// UPSERT CURRENT
// -----------------------------
async function upsertCurrentRows({
  spreadsheetId,
  currentSheetName,
  rows,
  token
}) {
  const existingRows = await getRows(
    spreadsheetId,
    `${currentSheetName}!A:I`,
    token
  );

  for (const row of rows) {
    const channelId = row[0];

    let rowIndex = -1;

    for (let i = 1; i < existingRows.length; i++) {
      if (existingRows[i][0] === channelId) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex > 0) {
      await updateRow(
        spreadsheetId,
        `${currentSheetName}!A${rowIndex}:I${rowIndex}`,
        [row],
        token
      );

      console.log(`✓ TRUST_INDEX_CURRENT updated: ${channelId}`);
    } else {
      await appendRows(
        spreadsheetId,
        `${currentSheetName}!A:I`,
        [row],
        token
      );

      console.log(`✓ TRUST_INDEX_CURRENT appended: ${channelId}`);
    }
  }
}

// -----------------------------
// APPEND HISTORY
// -----------------------------
async function appendHistoryRows({
  spreadsheetId,
  historySheetName,
  rows,
  token
}) {
  await appendRows(
    spreadsheetId,
    `${historySheetName}!A:I`,
    rows,
    token
  );

  console.log(`✓ TRUST_INDEX_HISTORY appended: ${rows.length} rows`);
}

// -----------------------------
// MAIN WRITE
// -----------------------------
async function writeTrustIndex(results) {
  const token = await getAccessToken();

  const spreadsheetId = config.SPREADSHEETS.CORE_SYSTEM.id;

  const currentSheetName =
    config.SPREADSHEETS.CORE_SYSTEM.sheets.TRUST_INDEX_CURRENT;

  const historySheetName =
    config.SPREADSHEETS.CORE_SYSTEM.sheets.TRUST_INDEX_HISTORY ||
    "TRUST_INDEX_HISTORY";

  const rows = results.map(formatTrustIndexRow);

  await upsertCurrentRows({
    spreadsheetId,
    currentSheetName,
    rows,
    token
  });

  await appendHistoryRows({
    spreadsheetId,
    historySheetName,
    rows,
    token
  });
}

module.exports = {
  writeTrustIndex
};