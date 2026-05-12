const fs = require("fs");
const crypto = require("crypto");
const config = require("./sheet_config");

async function getAccessToken() {
  const creds = JSON.parse(
    fs.readFileSync("../Host Responsiveness/sheets-service-account.json")
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
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("❌ TOKEN ERROR:");
    console.error(data);
    throw new Error("Failed to get access token");
  }

  console.log("✓ Access token generated for:", creds.client_email);

  return data.access_token;
}

async function writeTrustIndex(results) {
  const token = await getAccessToken();
  const id = config.SPREADSHEETS.CORE_SYSTEM.id;

  console.log("→ CORE_SYSTEM spreadsheet ID:", id);

  console.log("→ Testing spreadsheet access...");
  const testRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${id}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  const testData = await testRes.json();

  console.log("TEST STATUS:", testRes.status);
  console.log("TEST RESPONSE:", JSON.stringify(testData, null, 2));

  if (!testRes.ok) {
    throw new Error("Spreadsheet access test failed");
  }

  const timestamp = new Date().toISOString();

  const rows = results.map(r => {
    const count = [
      r.comment_signal,
      r.survey_signal,
      r.responsiveness_signal,
      r.live_events_signal
    ].filter(v => v !== null && v !== undefined).length;

    return [
      r.channel_id,
      r.trust_index_score,
      "UNVERIFIED",
      r.comment_signal,
      r.survey_signal,
      r.live_events_signal,
      r.responsiveness_signal,
      count,
      timestamp,
      "v1.0"
    ];
  });

  console.log("→ Writing TRUST_INDEX_HISTORY...");

  const historyRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent("TRUST_INDEX_HISTORY!A1")}:append?valueInputOption=RAW`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ values: rows })
    }
  );

  const historyData = await historyRes.json();

  if (!historyRes.ok) {
    console.error("❌ HISTORY WRITE FAILED:");
    console.error(JSON.stringify(historyData, null, 2));
    throw new Error("History write failed");
  }

  console.log("✓ History write success");

  console.log("→ Writing TRUST_INDEX_CURRENT...");

  const currentRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent("TRUST_INDEX_CURRENT!A2:J")}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ values: rows })
    }
  );

  const currentData = await currentRes.json();

  if (!currentRes.ok) {
    console.error("❌ CURRENT WRITE FAILED:");
    console.error(JSON.stringify(currentData, null, 2));
    throw new Error("Current write failed");
  }

  console.log("✓ Current write success");
  console.log("✓ Trust Index written");
}

module.exports = { writeTrustIndex };