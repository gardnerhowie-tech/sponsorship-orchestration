import fetch from "node-fetch";

const API_KEY = process.env.YOUTUBE_API_KEY

console.log("API KEY EXISTS:", !!API_KEY);

const EPISODES_TO_SCAN = 10;
const MAX_COMMENTS_PER_VIDEO = 100;

async function getRecentVideos(channelId) {
  const url = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${channelId}&part=id&order=date&type=video&maxResults=${EPISODES_TO_SCAN}`;

  const res = await fetch(url);
const data = await res.json();

console.log("\n=== GENERATED URL ===\n");
console.log(url);

console.log("\n=== RAW YOUTUBE API RESPONSE ===\n");
console.dir(data, { depth: 5 });

if (!data.items) {
  console.error("No videos returned from API");
  return [];
}

  return data.items.map(v => v.id.videoId);
}

async function getCommentThreads(videoId) {
  const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${videoId}&maxResults=${MAX_COMMENTS_PER_VIDEO}&key=${API_KEY}`;

  const res = await fetch(url);
  const data = await res.json();

  return data.items || [];
}

function countWords(text) {
  return text.trim().split(/\s+/).length;
}

async function analyzeShow(channelId) {
  const videos = await getRecentVideos(channelId);

  let totalThreads = 0;
  let threadsWithHostReply = 0;
  let validHostReplies = 0;

  for (const video of videos) {
    const threads = await getCommentThreads(video);

    for (const thread of threads) {
      totalThreads++;

      const replies = thread.replies?.comments || [];

      let hostReplied = false;

      for (const reply of replies) {
        const authorId = reply.snippet.authorChannelId?.value;

        if (authorId === channelId) {
          hostReplied = true;

          const words = countWords(reply.snippet.textDisplay);

          if (words >= 2) {
            validHostReplies++;
          }
        }
      }

      if (hostReplied) {
        threadsWithHostReply++;
      }
    }
  }

  const responseRate =
    totalThreads === 0 ? 0 : threadsWithHostReply / totalThreads;

  const MIN_BASELINE = 20;

const adjustedScore =
  MIN_BASELINE +
  (Math.pow(responseRate, 0.4) * 80);

const score =
  Math.round(
    Math.min(100, adjustedScore)
  );

  return {
    totalThreads,
    threadsWithHostReply,
    validHostReplies,
    responseRate,
    score
  };
}

export async function run(channelId) {
  console.log("Running Host Responsiveness Analysis...");
  return await analyzeShow(channelId);
}