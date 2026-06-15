import { useRef, useState } from "react";
import "./VoiceToText.css";

function VoiceInput(props) {
    const onTranscriptionComplete = props.onTranscriptionComplete;

    const [isRecording, setIsRecording] = useState(false);
    const [statusMessage, setStatusMessage] = useState("Record your voice...");

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const mediaStreamRef = useRef(null);

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });

            mediaStreamRef.current = stream;
            audioChunksRef.current = [];

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = function (event) {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = function () {
                transcribeAudio();
            };

            mediaRecorder.start();

            setIsRecording(true);
            setStatusMessage("Recording your voice...");
        } catch (error) {
            console.error("Microphone error:", error);
            setStatusMessage("Could not access microphone.");
        }
    }

    async function transcribeAudio() {
        try {
            setStatusMessage("Transcribing your voice...");

            const audioBlob = new Blob(audioChunksRef.current, {
                type: "audio/webm",
            });

            const formData = new FormData();
            formData.append("audio", audioBlob, "voice.webm");

            const response = await fetch("http://localhost:5000/api/transcribe", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to transcribe audio.");
            }

            onTranscriptionComplete(data.text || "");
            setStatusMessage("Record your voice...");
        } catch (error) {
            console.error("Transcription error:", error);
            setStatusMessage("Could not transcribe your voice.");
        } finally {
            stopMicrophoneTracks();
        }
    }

    function stopRecording() {
        if (!mediaRecorderRef.current) return;

        mediaRecorderRef.current.stop();
        setIsRecording(false);
    }

    function stopMicrophoneTracks() {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(function (track) {
                track.stop();
            });
        }

        mediaStreamRef.current = null;
    }

    function handleMicClick() {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }

    return (
        <div className="voice-input-container">
            <button
                type="button"
                className={`voice-input-button ${isRecording ? "recording" : ""}`}
                onClick={handleMicClick}
                aria-label={isRecording ? "Stop recording" : "Start recording"}
            >
                <img
                    className="voice-input-icon"
                    src={
                        isRecording
                            ? "/icons/stop-mic.svg"
                            : "/icons/mic.svg"
                    }
                    alt=""
                />
            </button>

            {statusMessage && (
                <p className="voice-input-status">{statusMessage}</p>
            )}
        </div>
    );
}

export default VoiceInput;