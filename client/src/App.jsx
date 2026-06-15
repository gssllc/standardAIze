import { useState } from "react";

import "./App.css";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import VoiceInput from "./components/VoiceToText.jsx";

import {
  TextField,
  Label,
  TextArea,
} from "react-aria-components/TextField";

import Button from "@mui/material/Button";
import { buttonStyles } from "./utils/muiStyles.js";

function App() {
  const [maintenanceNote, setMaintenanceNote] = useState("");
  const [aiNote, setAiNote] = useState("");

  function handleTranscriptionComplete(transcribedText) {
    setMaintenanceNote((currentNote) => {
      if (!currentNote.trim()) {
        return transcribedText;
      }

      return `${currentNote}\n${transcribedText}`;
    });
  }

  async function handleGenerateAiNote() {
    console.log("Maintenance note:", maintenanceNote);

    // Later this will call your /api/generate-ai-note route.
    // For now, this confirms the button has the note text.
    setAiNote(`AI note will be generated from:\n\n${maintenanceNote}`);
  }

  return (
    <div className="page">
      <Navbar />

      <div className="text-field-container">
        <div className="text-field-button-container">
          <TextField>
            <Label>Maintenance Note</Label>

            <div className="maintenance-textarea-wrapper">
              <TextArea
                className="react-aria-TextArea"
                placeholder="Enter note here..."
                value={maintenanceNote}
                onChange={(event) => setMaintenanceNote(event.target.value)}
              />

              <VoiceInput
                onTranscriptionComplete={handleTranscriptionComplete}
              />
            </div>
          </TextField>

          <Button
            type="button"
            variant="contained"
            sx={buttonStyles}
            onClick={handleGenerateAiNote}
          >
            Generate AI Note
          </Button>
        </div>

        <TextField>
          <Label>AI Note</Label>

          <div className="ai-textarea-wrapper">
            <TextArea
              readOnly
              className="react-aria-TextArea"
              placeholder="Waiting for AI response..."
              value={aiNote}
            />
          </div>
        </TextField>
      </div>

      <Footer />
    </div>
  );
}

export default App;