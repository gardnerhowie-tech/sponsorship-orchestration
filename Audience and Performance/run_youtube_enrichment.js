require("dotenv").config();

const { google } = require("googleapis");
const path = require("path");

const CHANNEL_ID = process.argv[2];

const SHEET_NAME = "YOUTUBE_CHANNEL_METRICS";
const RANGE = `${SHEET_NAME}!A:K`;

const HEADERS = [
  "channel_id",
  "channel_name",
  "channel_thumbnail",
  "subscribers",
  "avg_views",
  "median_views",
  "avg_likes",
  "avg_comments",
  "engagement_rate",
  "video_count",
  "last_updated",
];

const VIDEO_LIMIT = 20;

const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID ||
  process.env.GOOGLE_SHEET_ID ||
  process.env.GOOGLE_SPREADSHEET_ID;

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

const SERVICE_ACCOUNT_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(__dirname, "sheets-service-account.json");

if (!CHANNEL_ID || !CHANNEL_ID.startsWith("UC")) {
  console.error("Usage: node run_youtube_enrichment.js <CHANNEL_ID>");
  process.exit(1);
}

if (!YOUTUBE_API_KEY) {
  console.error("Missing YOUTUBE_API_KEY in .env");
  process.exit(1);
}

if (!SPREADSHEET_ID) {
  console.error("Missing GOOGLE_SPREADSHEET_ID in .env");
  process.exit(1);
}

async function getSheetsClient() {

  const credentials = JSON.parse(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  );

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets"
    ]
  });

  return google.sheets({ version: "v4", auth });
}

function getYouTubeClient() {
  return google.youtube({
    version: "v3",
    auth: YOUTUBE_API_KEY,
  });
}

async function ensureSheetExists(sheets) {
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const existingSheet = spreadsheet.data.sheets.find(
    (s) => s.properties.title === SHEET_NAME
  );

  if (!existingSheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: SHEET_NAME,
              },
            },
          },
        ],
      },
    });

    console.log(`Created sheet: ${SHEET_NAME}`);
  }

  const headerCheck = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1:K1`,
  });

  const currentHeaders = headerCheck.data.values?.[0] || [];

  const headersMismatch =
    currentHeaders.length !== HEADERS.length ||
    HEADERS.some((h, i) => currentHeaders[i] !== h);

  if (headersMismatch) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:K1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [HEADERS],
      },
    });

    console.log("Header row written/updated.");
  }
}

async function fetchChannelStats(youtube, channelId) {
  const res = await youtube.channels.list({
    part: ["snippet", "statistics", "contentDetails"],
    id: [channelId],
  });

  const channel = res.data.items?.[0];

  if (!channel) {
    throw new Error(`No YouTube channel found for channel_id: ${channelId}`);
  }

  const stats = channel.statistics || {};
  const snippet = channel.snippet || {};

  const uploadsPlaylistId =
    channel.contentDetails?.relatedPlaylists?.uploads;

  return {
    channel_name: snippet.title || null,
    channel_thumbnail:
      snippet.thumbnails?.high?.url ||
      snippet.thumbnails?.medium?.url ||
      snippet.thumbnails?.default?.url ||
      null,

    subscribers: Number(stats.subscriberCount || 0),
    video_count: Number(stats.videoCount || 0),
    uploadsPlaylistId,
  };
}

async function fetchRecentVideoIds(youtube, uploadsPlaylistId) {
  const res = await youtube.playlistItems.list({
    part: ["contentDetails"],
    playlistId: uploadsPlaylistId,
    maxResults: VIDEO_LIMIT,
  });

  return (res.data.items || [])
    .map((item) => item.contentDetails?.videoId)
    .filter(Boolean);
}

async function fetchVideoStats(youtube, videoIds) {
  if (!videoIds.length) return [];

  const res = await youtube.videos.list({
    part: ["statistics"],
    id: videoIds,
    maxResults: VIDEO_LIMIT,
  });

  return (res.data.items || []).map((video) => {
    const stats = video.statistics || {};

    return {
      views: Number(stats.viewCount || 0),
      likes: Number(stats.likeCount || 0),
      comments: Number(stats.commentCount || 0),
    };
  });
}

function average(nums) {
  if (!nums.length) return 0;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function median(nums) {
  if (!nums.length) return 0;

  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round(value, decimals = 4) {
  return Number(Number(value).toFixed(decimals));
}

function computeMetrics(channelStats, videoStats) {
  const validVideos = videoStats.filter((v) => v.views > 0);

  const viewsArray = validVideos.map((v) => v.views);

  const perVideoEngagementRates = validVideos.map(
    (v) => (v.likes + v.comments) / v.views
  );

  return {
    channel_id: CHANNEL_ID,

    channel_name: channelStats.channel_name,
    channel_thumbnail: channelStats.channel_thumbnail,

    subscribers: channelStats.subscribers,

    avg_views: Math.round(average(viewsArray)),

    median_views: Math.round(median(viewsArray)),

    avg_likes: Math.round(average(validVideos.map((v) => v.likes))),

    avg_comments: Math.round(average(validVideos.map((v) => v.comments))),

    engagement_rate: round(average(perVideoEngagementRates), 4),

    video_count: channelStats.video_count,

    last_updated: new Date().toISOString(),
  };
}

async function upsertMetricsRow(sheets, metrics) {
  await ensureSheetExists(sheets);

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: RANGE,
  });

  const rows = existing.data.values || [];
  const dataRows = rows.slice(1);

  const existingIndex = dataRows.findIndex(
  (row) =>
    String(row[0] || "").trim() ===
    String(metrics.channel_id || "").trim()
);

  const values = [
    metrics.channel_id,
    metrics.channel_name,
    metrics.channel_thumbnail,
    metrics.subscribers,
    metrics.avg_views,
    metrics.median_views,
    metrics.avg_likes,
    metrics.avg_comments,
    metrics.engagement_rate,
    metrics.video_count,
    metrics.last_updated,
  ];

  if (existingIndex >= 0) {
    const sheetRowNumber = existingIndex + 2;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A${sheetRowNumber}:K${sheetRowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [values],
      },
    });

    console.log(`Updated existing row for ${metrics.channel_id}`);
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [values],
      },
    });

    console.log(`Inserted new row for ${metrics.channel_id}`);
  }
}

async function main() {
  console.log(`Running YouTube enrichment for ${CHANNEL_ID}`);

  const sheets = await getSheetsClient();
  const youtube = getYouTubeClient();

  const channelStats = await fetchChannelStats(youtube, CHANNEL_ID);

  const videoIds = await fetchRecentVideoIds(
    youtube,
    channelStats.uploadsPlaylistId
  );

  const videoStats = await fetchVideoStats(youtube, videoIds);

  const metrics = computeMetrics(channelStats, videoStats);

  await upsertMetricsRow(sheets, metrics);

  console.log("Done.");

  console.table(metrics);
}

main().catch((err) => {
  console.error("YouTube enrichment failed:");
  console.error(err.message);
  process.exit(1);
});
