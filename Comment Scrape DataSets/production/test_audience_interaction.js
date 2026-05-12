require("dotenv").config();
const { fetchAllComments } = require("./youtube_fetch");
const { computeAudienceInteraction } = require("./audience_interaction");

const channelId = process.argv[2];

(async () => {
  const result = await fetchAllComments(channelId);

  const interaction = computeAudienceInteraction(result.rawComments);

  console.log("\n=== AUDIENCE INTERACTION ===");
  console.log(interaction);
})();
