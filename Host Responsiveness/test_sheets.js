import { google } from "googleapis";

async function test() {

  const auth = new google.auth.GoogleAuth({
    keyFile: "sheets-service-account.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  const sheets = google.sheets({ version: "v4", auth });

  const spreadsheetId = "14tYjvqaTJeNBe0AwhxIEPj6RjfKdudhV5QzRFfpAf0E";

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "HOST_RESPONSIVENESS!A:J",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        "TEST_SHOW",
        "TEST_CHANNEL",
        20,
        100,
        10,
        8,
        0.08,
        70,
        new Date().toISOString(),
        "v1"
      ]]
    }
  });

  console.log("Row added successfully");

}

test();