require("dotenv").config();
const axios = require("axios");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const PROMPT_VERSION = process.env.PROMPT_VERSION || "v1.1";

const CLAUDE_URL = "https://api.anthropic.com/v1/messages";
const MODEL_NAME = "claude-sonnet-4-0";

const INITIAL_BATCH_SIZE = 12;
const MIN_BATCH_SIZE = 3;
const MAX_TOKENS = 1200;
const DELAY_BETWEEN_CALLS_MS = 5000;
const API_TIMEOUT_MS = 45000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildPrompt(comments) {
  const commentBlock = comments
    .map((c, i) => `${i + 1}. ${c.comment_text}`)
    .join("\n");

  return `
Prompt Version: ${PROMPT_VERSION}

You are analysing YouTube podcast comments.

For each comment, score the following dimensions from 0 to 1:

Sentiment
Depth
Parasocial
Behavioural Change
Substantive Engagement
Returning Listener

Return ONLY valid JSON using EXACTLY this schema:

[
{
"index": 1,
"sentiment": 0.0,
"depth": 0.0,
"parasocial": 0.0,
"behavioural_change": 0.0,
"substantive_engagement": 0.0,
"returning_listener": 0.0
}
]

Rules:
- Return exactly one object per comment
- Index numbers must match the comment numbers below
- All numbers must be between 0 and 1
- Do NOT change field names
- Do NOT include explanations
- Do NOT include markdown
- Output ONLY JSON

Comments:

${commentBlock}
`;
}

function chunkComments(comments, batchSize = INITIAL_BATCH_SIZE) {
  const batches = [];

  for (let i = 0; i < comments.length; i += batchSize) {
    batches.push(comments.slice(i, i + batchSize));
  }

  return batches;
}

function sanitizeClaudeJSON(text) {
  let jsonText = text.trim();

  const start = jsonText.indexOf("[");
  const end = jsonText.lastIndexOf("]");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Claude returned incomplete or missing JSON array");
  }

  jsonText = jsonText.slice(start, end + 1);

  jsonText = jsonText.replace(/:\s*(-?\d+)\.\s*(?=[,}])/g, ": $1.0");
  jsonText = jsonText.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");

  return jsonText;
}

function validateParsedRows(parsed, expectedCount) {
  if (!Array.isArray(parsed)) {
    throw new Error("Claude output was not an array");
  }

  if (parsed.length !== expectedCount) {
    throw new Error(
      `Claude output row count mismatch. Expected ${expectedCount}, got ${parsed.length}`
    );
  }

  const requiredFields = [
    "index",
    "sentiment",
    "depth",
    "parasocial",
    "behavioural_change",
    "substantive_engagement",
    "returning_listener"
  ];

  parsed.forEach((row, i) => {
    requiredFields.forEach((field) => {
      if (!(field in row)) {
        throw new Error(`Missing field in Claude output: ${field}`);
      }
    });

    if (Number(row.index) !== i + 1) {
      throw new Error(
        `Claude index mismatch. Expected ${i + 1}, got ${row.index}`
      );
    }

    requiredFields
      .filter(field => field !== "index")
      .forEach((field) => {
        const value = Number(row[field]);

        if (!Number.isFinite(value)) {
          throw new Error(`Invalid numeric value for ${field}: ${row[field]}`);
        }

        row[field] = Math.min(1, Math.max(0, value));
      });
  });
}

async function callClaude(batch) {
  const prompt = buildPrompt(batch);

  const response = await axios.post(
    CLAUDE_URL,
    {
      model: MODEL_NAME,
      max_tokens: MAX_TOKENS,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    },
    {
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      timeout: API_TIMEOUT_MS
    }
  );

  const text = response.data?.content?.[0]?.text?.trim();

  if (!text) {
    throw new Error("Claude returned empty response");
  }

  const sanitized = sanitizeClaudeJSON(text);
  const parsed = JSON.parse(sanitized);

  validateParsedRows(parsed, batch.length);

  return parsed;
}

async function classifyBatchWithFallback(batch, label = "batch") {
  try {
    return await callClaude(batch);
  } catch (err) {
    const apiError = err.response?.data;

    if (apiError) {
      console.error("Claude API Error:", apiError);
    } else {
      console.warn(`Claude parse/call issue in ${label}: ${err.message}`);
    }

    if (batch.length <= MIN_BATCH_SIZE) {
      throw new Error(
        `Claude classification failed at minimum batch size (${batch.length}): ${err.message}`
      );
    }

    const mid = Math.ceil(batch.length / 2);
    const firstHalf = batch.slice(0, mid);
    const secondHalf = batch.slice(mid);

    console.warn(
      `Retrying ${label} as smaller batches: ${firstHalf.length} + ${secondHalf.length}`
    );

    await sleep(DELAY_BETWEEN_CALLS_MS);

    const firstResults = await classifyBatchWithFallback(firstHalf, `${label}.1`);

    await sleep(DELAY_BETWEEN_CALLS_MS);

    const secondResults = await classifyBatchWithFallback(secondHalf, `${label}.2`);

    return [...firstResults, ...secondResults];
  }
}

async function classifyComments(comments) {
  if (!comments || comments.length === 0) {
    return [];
  }

  if (!ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY in .env");
  }

  const batches = chunkComments(comments, INITIAL_BATCH_SIZE);
  const allResults = [];

  console.log(`\nTotal batches: ${batches.length}`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    console.log(`\nBatch ${i + 1}/${batches.length} → ${batch.length} comments`);

    const parsed = await classifyBatchWithFallback(batch, `batch ${i + 1}`);

    allResults.push(...parsed);

    if (i < batches.length - 1) {
      console.log(`Waiting ${DELAY_BETWEEN_CALLS_MS / 1000}s to avoid rate limits...`);
      await sleep(DELAY_BETWEEN_CALLS_MS);
    }
  }

  return allResults;
}

function prepareTopLevelComments(rawComments) {
  if (!rawComments) return [];
  return rawComments.filter((c) => !c.is_reply);
}

module.exports = {
  classifyComments,
  prepareTopLevelComments
};