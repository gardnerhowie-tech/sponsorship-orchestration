const { exec } = require('child_process');
const path = require('path');

function runHostResponsivenessPipeline(channel_id) {
  return new Promise((resolve, reject) => {
    console.log(`📊 Running Host Responsiveness for ${channel_id}`);

    const scriptDir = path.resolve(
      __dirname,
      "../../Host Responsiveness"
    );

    const scriptPath = path.join(scriptDir, "run_host_responsiveness_runner.js");

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
        console.log('✅ Host Responsiveness complete');
        resolve();
      } else {
        reject(new Error(`Responsiveness pipeline failed with code ${code}`));
      }
    });
  });
}

module.exports = { runHostResponsivenessPipeline };
