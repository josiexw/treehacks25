import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// COCO-SSD classes that we can detect
const COCO_CLASSES = [
    'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 
    'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 
    'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 
    'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 
    'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 
    'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup', 
    'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange', 
    'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch', 
    'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 
    'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 
    'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 
    'toothbrush'
];

export async function POST(request) {
    try {
        const { task } = await request.json();

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are a helper that identifies target objects and potential obstacles from user tasks. 
                    Return a JSON object with two fields:
                    1. "target": The main object to track
                    2. "obstacles": Array of objects to avoid
                    Keep descriptions simple and clear. No adjectives, add articles of objects (e.g. "a cup"), and add as many redundancies as possible (e.g. for limb, add "a arm", "a hand", "a finger").

                    Example: {"target": "a cup", "obstacles": ["a chair", "a laptop"]}`
                },
                {
                    role: "user",
                    content: task
                }
            ],
            temperature: 0,
            max_tokens: 100
        });

        const parsed = JSON.parse(response.choices[0].message.content);
        
        // Send the parsed objects to the Python backend
        const backendResponse = await fetch('http://localhost:7860/update-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: `[${parsed.target}, ${parsed.obstacles.join(', ')}]`,
                target: parsed.target,
                obstacles: parsed.obstacles
            })
        });

        if (!backendResponse.ok) {
            throw new Error('Failed to update backend prompt');
        }

        return NextResponse.json(parsed);
    } catch (error) {
        console.error('Error parsing task:', error);
        return NextResponse.json(
            { error: 'Failed to parse task' },
            { status: 500 }
        );
    }
} 