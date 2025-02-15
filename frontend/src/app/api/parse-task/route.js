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
                    content: `You are a helper that identifies target objects from user tasks. You should return ONLY ONE object from this list: ${COCO_CLASSES.join(', ')}. Return exactly the same spelling as in the list. If no relevant object is found, return "none".`
                },
                {
                    role: "user",
                    content: task
                }
            ],
            temperature: 0,
            max_tokens: 50
        });

        const targetObject = response.choices[0].message.content.toLowerCase();
        
        // Validate that the response is in our list of classes
        const validObject = COCO_CLASSES.includes(targetObject) ? targetObject : 'none';

        return NextResponse.json({ targetObject: validObject });
    } catch (error) {
        console.error('Error parsing task:', error);
        return NextResponse.json(
            { error: 'Failed to parse task' },
            { status: 500 }
        );
    }
} 