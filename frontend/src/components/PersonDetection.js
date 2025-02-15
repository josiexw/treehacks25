'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import ControlButtons from './ControlButtons';

const PersonDetection = () => {
  const videoRef = useRef(null);
  const [model, setModel] = useState(null);
  const [humanBoxes, setHumanBoxes] = useState([]);
  const [objectBoxes, setObjectBoxes] = useState([]);
  const [remoteEnabled, setRemoteEnabled] = useState(false);
  const [task, setTask] = useState("");
  const [targetObject, setTargetObject] = useState('person');
  const [isProcessing, setIsProcessing] = useState(false);

  // Screen & Video Display Scaling
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
  // const videoWidth = screenWidth * (2 / 3);
  // const videoHeight = screenHeight;

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

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    if (!task.trim()) return;

    setIsProcessing(true);
    try {
      // Parse the task using OpenAI
      const response = await fetch('/api/parse-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ task }),
      });

      if (!response.ok) throw new Error('Failed to parse task');
      
      const data = await response.json();
      setTargetObject(data.targetObject);

      // Broadcast the target object via UDP
      await fetch('/api/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ direction: `target:${data.targetObject}` }),
      });

    } catch (error) {
      console.error('Error processing task:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Modify the detection effect to handle target objects
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

        // Filter and process detections based on target object
        const detections = predictions.map(pred => ({
          x1: Math.round(pred.bbox[0] * scaleX + offsetX),
          y1: Math.round(pred.bbox[1] * scaleY + offsetY),
          x2: Math.round((pred.bbox[0] + pred.bbox[2]) * scaleX + offsetX),
          y2: Math.round((pred.bbox[1] + pred.bbox[3]) * scaleY + offsetY),
          confidence: pred.score,
          label: pred.class,
          isTarget: targetObject && pred.class === targetObject
        }));

        // Split into target and non-target objects
        const targetBoxes = detections.filter(det => det.isTarget);
        const otherBoxes = detections.filter(det => !det.isTarget);

        setHumanBoxes(targetBoxes);
        setObjectBoxes(otherBoxes);
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
  }, [model, targetObject]);

  // Add keyboard control effect
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!remoteEnabled) return;

      const keyCommands = {
        'ArrowUp': 'forward',
        'ArrowDown': 'backward',
        'ArrowLeft': 'left',
        'ArrowRight': 'right'
      };

      const command = keyCommands[e.key];
      if (command) {
        e.preventDefault(); // Prevent page scroll
        console.log(`Sending keyboard command: ${command}`);
        fetch('/api/control', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ direction: command }),
        });
      }
    };

    const handleKeyUp = (e) => {
      if (!remoteEnabled) return;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        console.log('Sending stop command');
        fetch('/api/control', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ direction: 'stop' }),
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [remoteEnabled]);

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

          <ControlButtons disabled={!remoteEnabled} />
          
          <div className="keyboard-controls">
            <p>Keyboard Controls:</p>
            <p>↑ Forward</p>
            <p>↓ Backward</p>
            <p>← Left</p>
            <p>→ Right</p>
          </div>
        </div>

        {/* Task Input Section */}
        <div className="task-section">
          <h2>Task Description</h2>
          <form onSubmit={handleTaskSubmit} className="task-form">
            <input
              type="text"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Describe what you want the RC car to do... (default: following person)"
              className="task-input"
              disabled={isProcessing}
            />
            <button 
              type="submit" 
              className="task-submit"
              disabled={isProcessing || !task.trim()}
            >
              {isProcessing ? 'Processing...' : 'Set Task'}
            </button>
          </form>
          <p className="target-object">
            Target Object: <span>{targetObject}</span>
          </p>
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
                className="bounding-box-red"
                style={{
                  left: `${box.x1}px`,
                  top: `${box.y1}px`,
                  width: `${box.x2 - box.x1}px`,
                  height: `${box.y2 - box.y1}px`,
                }}
              />
              <span
                className="bounding-box-label-red"
                style={{
                  left: `${box.x1}px`,
                  top: `${Math.max(0, box.y1 - 24)}px`,
                }}
              >
                {box.label} ({(box.confidence * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
        <div className="bounding-box-overlay">
          {objectBoxes.map((box, index) => (
            <div key={index}>
              <div
                className="bounding-box-blue"
                style={{
                  left: `${box.x1}px`,
                  top: `${box.y1}px`,
                  width: `${box.x2 - box.x1}px`,
                  height: `${box.y2 - box.y1}px`,
                }}
              />
              <span
                className="bounding-box-label-blue"
                style={{
                  left: `${box.x1}px`,
                  top: `${Math.max(0, box.y1 - 24)}px`,
                }}
              >
                {box.label} ({(box.confidence * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PersonDetection; 