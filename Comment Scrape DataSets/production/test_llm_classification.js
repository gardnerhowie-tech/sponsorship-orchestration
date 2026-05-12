require("dotenv").config();

const { fetchAllComments } = require("./youtube_fetch");
const {
  classifyComments,
  prepareTopLevelComments
} = require("./run_llm_classification");

const channelId = process.argv[2];

(async () => {

  const result = await fetchAllComments(channelId);

  const topLevel = prepareTopLevelComments(result.rawComments);

  const sample = topLevel.slice(0, 10);

  const classifications = await classifyComments(sample);

  console.log("\n=== LLM CLASSIFICATION ===");
  console.log(classifications);

})();
