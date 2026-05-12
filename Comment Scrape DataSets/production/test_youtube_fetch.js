require("dotenv").config();
const { fetchAllComments } = require("./youtube_fetch");

const channelId = process.argv[2];

if (!channelId) {
  console.error("Please provide a channel ID.");
  console.error("Example: node test_youtube_fetch.js UCxxxxxxxx");
  process.exit(1);
}

(async () => {
  try {
    const result = await fetchAllComments(channelId);

    console.log("\n=== FETCH RESULT SUMMARY ===");
    console.log("Channel ID:", result.channelId);
    console.log("Selected video IDs:", result.selectedVideoIds);
    console.log("Selected videos:", result.selectedVideos.map(v => ({
      videoId: v.videoId,
      title: v.title,
      publishedAt: v.publishedAt,
      durationMinutes: v.durationMinutes,
      commentCount: v.commentCount,
    })));
    console.log("Total raw comments fetched:", result.rawComments.length);

    const topLevelCount = result.rawComments.filter(c => !c.is_reply).length;
    const replyCount = result.rawComments.filter(c => c.is_reply).length;

    console.log("Top-level comments:", topLevelCount);
    console.log("Replies:", replyCount);

    console.log("\nFirst 5 comments:");
    console.log(result.rawComments.slice(0, 5));
  } catch (error) {
    console.error("\nERROR:");
    console.error(error.response?.data || error.message || error);
  }
})();
