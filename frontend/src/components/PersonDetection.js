'use client';

import React, { useRef, useState } from 'react';
import ControlButtons from './ControlButtons';

const PersonDetection = () => {
  const videoRef = useRef(null);
  const [remoteEnabled, setRemoteEnabled] = useState(false);
  const [task, setTask] = useState("");
  const [targetObject, setTargetObject] = useState('entrapped survivor');
  const [isProcessing, setIsProcessing] = useState(false);
  const [obstacles, setObstacles] = useState(['obstacles']);
  const [autonomousEnabled, setAutonomousEnabled] = useState(false);

  // Setup video stream from Python backend
  React.useEffect(() => {
    if (videoRef.current) {
      videoRef.current.src = 'http://localhost:7860/video-feed';
      console.log("📹 Video stream source set");
    }
  }, []);

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    if (!task.trim()) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/parse-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ task }),
      });

      if (!response.ok) throw new Error('Failed to parse task');
      
      const data = await response.json();
      setTargetObject(data.target);
      setObstacles(data.obstacles);

    } catch (error) {
      console.error('Error processing task:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Add keyboard control effect
  React.useEffect(() => {
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

  const handleAutonomousControlToggle = async (enabled) => {
    try {
      const response = await fetch('/api/autonomous-control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to update autonomous control state');
      }
      
      const data = await response.json();
      console.log('Autonomous control response:', data);
      setAutonomousEnabled(Boolean(data.autonomous));
      setRemoteEnabled(Boolean(data.motor));
    } catch (error) {
      console.error('Error updating autonomous control:', error);
      setAutonomousEnabled(!enabled);
    }
  };

  const handleMotorControlToggle = async (enabled) => {
    try {
      const response = await fetch('/api/motor-control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to update remote control state');
      }
      
      const data = await response.json();
      console.log('Motor control response:', data);
      setRemoteEnabled(Boolean(data.motor));
      setAutonomousEnabled(Boolean(data.autonomous));
    } catch (error) {
      console.error('Error updating remote control:', error);
      setRemoteEnabled(!enabled);
    }
  };

  React.useEffect(() => {
    const updateRealViewportSize = () => {
      // Get the real viewport size
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      
      // Update CSS variables
      document.documentElement.style.setProperty('--real-vh', `${vh}px`);
      document.documentElement.style.setProperty('--real-vw', `${vw}px`);
    };

    // Initial update
    updateRealViewportSize();

    // Update on resize
    window.addEventListener('resize', updateRealViewportSize);
    
    // Cleanup
    return () => window.removeEventListener('resize', updateRealViewportSize);
  }, []);

  return (
    <>
      <div className="container">
        <div className="left-panel">
          <div className="controls">
            <h2>Control Mode</h2>
            <div className="control-toggles flex flex-col items-center space-y-4 w-full">
              <div className="toggle-group flex items-center justify-center gap-3 w-full">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={remoteEnabled}
                    onChange={(e) => handleMotorControlToggle(e.target.checked)}
                  />
                  <span className="slider"></span>
                </label>
                <p className="my-0">Remote Override: {remoteEnabled ? "ON" : "OFF"}</p>
              </div>
              
              <div className="toggle-group flex items-center justify-center gap-3 w-full">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={autonomousEnabled}
                    onChange={(e) => handleAutonomousControlToggle(e.target.checked)}
                  />
                  <span className="slider"></span>
                </label>
                <p className="my-0">Autonomous Mode: {autonomousEnabled ? "ON" : "OFF"}</p>
              </div>
            </div>
            
            <ControlButtons disabled={!remoteEnabled} />
            
          </div>

          <div className="task-section">
            <h2>Task Description</h2>
            <form onSubmit={handleTaskSubmit} className="task-form">
              <input
                type="text"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="Describe what object to track and what to avoid..."
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
            {obstacles.length > 0 && (
              <p className="obstacles">
                Avoiding: <span>{obstacles.join(', ')}</span>
              </p>
            )}
          </div>
        </div>

        <div className="video-container">
          <img
            ref={videoRef}
            src="http://localhost:7860/video-feed"
            alt="Video stream"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      </div>
    </>
  );
};

export default PersonDetection; 