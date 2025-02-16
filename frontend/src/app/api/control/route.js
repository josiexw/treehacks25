import { NextResponse } from 'next/server';

// UDP setup for broadcasting commands
const dgram = require('dgram');
const client = dgram.createSocket('udp4');

const BROADCAST_ADDRESS = '255.255.255.255';
const PORT = 8888;

// Enable broadcasting
client.bind(() => {
    client.setBroadcast(true);
    console.log('UDP Client ready for broadcasting on port', PORT);
});

// Add error handler
client.on('error', (err) => {
    console.error('UDP Client error:', err);
});

export async function POST(request) {
    try {
        const { direction } = await request.json();
        
        // Forward the control command to the Python backend
        const response = await fetch('http://localhost:7860/control', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ direction }),
        });

        if (!response.ok) {
            throw new Error('Failed to send command to backend');
        }

        return NextResponse.json({ success: true, command: direction });
    } catch (error) {
        console.error('Error in control API:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
} 