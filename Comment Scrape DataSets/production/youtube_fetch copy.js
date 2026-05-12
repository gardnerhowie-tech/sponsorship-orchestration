require("dotenv").config();
const axios = require("axios");
const { parse, toSeconds } = require("iso8601-duration");

/* ================================
CONFIG
================================ */

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const VIDEOS_TO_SAMPLE = Number(process.env.VIDEOS_TO_SAMPLE || 3);
const VIDEO_LOOKBACK_DAYS = Number(process.env.VIDEO_LOOKBACK_DAYS || 90);
const MIN_VIDEO_DURATION_MINUTES = Number(process.env.MIN_VIDEO_DURATION_MINUTES || 20);

const YOUTUBE_BASE_URL = "https://www.googleapis.com/youtube/v3";

const MAX_VIDEO_PAGES = 5;
const MAX_COMMENT_PAGES = 8;
const REQUEST_TIMEOUT = 20000;

/* ================================
UTILS
================================ */

function assertEnv() {
  if (!YOUTUBE_API_KEY) {
    throw new Error("Missing YOUTUBE_API_KEY in .env");
  }
}

function isoDurationToSeconds(isoDuration) {
  try {
    return toSeconds(parse(isoDuration));
  } catch {
    return 0;
  }
}

function getPublishedAfterDate(daysBack) {
  const now = new Date();
  const publishedAfter = new Date(now.getTime() - daysBack * 86400000);
  return publishedAfter.toISOString();
}

/* ================================
SAFE API CALL
================================ */

async function youtubeGet(endpoint, params) {
  try {
    const response = await axios.get(`${YOUTUBE_BASE_URL}/${endpoint}`, {
      params: {
        ...params,
        key: YOUTUBE_API_KEY,
      },
      timeout: REQUEST_TIMEOUT,
    });

    return response.data;

  } catch (err) {
    console.error("YouTube API error:", err.message);
    throw err;
  }
}

/* ================================
FETCH VIDEOS (SAFE PAGINATION)
================================ */

async function getRecentChannelVideos(channelId, lookbackDays) {

  const publishedAfter = getPublishedAfterDate(lookbackDays);
  let nextPageToken = null;
  let pageCount = 0;

  const allVideos = [];

  do {

    if (pageCount >= MAX_VIDEO_PAGES) {
      console.warn("⚠️ Max video pages reached");
      break;
    }

    pageCount++;
    console.log(`Video page ${pageCount}`);

    const data = await youtubeGet("search", {
      part: "snippet",
      channelId,
      order: "date",
      publishedAfter,
      maxResults: 50,
      type: "video",
      pageToken: nextPageToken || undefined,
    });

    const items = data.items || [];

    for (const item of items) {
      if (!item.id?.videoId) continue;

      allVideos.push({
        videoId: item.id.videoId,
        title: item.snippet?.title || "",
        publishedAt: item.snippet?.publishedAt || null,
      });
    }

    nextPageToken = data.nextPageToken || null;

  } while (nextPageToken);

  return allVideos;
}

/* ================================
VIDEO DETAILS
================================ */

async function getVideoDetails(videoIds) {
  const detailedVideos = [];
  const chunkSize = 50;

  for (let i = 0; i < videoIds.length; i += chunkSize) {

    const chunk = videoIds.slice(i, i + chunkSize);

    const data = await youtubeGet("videos", {
      part: "contentDetails,statistics,snippet",
      id: chunk.join(","),
      maxResults: 50,
    });

    for (const item of data.items || []) {

      const durationSeconds = isoDurationToSeconds(item.contentDetails?.duration || "PT0S");

      detailedVideos.push({
        videoId: item.id,
        title: item.snippet?.title || "",
        publishedAt: item.snippet?.publishedAt || null,
        durationMinutes: durationSeconds / 60,
        commentCount: Number(item.statistics?.commentCount || 0),
      });
    }
  }

  return detailedVideos;
}

/* ================================
SELECT VIDEOS
================================ */

async function selectThreeVideos(channelId) {

  let eligibleVideos = await getEligibleVideos(channelId, VIDEO_LOOKBACK_DAYS);

  if (eligibleVideos.length < VIDEOS_TO_SAMPLE) {
    eligibleVideos = await getEligibleVideos(channelId, 180);
  }

  if (!eligibleVideos.length) {
    return {
      selectedVideos: [],
      insufficientDataReason: "No eligible videos",
    };
  }

  return {
    selectedVideos: eligibleVideos.slice(0, VIDEOS_TO_SAMPLE),
    insufficientDataReason: null,
  };
}

/* ================================
FILTER ELIGIBLE
================================ */

async function getEligibleVideos(channelId, lookbackDays) {

  const recentVideos = await getRecentChannelVideos(channelId, lookbackDays);
  const detailedVideos = await getVideoDetails(recentVideos.map(v => v.videoId));

  return detailedVideos
    .filter(v => v.durationMinutes >= MIN_VIDEO_DURATION_MINUTES)
    .sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));
}

/* ================================
FETCH COMMENTS (SAFE)
================================ */

async function fetchCommentsForVideo(videoId) {

  console.log(`\nFetching comments for video: ${videoId}`);

  const rawComments = [];
  let nextPageToken = null;
  let pageCount = 0;

  do {

    if (pageCount >= MAX_COMMENT_PAGES) {
      console.warn("⚠️ Max comment pages reached");
      break;
    }

    pageCount++;
    console.log(`Comment page ${pageCount}`);

    const data = await youtubeGet("commentThreads", {
      part: "snippet,replies",
      videoId,
      maxResults: 100,
      textFormat: "plainText",
      pageToken: nextPageToken || undefined,
      order: "relevance",
    });

    for (const thread of data.items || []) {

      const top = thread.snippet?.topLevelComment?.snippet;
      if (!top) continue;

      rawComments.push({
        comment_id: thread.snippet.topLevelComment.id,
        comment_text: top.textDisplay || "",
        is_reply: false,
        video_id: videoId,
      });

      for (const reply of thread.replies?.comments || []) {
        rawComments.push({
          comment_id: reply.id,
          comment_text: reply.snippet?.textDisplay || "",
          is_reply: true,
          video_id: videoId,
        });
      }
    }

    nextPageToken = data.nextPageToken || null;

  } while (nextPageToken);

  return rawComments;
}

/* ================================
MAIN ENTRY
================================ */

async function fetchAllComments(channelId) {

  assertEnv();

  const { selectedVideos } = await selectThreeVideos(channelId);

  const rawComments = [];

  for (const video of selectedVideos) {

    const comments = await fetchCommentsForVideo(video.videoId);
    rawComments.push(...comments);
  }

  return {
    channelId,
    selectedVideos,
    rawComments,
  };
}

module.exports = {
  fetchAllComments
};