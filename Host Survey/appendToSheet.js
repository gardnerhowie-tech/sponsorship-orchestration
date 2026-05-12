const { google } = require("googleapis");

let sheetsClient = null;

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error("Missing GOOGLE_APPLICATION_CREDENTIALS");
  }

  if (!process.env.GOOGLE_SHEET_ID) {
    throw new Error("Missing GOOGLE_SHEET_ID");
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  const authClient = await auth.getClient();

  sheetsClient = google.sheets({
    version: "v4",
    auth: authClient
  });

  return sheetsClient;
}

async function appendToSheet(data) {
  console.log("appendToSheet called");

  try {
    const sheets = await getSheetsClient();

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "HOST_SURVEY_PIPELINE!A:E",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            data.channel_id,           // ✅ FIXED
            data.channel_url,
            data.survey_signal,
            new Date().toISOString(),
            "v1.0"
          ]
        ]
      }
    });

    console.log("Sheet write success");

  } catch (err) {
    console.error("Sheet write failed:");
    console.error(err.message);
  }
}

module.exports = appendToSheet;