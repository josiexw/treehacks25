import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { enabled } = await request.json();
        
        // Forward the autonomous control state to the Python backend
        const response = await fetch('http://localhost:7860/autonomous-control', {
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
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in autonomous control API:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
} 