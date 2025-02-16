import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { enabled } = await request.json();
        
        // Forward the motor control state to the Python backend
        const response = await fetch('http://localhost:7860/motor-control', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ enabled }),
        });

        if (!response.ok) {
            throw new Error('Failed to update remote control state');
        }

        // Get the actual state from the backend response
        const data = await response.json();
        return NextResponse.json(data);  // Pass through the backend response directly
    } catch (error) {
        console.error('Error in motor control API:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
} 