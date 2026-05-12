const { exec } = require('child_process');
const path = require('path');

function runCommentPipeline(channel_id) {
  return new Promise((resolve, reject) => {
    console.log(`💬 Running Comment Pipeline for ${channel_id}`);

    const scriptDir = path.resolve(
      __dirname,
      "../../Comment Scrape DataSets/production"
    );

    const scriptPath = path.join(scriptDir, "run_comment_pipeline.js");

    const command = `node "${scriptPath}" ${channel_id}`;

    console.log("DEBUG PATH:", scriptPath);

    const process = exec(command, { cwd: scriptDir });

    process.stdout.on('data', (data) => {
      console.log(data.toString());
    });

    process.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    process.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Comment Pipeline complete');
        resolve();
      } else {
        reject(new Error(`Comment pipeline failed with code ${code}`));
      }
    });
  });
}

module.exports = { runCommentPipeline };
