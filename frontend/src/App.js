'use client';

import React, { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const videoRef = useRef(null);
  const [remoteEnabled, setRemoteEnabled] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState("");
  const [humanBoxes, setHumanBoxes] = useState([]);
  const serverUrl = "http://127.0.0.1:5000";

  // Screen & Video Display Scaling
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const videoWidth = screenWidth * (2 / 3);
  const videoHeight = screenHeight;

  // ✅ Fetch Speech Transcripts Using SSE
  useEffect(() => {
    const eventSource = new EventSource(`${serverUrl}/speech_stream`);

    eventSource.onmessage = (event) => {
      console.log("Received speech:", event.data);
      setSpeechTranscript(event.data);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    const startStreaming = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        console.log("Camera stream started:", stream);
  
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
  
          // Wait for video metadata to load before processing frames
          await new Promise((resolve) => {
            videoRef.current.onloadedmetadata = () => {
              console.log("Video metadata loaded:", videoRef.current.videoWidth, videoRef.current.videoHeight);
              resolve();
            };
          });
        }
  
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
  
        const sendFrame = async () => {
          if (!videoRef.current || !videoRef.current.videoWidth || !videoRef.current.videoHeight) {
            console.warn("Video not ready yet");
            return;
          }
  
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
  
          canvas.toBlob((blob) => {
            if (!blob) {
              console.error("Failed to create Blob from canvas.");
              return;
            }
  
            const formData = new FormData();
            formData.append("frame", blob, "frame.jpg");
  
            fetch(`${serverUrl}/video_feed`, {
              method: "POST",
              body: formData,
            }).catch((error) => console.error("Error sending frame:", error));
          }, "image/jpeg");
  
          setTimeout(() => requestAnimationFrame(sendFrame), 100);
        };
  
        sendFrame();
      } catch (error) {
        console.error("Error accessing webcam:", error);
      }
    };
  
    startStreaming();
  
    // Cleanup: Stop the camera when the component unmounts
    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

   // ✅ Fetch Bounding Box Updates Using SSE
   useEffect(() => {
    const eventSource = new EventSource(`${serverUrl}/bbox_stream`);
  
    eventSource.onmessage = (event) => {
      try {
        const jsonString = event.data.trim();
        const data = JSON.parse(jsonString);
  
        console.log("Received bounding boxes:", data);
        
        const scaleX = videoWidth / 640;
        const scaleY = videoHeight / 480;

        const scaledBoxes = data.map(box => ({
          x1: box.x1 * scaleX + screenWidth * (0.33),
          y1: box.y1 * scaleY,
          x2: box.x2 * scaleX + screenWidth * (0.33),
          y2: box.y2 * scaleY,
          confidence: box.confidence
        }));

        setHumanBoxes(scaledBoxes);
      } catch (error) {
        console.error("Error parsing bounding box data:", error, "Raw data:", event.data);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // ✅ Send Commands to Flask for Motor Control
  const sendCommand = async (command) => {
    if (!remoteEnabled) return;
    try {
      await fetch(`${serverUrl}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
    } catch (error) {
      console.error("Error sending command:", error);
    }
  };

  return (
    <div className="container">
      {/* Left Panel (Controls + Transcript) */}
      <div className="left-panel">
        {/* Controls Section */}
        <div className="controls">
          <h2>Motor Control</h2>
          <label className="switch">
            <input
              type="checkbox"
              checked={remoteEnabled}
              onChange={() => setRemoteEnabled(!remoteEnabled)}
            />
            <span className="slider"></span>
          </label>
          <p>Remote Override: {remoteEnabled ? "ON" : "OFF"}</p>

          <div className="control-buttons">
            <button 
              onMouseDown={() => sendCommand("forward")} 
              onMouseUp={() => sendCommand("stop")}
              disabled={!remoteEnabled} 
              className="control-btn"
            >
              ▲
            </button>
            <div className="horizontal-controls">
              <button 
                onMouseDown={() => sendCommand("left")} 
                onMouseUp={() => sendCommand("stop")}
                disabled={!remoteEnabled} 
                className="control-btn"
              >
                ◄
              </button>
              <button 
                onMouseDown={() => sendCommand("right")} 
                onMouseUp={() => sendCommand("stop")}
                disabled={!remoteEnabled} 
                className="control-btn"
              >
                ►
              </button>
            </div>
            <button 
              onMouseDown={() => sendCommand("backward")} 
              onMouseUp={() => sendCommand("stop")}
              disabled={!remoteEnabled} 
              className="control-btn"
            >
              ▼
            </button>
          </div>
        </div>

        {/* Transcript Section */}
        <div className="transcript">
          <h2>Speech Transcript</h2>
          <p>{speechTranscript}</p>
        </div>
      </div>

      {/* Right Panel (Video Stream) */}
      <div className="video-container">
        <video ref={videoRef} crossOrigin="anonymous" autoPlay playsInline />
        {/* Bounding boxes for detected people */}
        <div className="bounding-box-overlay">
          {humanBoxes.map((box, index) => (
            <div key={index}>
              {/* Bounding Box */}
              <div
                className="bounding-box"
                style={{
                  left: `${box.x1}px`,
                  top: `${box.y1}px`,
                  width: `${box.x2 - box.x1}px`,
                  height: `${box.y2 - box.y1}px`,
                }}
              ></div>
              {/* Label "Person #" */}
              <span
                className="bounding-box-label"
                style={{
                  left: `${box.x1}px`,
                  top: `${box.y1 - 20}px`, // Position label above the bounding box
                }}
              >
                Person {index + 1}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
