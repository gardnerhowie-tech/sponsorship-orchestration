console.log("STEP 1: RUNNER START");

(async () => {
  try {
    console.log("STEP 2: importing module...");
    const mod = await import("./host_responsiveness.js");

    console.log("STEP 3: module imported");

    const channelId = process.argv[2];

    if (!channelId) {
      console.error("Provide channel_id");
      process.exit(1);
    }

    console.log("STEP 4: running analysis...");
    const result = await mod.run(channelId);

    console.log("STEP 5: result:");
    console.log(result);

    // 🔴 LOAD GOOGLEAPIS AFTER COMPUTE (prevents hang)
    console.log("STEP 6: loading sheets client...");
    const { google } = await import("googleapis");

    const auth = new google.auth.GoogleAuth({
      keyFile: "./sheets-service-account.json",
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    // 🔴 YOUR SPREADSHEET ID
    const SPREADSHEET_ID = "1pAAeI8iD8VcO2flmAu02kxhIo9nsSkWj4RxphejRZvI";

    const timestamp = new Date().toISOString();

    const masterRow = [
      channelId,
      timestamp,
      result.totalThreads,
      result.threadsWithHostReply,
      result.validHostReplies,
      result.responseRate,
      result.score,
      "v1"
    ];

    const signalRow = [
      channelId,
      result.score,
      timestamp
    ];

    console.log("STEP 7: writing MASTER...");
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "MASTER_HOST_RESPONSIVENESS!A:H",
      valueInputOption: "RAW",
      requestBody: {
        values: [masterRow]
      }
    });

    console.log("STEP 8: writing SIGNAL...");
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "HOST_RESPONSIVENESS!A:C",
      valueInputOption: "RAW",
      requestBody: {
        values: [signalRow]
      }
    });

    console.log("✅ DONE");

  } catch (err) {
    console.error("🔥 ERROR CAUGHT:");
    console.error(err);
  }
})();