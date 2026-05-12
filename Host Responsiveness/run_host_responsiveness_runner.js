import("./run_host_responsiveness.js")
  .then(async () => {
    // The original file already executes itself via IIFE
  })
  .catch((err) => {
    console.error("🔥 Runner failed:");
    console.error(err);
    process.exit(1);
  });
