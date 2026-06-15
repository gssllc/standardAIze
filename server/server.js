const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
  override: true,
});

console.log("Loaded .env from:", path.join(__dirname, ".env"));
console.log("OPENAI_API_KEY loaded:", Boolean(process.env.OPENAI_API_KEY));
console.log(
  "OPENAI_API_KEY preview:",
  process.env.OPENAI_API_KEY
    ? `${process.env.OPENAI_API_KEY.slice(0, 10)}...${process.env.OPENAI_API_KEY.slice(-4)}`
    : "missing"
);

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");
const { toFile } = require("openai/uploads");

const { generateMaintenanceAiNote } = require("./services/aiNoteService");

const app = express();
const PORT = process.env.PORT || 5000;

const upload = multer({
  storage: multer.memoryStorage(),
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Express server is running!");
});

app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
    try {
        if (!req.file) {
        return res.status(400).json({
            error: "No audio file uploaded.",
        });
        }

        const audioFile = await toFile(req.file.buffer, "voice.webm", {
        type: req.file.mimetype || "audio/webm",
    });

    const transcription = await openai.audio.transcriptions.create({
        model: "gpt-4o-transcribe",
        file: audioFile,
        });

        res.json({
        text: transcription.text,
        });
    } catch (error) {
        console.error("Transcription error:", error);

        res.status(500).json({
        error: "Failed to transcribe audio.",
        details: error.message,
        });
    }
});

app.post("/api/generate-ai-note", async (req, res) => {
    try {
        const { rawNote } = req.body;

        if (!rawNote || !rawNote.trim()) {
            return res.status(400).json({
                error: "Maintenance note is required.",
            });
        }

        const aiNote = await generateMaintenanceAiNote(rawNote);

        res.json({
            aiNote,
        });
    } catch (error) {
        console.error("Error generating AI note:", error);

        res.status(500).json({
        error: "Failed to generate AI note.",
        details: error.message,
        });
  }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});