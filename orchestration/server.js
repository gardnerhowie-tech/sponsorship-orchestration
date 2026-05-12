import express from "express";
import cors from "cors";
import { exec } from "child_process";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {

  res.json({
    success: true,
    message: "Sponsorship orchestration running",
  });
});

app.post("/scan", async (req, res) => {

  const { channel_id } = req.body;

  if (!channel_id) {

    return res.status(400).json({
      success: false,
      error: "Missing channel_id",
    });
  }

  exec(
    `node scanController.js ${channel_id}`,
    (error, stdout, stderr) => {

      if (error) {

        console.error(error);

        return res.status(500).json({
          success: false,
          error: stderr,
        });
      }

      return res.json({
        success: true,
        output: stdout,
      });
    }
  );
});

app.listen(PORT, () => {

  console.log(
    `Server running on port ${PORT}`
  );
});