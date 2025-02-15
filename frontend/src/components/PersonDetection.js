'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

const PersonDetection = () => {
  const videoRef = useRef(null);
  const [model, setModel] = useState(null);
  const [humanBoxes, setHumanBoxes] = useState([]);
  const [remoteEnabled, setRemoteEnabled] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState("");

  // Screen & Video Display Scaling
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
  const videoWidth = screenWidth * (2 / 3);
  const videoHeight = screenHeight;

  // Initialize model
  useEffect(() => {
    const loadModel = async () => {
      try {
        const loadedModel = await cocoSsd.load();
        setModel(loadedModel);
        console.log("🤖 COCO-SSD Model loaded successfully");
      } catch (error) {
        console.error("❌ Error loading model:", error);
      }
    };

    loadModel();
  }, []);

  // Setup webcam
  useEffect(() => {
    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          console.log("📹 Camera stream started successfully");
        }
      } catch (error) {
        console.error("❌ Error accessing webcam:", error);
      }
    };

    setupCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        console.log("🛑 Camera stream stopped");
      }
    };
  }, []);

  // Perform detection
  useEffect(() => {
    if (!model || !videoRef.current) return;

    let animationFrameId;
    
    const detectFrame = async () => {
      if (!videoRef.current || !model) return;

      try {
        const predictions = await model.detect(videoRef.current);
        
        // Get the actual video dimensions and container dimensions
        const videoElement = videoRef.current;
        const actualWidth = videoElement.videoWidth;
        const actualHeight = videoElement.videoHeight;
        
        // Get the container dimensions
        const containerElement = videoElement.parentElement;
        const displayWidth = containerElement.offsetWidth;
        const displayHeight = containerElement.offsetHeight;
        
        // Calculate the scaling factors based on how the video is displayed
        const videoAspectRatio = actualWidth / actualHeight;
        const containerAspectRatio = displayWidth / displayHeight;
        
        let scaleX, scaleY, offsetX = 0, offsetY = 0;
        
        if (containerAspectRatio > videoAspectRatio) {
          // Video is letterboxed on the sides
          const videoDisplayHeight = displayHeight;
          const videoDisplayWidth = videoDisplayHeight * videoAspectRatio;
          scaleX = videoDisplayWidth / actualWidth;
          scaleY = displayHeight / actualHeight;
          offsetX = (displayWidth - videoDisplayWidth) / 2;
        } else {
          // Video is letterboxed on top/bottom
          const videoDisplayWidth = displayWidth;
          const videoDisplayHeight = videoDisplayWidth / videoAspectRatio;
          scaleX = displayWidth / actualWidth;
          scaleY = videoDisplayHeight / actualHeight;
          offsetY = (displayHeight - videoDisplayHeight) / 2;
        }

        // Filter for person detections and convert to our format with scaling
        const personDetections = predictions
          .filter(pred => pred.class === 'person')
          .map(pred => ({
            x1: Math.round(pred.bbox[0] * scaleX + offsetX),
            y1: Math.round(pred.bbox[1] * scaleY + offsetY),
            x2: Math.round((pred.bbox[0] + pred.bbox[2]) * scaleX + offsetX),
            y2: Math.round((pred.bbox[1] + pred.bbox[3]) * scaleY + offsetY),
            confidence: pred.score
          }));

        setHumanBoxes(personDetections);
      } catch (error) {
        console.error("❌ Error during detection:", error);
      }

      animationFrameId = requestAnimationFrame(detectFrame);
    };

    detectFrame();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [model]);

  const handleCommand = (command) => {
    if (!remoteEnabled) return;
    console.log(`Command sent: ${command}`);
  };

  return (
    <div className="container">
      {/* Left Panel */}
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
              onMouseDown={() => handleCommand("forward")}
              onMouseUp={() => handleCommand("stop")}
              disabled={!remoteEnabled}
              className="control-btn"
            >
              ▲
            </button>
            <div className="horizontal-controls">
              <button
                onMouseDown={() => handleCommand("left")}
                onMouseUp={() => handleCommand("stop")}
                disabled={!remoteEnabled}
                className="control-btn"
              >
                ◄
              </button>
              <button
                onMouseDown={() => handleCommand("right")}
                onMouseUp={() => handleCommand("stop")}
                disabled={!remoteEnabled}
                className="control-btn"
              >
                ►
              </button>
            </div>
            <button
              onMouseDown={() => handleCommand("backward")}
              onMouseUp={() => handleCommand("stop")}
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
        <video
          ref={videoRef}
          crossOrigin="anonymous"
          autoPlay
          playsInline
        />
        {/* Bounding boxes overlay */}
        <div className="bounding-box-overlay">
          {humanBoxes.map((box, index) => (
            <div key={index}>
              <div
                className="bounding-box"
                style={{
                  left: `${box.x1}px`,
                  top: `${box.y1}px`,
                  width: `${box.x2 - box.x1}px`,
                  height: `${box.y2 - box.y1}px`,
                }}
              />
              <span
                className="bounding-box-label"
                style={{
                  left: `${box.x1}px`,
                  top: `${Math.max(0, box.y1 - 24)}px`,
                }}
              >
                Person {index + 1} ({(box.confidence * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PersonDetection; 