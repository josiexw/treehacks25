'use client';

import { useState } from 'react';

const ControlButtons = ({ disabled = false }) => {
    const [isPressed, setIsPressed] = useState({
        forward: false,
        backward: false,
        left: false,
        right: false,
    });

    const handleControlPress = async (direction) => {
        if (disabled) return;
        
        console.log(`Sending command: ${direction}`);
        try {
            const response = await fetch('/api/control', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ direction }),
            });

            const data = await response.json();
            console.log('Response from server:', data);

            if (!response.ok) {
                throw new Error('Failed to send command');
            }
        } catch (error) {
            console.error('Error sending command:', error);
        }
    };

    return (
        <div className="control-buttons">
            <button
                className="control-btn"
                onMouseDown={() => {
                    setIsPressed(prev => ({ ...prev, forward: true }));
                    handleControlPress('forward');
                }}
                onMouseUp={() => {
                    setIsPressed(prev => ({ ...prev, forward: false }));
                    handleControlPress('stop');
                }}
                onMouseLeave={() => {
                    if (isPressed.forward) {
                        setIsPressed(prev => ({ ...prev, forward: false }));
                        handleControlPress('stop');
                    }
                }}
                disabled={disabled}
                aria-label="Move forward"
            >
                ▴
            </button>
            <div className="horizontal-controls">
                <button
                    className="control-btn"
                    onMouseDown={() => {
                        setIsPressed(prev => ({ ...prev, left: true }));
                        handleControlPress('left');
                    }}
                    onMouseUp={() => {
                        setIsPressed(prev => ({ ...prev, left: false }));
                        handleControlPress('stop');
                    }}
                    onMouseLeave={() => {
                        if (isPressed.left) {
                            setIsPressed(prev => ({ ...prev, left: false }));
                            handleControlPress('stop');
                        }
                    }}
                    disabled={disabled}
                    aria-label="Turn left"
                >
                    ◂
                </button>
                <button
                    className="control-btn"
                    onMouseDown={() => {
                        setIsPressed(prev => ({ ...prev, right: true }));
                        handleControlPress('right');
                    }}
                    onMouseUp={() => {
                        setIsPressed(prev => ({ ...prev, right: false }));
                        handleControlPress('stop');
                    }}
                    onMouseLeave={() => {
                        if (isPressed.right) {
                            setIsPressed(prev => ({ ...prev, right: false }));
                            handleControlPress('stop');
                        }
                    }}
                    disabled={disabled}
                    aria-label="Turn right"
                >
                    ▸
                </button>
            </div>
            <button
                className="control-btn"
                onMouseDown={() => {
                    setIsPressed(prev => ({ ...prev, backward: true }));
                    handleControlPress('backward');
                }}
                onMouseUp={() => {
                    setIsPressed(prev => ({ ...prev, backward: false }));
                    handleControlPress('stop');
                }}
                onMouseLeave={() => {
                    if (isPressed.backward) {
                        setIsPressed(prev => ({ ...prev, backward: false }));
                        handleControlPress('stop');
                    }
                }}
                disabled={disabled}
                aria-label="Move backward"
            >
                ▾
            </button>
        </div>
    );
};

export default ControlButtons; 