#!/usr/bin/env node

// =============================================================================
// Naro Trust Index — Step 2 (Comment Analysis) Calibration Runner
// Model:          claude-sonnet-4-6
// Temperature:    0
// Prompt:         Section 24, v1.1 (exact text, no edits)
// Input:          CSV with columns comment_id, comment_text
// Output:         CSV with AI classifications + run metadata
// API key:        read from ANTHROPIC_API_KEY environment variable
// =============================================================================

const fs   = require('fs');
const path = require('path');
const https = require('https');

// ── Config ────────────────────────────────────────────────────────────────────
const MODEL          = 'claude-sonnet-4-6';
const TEMPERATURE    = 0;
const PROMPT_VERSION = 'V1.1';
const MAX_TOKENS     = 16000;

// ── Args ──────────────────────────────────────────────────────────────────────
const inputCsv  = process.argv[2];
const outputCsv = process.argv[3] || 'calibration_ai_output.csv';

if (!inputCsv) {
  console.error('Usage: node calibration_run.js <input.csv> [output.csv]');
  console.error('Example: node calibration_run.js Calibration_Set_v1_0_PRE_AI_RUN.csv calibration_ai_output.csv');
  process.exit(1);
}

// ── API key ───────────────────────────────────────────────────────────────────
const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable is not set.');
  console.error('Set it with: export ANTHROPIC_API_KEY=your_key_here');
  process.exit(1);
}

// ── Prompt (exact text from Section 24 of master doc v2.2) ───────────────────
// No edits, no paraphrasing. Separator lines preserved as-is.
const PROMPT_BODY = `You are a comment classification system for the Naro Trust Index. You classify YouTube comments from podcast videos against six independent criteria. You do not produce scores, summaries, or recommendations. You produce structured per-comment classifications only.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
CORE INSTRUCTIONS
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

You will receive a JSON array of comments. For each comment, classify it against all six components below. Each classification is independent — do not let your judgement on one component influence your judgement on another. A single comment can satisfy zero, one, or all six components simultaneously.

Classify each comment in isolation. Do not form an overall impression of the show. Do not let earlier comments in the list influence your classification of later ones. Treat every comment as if it were the only comment you were scoring.

If a comment is ambiguous, apply the inclusion and exclusion criteria literally. Do not infer intent beyond what the text explicitly contains. If a criterion is not clearly met by the text, the answer is "no" (or "neutral" for sentiment).

Return your output as valid JSON only. No commentary, no explanation, no markdown formatting around the JSON.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
COMPONENT 1 — SENTIMENT
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Measures the commenter's emotional tone toward the host, the show, or the show's content. Excludes tone toward sponsors, guests, other commenters, or external entities discussed in the episode.

Classify each comment as one of: "positive", "negative", "neutral", "mixed", or "excluded".

POSITIVE — meets at least one of:
- Expresses praise, enjoyment, gratitude, or enthusiasm directed at the host or show
- Uses positive emoji or reactions clearly directed at the host or show, accompanied by any text
- Expresses recommendation or endorsement of the show

NEGATIVE — meets at least one of:
- Expresses criticism, disappointment, or frustration directed at the host or show
- Attacks the host's character, competence, or motives
- Expresses regret about listening or intent to stop listening

NEUTRAL — meets at least one of:
- Asks a factual question without emotional tone
- Adds information or correction without emotional tone
- Discusses the topic of the episode without expressing feeling about the show itself

MIXED — contains both clearly positive and clearly negative elements toward the show.

EXCLUDED — comment is directed at guests, sponsors, other commenters, or external entities only, with no reference to the host or show.

EXAMPLES
"this is the only podcast I never skip" \u2192 positive
"used to love this but the last few episodes have been phoned in" \u2192 negative
"what's the name of the study you mentioned around 23 minutes?" \u2192 neutral
"love you guys but this guest was insufferable" \u2192 mixed
"that guest is a fraud" \u2192 excluded

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
COMPONENT 2 — COMMENT DEPTH
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Measures cognitive investment in the comment. Scored independently of sentiment — long considered criticism counts as deep.

Classify each comment as one of: "deep" or "shallow".

DEEP — meets BOTH of:
- Contains at least two complete sentences OR exceeds 25 words
- Demonstrates effort beyond a reaction. Must contain at least one of: a personal reflection, an opinion with reasoning, a contextual question, a description of the listener's experience, or a response to specific show content

SHALLOW — meets any of:
- Single sentence under 25 words with no specific reference to the show's content
- Purely reactive ("loved it", "great stuff")
- Purely a thank-you or generic praise
- One-line question without context

Length alone does not make a comment deep. Repetitive long praise is shallow. Substance and length both required.

EXAMPLES
"the framing around incentive design at minute 18 actually made me rethink how we structure quarterly bonuses on my team. been chewing on it all week." \u2192 deep
"I disagree with the guest's take on remote work. the data she cited is from a single industry and doesn't generalise." \u2192 deep
"absolutely loved this one!!" \u2192 shallow
"great interview thanks" \u2192 shallow

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
COMPONENT 3 — PARASOCIAL / RELATIONAL LANGUAGE
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Measures whether the commenter relates to the host as someone personally known or connected to, rather than as a content producer.

Classify each comment as one of: "yes" or "no".

YES — meets at least one of:
- References the host by first name or nickname in a familiar, conversational way
- Describes a personal emotional impact tied to the host as a person, not the content
- Expresses a relationship-style sentiment toward the host
- Addresses the host directly with intimate or affectionate framing

NO — any of the following:
- Only praises the content, episode, or interview
- Only thanks the host generically
- Praises the host's professional skill without expressing personal connection
- Addresses a guest rather than the host
- Uses second-person language only about the work, not the relationship

TEST: would this comment make sense if a stranger said it about a journalist they had never heard of before? If yes, classify "no". If the comment only makes sense from someone who feels they know the host, classify "yes".

EXAMPLES
"Sarah I swear you're inside my head this week" \u2192 yes
"been listening every Monday for two years and you feel like a friend I never get to see" \u2192 yes
"Great interview with the guest, really thought-provoking stuff" \u2192 no
"You're an excellent interviewer, the questions were sharp" \u2192 no

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
COMPONENT 4 — BEHAVIOURAL CHANGE INDICATORS
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Measures comments where the listener describes doing, changing, starting, or seeking something as a result of the show.

Classify each comment as one of: "yes" or "no".

YES — meets BOTH of:
- Describes a concrete action, change, decision, or information-seeking behaviour — taken, in progress, or imminent
- Contains a causal link to the show, host, or episode. The link can be explicit ("because of this", "after listening") OR self-evident from the action itself (e.g. asking for a study referenced in the episode is self-evidently caused by the episode)

NO — any of:
- Expresses agreement or strong feeling without describing an action
- Describes vague intention without specifics
- Describes an action that pre-existed the show
- References commerce or purchase behaviour (tracked separately, not here)

The action can be anything: behaviour change, habit start, mindset shift acted upon, decision made, project begun, information sought.

EXAMPLES
"started journaling every morning after episode 12 and three months later it's the best habit I've built in years" \u2192 yes
"your point about one-to-ones made me completely restructure how I run my team meetings" \u2192 yes
"what's the name of the study you mentioned around 23 minutes?" \u2192 yes (self-evident causal link)
"this really made me think about how I manage my time" \u2192 no (no concrete action)
"100% agree, I've always said this" \u2192 no (no causal link to the show)

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
COMPONENT 5 — SUBSTANTIVE ENGAGEMENT WITH CONTENT
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Measures whether the comment demonstrates active listening through specific references to episode content. Distinct from depth — a comment can be long without engaging specifically, or short while engaging specifically.

Classify each comment as one of: "yes" or "no".

YES — meets at least one of:
- Quotes or paraphrases something the host or guest said
- References a specific timestamp, segment, or moment
- Names a specific guest, book, study, framework, or example mentioned in the episode
- Pushes back on, agrees with, or extends a specific argument made in the episode
- Asks a follow-up question grounded in specific episode content
- Adds personal experience that directly responds to a point made in the episode
- References a specific structural part of the episode that the commenter would only know by watching (e.g. "the ending", "the intro", "the Q&A section", "the last 20 minutes", "the ad breaks in this one")

NO — any of:
- Praises or criticises the episode without referencing anything specific from it
- Discusses the general topic of the show without engaging with what was actually said
- Asks a question unrelated to specific episode content
- Pure emotional reaction without content reference
- Generic references to the episode as a format do NOT count: "the interview", "the episode", "the conversation", "the show". These could be written by someone who never watched.

TEST: could this comment have been written by someone who only read the episode title without listening? If yes, classify "no". If the comment proves the listener heard specific content, classify "yes".

EXAMPLES
"the framing around incentive design around 18 minutes is exactly what's missing from most management books" \u2192 yes
"disagree with the guest on remote work — she's generalising from tech sector data" \u2192 yes
"great topic, more episodes like this please" \u2192 no
"I work in management and this stuff is so important" \u2192 no
"loved the ending" → yes (structural reference proving the commenter watched to the end)
"amazing interview, love the ending" → yes (structural reference)
"fantastic interviewer" → no (praises role, doesn't reference anything specific)
"great interview" → no (generic reference to format)

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
COMPONENT 6 — RETURNING LISTENER SIGNALS
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Measures explicit language indicating the commenter is a repeat or long-term listener. Trust compounds over time, making longevity a trust proxy.

Classify each comment as one of: "yes" or "no".

YES — meets at least one of:
- Explicitly references duration of listenership ("been listening for two years", "since episode 1", "long time listener")
- Explicitly references regular or repeat listening ("every week", "every Monday", "never miss")
- References past episodes in a way that implies the commenter heard them
- Uses "as always", "as usual", "again", "still" in a way that implies ongoing listenership
- References waiting for, anticipating, or having missed episodes

NO — any of:
- Praises the show without any temporal or repetition marker
- Could plausibly be written by a first-time listener
- References the topic generally without referencing past episodes

TEST: does the comment contain explicit evidence the commenter has listened before? If a brand new listener could have written exactly this comment, classify "no".

EXAMPLES
"been following since the early episodes when you only had a handful of subscribers" \u2192 yes
"another banger, never miss a Monday with you guys" \u2192 yes
"great episode, just discovered the show" \u2192 no
"loved this one, the topic is so important" \u2192 no

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
OUTPUT FORMAT
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Return a JSON array. One object per input comment, in the same order as the input. Each object must contain exactly these fields:

{
"comment_id": "<the id from the input>",
"sentiment": "<positive | negative | neutral | mixed | excluded>",
"depth": "<deep | shallow>",
"parasocial": "<yes | no>",
"behavioural_change": "<yes | no>",
"substantive_engagement": "<yes | no>",
"returning_listener": "<yes | no>"
}

Do not include any other fields. Do not include explanations, confidence scores, or commentary. Do not wrap the JSON in markdown code fences. Return only the JSON array.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
INPUT COMMENTS
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

{INPUT_COMMENTS_JSON}`;

// ── CSV parser (no dependencies) ──────────────────────────────────────────────
function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const headers = splitCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = splitCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h.trim()] = (values[idx] || '').trim(); });
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// ── CSV writer ────────────────────────────────────────────────────────────────
function toCsvValue(v) {
  const s = String(v == null ? '' : v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function writeCsv(filepath, rows, headers) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => toCsvValue(row[h])).join(','));
  }
  fs.writeFileSync(filepath, lines.join('\n'), 'utf8');
}

// ── HTTPS request (no dependencies) ──────────────────────────────────────────
function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname, path, method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(data) }
    };
    const req = https.request(options, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error('Failed to parse response: ' + raw.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Read and parse input CSV
  if (!fs.existsSync(inputCsv)) {
    console.error(`Error: input file not found: ${inputCsv}`);
    process.exit(1);
  }
  const rawCsv = fs.readFileSync(inputCsv, 'utf8');
  const rows = parseCsv(rawCsv);

  if (!rows.length) {
    console.error('Error: input CSV is empty or could not be parsed.');
    process.exit(1);
  }

  const idCol   = rows[0].hasOwnProperty('comment_id')   ? 'comment_id'   : Object.keys(rows[0])[0];
  const textCol = rows[0].hasOwnProperty('comment_text')  ? 'comment_text' : Object.keys(rows[0])[1];

  console.log(`Input: ${rows.length} comments from "${inputCsv}"`);
  console.log(`ID column: "${idCol}" | Text column: "${textCol}"`);

  // 2. Format as JSON array for prompt
  const channelCol = rows[0].hasOwnProperty('channelID') ? 'channelID' : null;

const comments = rows.map(r => ({
  channelID: channelCol ? r[channelCol] : '',
  comment_id: r[idCol],
  comment_text: r[textCol]
}));
  const inputJson = JSON.stringify(comments, null, 2);
  const fullPrompt = PROMPT_BODY.replace('{INPUT_COMMENTS_JSON}', inputJson);

  // 3. Call the API
  console.log(`\nCalling API...`);
  console.log(`  Model:          ${MODEL}`);
  console.log(`  Temperature:    ${TEMPERATURE}`);
  console.log(`  Prompt version: ${PROMPT_VERSION}`);
  console.log(`  Comments:       ${comments.length}`);

  const requestBody = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    messages: [{ role: 'user', content: fullPrompt }]
  };

  const response = await httpsPost(
    'api.anthropic.com',
    '/v1/messages',
    {
      'Content-Type':      'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key':         API_KEY
    },
    requestBody
  );

  if (response.error) {
    console.error('\nAPI error:', JSON.stringify(response.error, null, 2));
    process.exit(1);
  }

  // 4. Parse JSON response
  const rawText = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();

  let cleaned = rawText;
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/```\s*$/, '').trim();
  }

  let aiResults;
  try {
    aiResults = JSON.parse(cleaned);
  } catch (e) {
    console.error('\nFailed to parse AI response as JSON.');
    console.error('Raw response (first 500 chars):', rawText.slice(0, 500));
    process.exit(1);
  }

  console.log(`\nAPI returned ${aiResults.length} classifications.`);

  // Validate all 54 came back
  if (aiResults.length !== comments.length) {
    console.warn(`WARNING: sent ${comments.length} comments, received ${aiResults.length} classifications.`);
  }

  // 5. Write output CSV
  const runDate = new Date().toISOString().split('T')[0];
  const outputHeaders = [
  'channelID',
  'comment_id',
  'run_date',
  'model_version',
  'prompt_version',
  'ai_sentiment',
  'ai_depth',
  'ai_parasocial',
  'ai_behavioural_change',
  'ai_substantive_engagement',
  'ai_returning_listener'
];

  const outputRows = aiResults.map((r, i) => ({
  channelID:                  comments[i].channelID || '',
  comment_id:                 r.comment_id,
  run_date:                   runDate,
  model_version:              MODEL,
  prompt_version:             PROMPT_VERSION,
  ai_sentiment:               r.sentiment              || '',
  ai_depth:                   r.depth                  || '',
  ai_parasocial:              r.parasocial             || '',
  ai_behavioural_change:      r.behavioural_change     || '',
  ai_substantive_engagement:  r.substantive_engagement || '',
  ai_returning_listener:      r.returning_listener     || ''
}));

  writeCsv(outputCsv, outputRows, outputHeaders);
  console.log(`\nOutput written to: ${outputCsv}`);
  console.log(`Rows: ${outputRows.length}`);
  console.log('\nDone. Load the output CSV alongside your human labels to compute agreement rates.');
}

main().catch(err => {
  console.error('\nUnexpected error:', err.message);
  process.exit(1);
});
