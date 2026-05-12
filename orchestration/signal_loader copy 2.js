const fs = require("fs");
const crypto = require("crypto");
const config = require("./sheet_config");

// -----------------------------
// AUTH (SERVICE ACCOUNT → TOKEN)
// -----------------------------
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

  const unsigned =
    `${base64url(header)}.${base64url(claim)}`;

  const sign = crypto.createSign("RSA-SHA256");

  sign.update(unsigned);

  const signature = sign
    .sign(creds.private_key, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsigned}.${signature}`;

  const res = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type:
          "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt
      })
    }
  );

  const data = await res.json();

  return data.access_token;
}

// -----------------------------
// FETCH SHEET
// -----------------------------
async function fetchSheet(
  spreadsheetId,
  range,
  token
) {

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await res.json();

  return data.values || [];
}

// -----------------------------
// HELPERS
// -----------------------------
const clean = (v) =>
  v ? String(v).trim() : null;

const valid = (v) =>
  v !== null &&
  v !== undefined &&
  !isNaN(v);

// -----------------------------
// LOAD ALL SIGNALS
// -----------------------------
async function loadAllSignals() {

  const token = await getAccessToken();

  // -----------------------------
  // COMMENT SIGNAL
  // -----------------------------
  const commentRows = await fetchSheet(
    config.SPREADSHEETS.COMMENT_ANALYSIS.id,
    `${config.SPREADSHEETS.COMMENT_ANALYSIS.sheets.COMMENT_SIGNAL_OUTPUT}!A:F`,
    token
  );

  const comment = {};

  for (let i = 1; i < commentRows.length; i++) {

    const id = clean(commentRows[i][0]);

    const val = parseFloat(commentRows[i][1]);

    if (id && valid(val)) {
      comment[id] = val;
    }
  }

  // -----------------------------
  // SURVEY SIGNAL
  // -----------------------------
  const surveyRows = await fetchSheet(
    config.SPREADSHEETS.CORE_SYSTEM.id,
    `HOST_SURVEY_PIPELINE!A:E`,
    token
  );

  const latestSurvey = {};

  for (let i = 1; i < surveyRows.length; i++) {

    const id = clean(surveyRows[i][0]);

    const val = parseFloat(surveyRows[i][2]);

    const ts =
      new Date(surveyRows[i][3]).getTime();

    if (!id || !valid(val) || !ts) {
      continue;
    }

    if (
      !latestSurvey[id] ||
      ts > latestSurvey[id].ts
    ) {
      latestSurvey[id] = {
        score: val,
        ts
      };
    }
  }

  const survey = {};

  for (const id in latestSurvey) {
    survey[id] = latestSurvey[id].score;
  }

  // -----------------------------
  // RESPONSIVENESS SIGNAL
  // -----------------------------
  const respRows = await fetchSheet(
    config.SPREADSHEETS.HOST_RESPONSIVENESS.id,
    "HOST_RESPONSIVENESS!A:C",
    token
  );

  const latestResp = {};

  for (let i = 1; i < respRows.length; i++) {

    const id = clean(respRows[i][0]);

    const score =
      parseFloat(respRows[i][1]);

    const ts =
      new Date(respRows[i][2]).getTime();

    if (!id || !valid(score)) {
      continue;
    }

    if (
      !latestResp[id] ||
      ts > latestResp[id].ts
    ) {
      latestResp[id] = {
        score,
        ts
      };
    }
  }

  const resp = {};

  for (const id in latestResp) {
    resp[id] =
      latestResp[id].score / 100;
  }

  // -----------------------------
  // COMBINE
  // -----------------------------
  const channels = new Set([
    ...Object.keys(comment),
    ...Object.keys(survey),
    ...Object.keys(resp)
  ]);

  return [...channels].map(id => ({
    channel_id: id,
    comment_signal:
      comment[id] ?? null,
    survey_signal:
      survey[id] ?? null,
    responsiveness_signal:
      resp[id] ?? null,
    live_events_signal: null
  }));
}

module.exports = {
  loadAllSignals
};