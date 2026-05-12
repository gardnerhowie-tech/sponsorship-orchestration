console.log("STEP 1: RUNNER START");

import fs from "fs";

async function getAccessToken() {
  const creds = JSON.parse(
    fs.readFileSync("./sheets-service-account.json")
  );

  const jwtHeader = {
    alg: "RS256",
    typ: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);

  const jwtClaim = {
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  function base64url(input) {
    return Buffer.from(JSON.stringify(input))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }

  const unsignedToken =
    base64url(jwtHeader) + "." + base64url(jwtClaim);

  const crypto = await import("crypto");

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsignedToken);

  const signature = sign
    .sign(creds.private_key, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsignedToken}.${signature}`;

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

  return data.access_token;
}

(async () => {
  try {
    console.log("STEP 2: importing module...");
    const mod = await import("./host_responsiveness.js");

    console.log("STEP 3: module imported");

    const channelId = process.argv[2];

    console.log("STEP 4: running analysis...");
    const result = await mod.run(channelId);

    console.log("STEP 5: result:");
    console.log(result);

    console.log("STEP 6: getting access token...");
    const token = await getAccessToken();

    const SPREADSHEET_ID =
      "1pAAeI8iD8VcO2flmAu02kxhIo9nsSkWj4RxphejRZvI";

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
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/MASTER_HOST_RESPONSIVENESS!A:H:append?valueInputOption=RAW`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ values: [masterRow] })
      }
    );

    console.log("STEP 8: writing SIGNAL...");
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/HOST_RESPONSIVENESS!A:C:append?valueInputOption=RAW`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ values: [signalRow] })
      }
    );

    console.log("✅ DONE");

  } catch (err) {
    console.error("🔥 ERROR CAUGHT:");
    console.error(err);
  }
})();