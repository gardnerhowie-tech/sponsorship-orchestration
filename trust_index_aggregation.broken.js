const { google } = require("googleapis");
const config = require("./sheet_config");

const auth = new google.auth.GoogleAuth({
  keyFile: "../Host Responsiveness/sheets-service-account.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

async function getSheetsClient() {
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

// ----------------------------------------
// HISTORY (APPEND ONLY) — FIXED
// ----------------------------------------
async function writeHistory(sheets, results) {

  const spreadsheetId = config.SPREADSHEETS.CORE_SYSTEM.id;
  const sheetName = config.SPREADSHEETS.CORE_SYSTEM.sheets.TRUST_INDEX_HISTORY;

  const rows = results.map(r => [
    r.channel_id,
    r.trust_index_score,
    r.comment_signal,
    r.survey_signal,
    r.responsiveness_signal,
    r.signals_used_count,
    r.score_type,
    r.last_updated,
    r.aggregation_version
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:I`,
    valueInputOption: "RAW",
    resource: { values: rows }
  });
}

// ----------------------------------------
// CURRENT (UNCHANGED — YOUR WORKING LOGIC)
// ----------------------------------------
async function writeCurrent(sheets, results) {

  const spreadsheetId = config.SPREADSHEETS.CORE_SYSTEM.id;
  const sheetName = config.SPREADSHEETS.CORE_SYSTEM.sheets.TRUST_INDEX_CURRENT;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:I`
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
      r.last_updated,
      r.aggregation_version
    ];

    const existingRowIndex = indexMap[r.channel_id];

    if (existingRowIndex) {

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A${existingRowIndex}:I${existingRowIndex}`,
        valueInputOption: "RAW",
        resource: { values: [newRow] }
      });

    } else {

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:I`,
        valueInputOption: "RAW",
        resource: { values: [newRow] }
      });

    }
  }
}

// ----------------------------------------
// MAIN — SAME AS BEFORE
// ----------------------------------------
async function writeTrustIndex(results) {

  const sheets = await getSheetsClient();

  await writeHistory(sheets, results);
  await writeCurrent(sheets, results);
}

module.exports = { writeTrustIndex };