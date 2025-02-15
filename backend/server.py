from flask import Flask, request, Response, jsonify
from flask_cors import CORS
import requests
import cv2
import numpy as np
import queue
import time
import json
import torch
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)

# Load Pretrained YOLO Model (Person + Face Detection)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = YOLO("yolov8n.pt").to(device)

TARGET_CLASSES = {0: "person"}

# Queues for data streaming
speech_queue = queue.Queue()
bbox_queue = queue.Queue()

def detect_people_and_faces(image):
    """Run YOLO to detect people"""
    height, width, _ = image.shape

    # Run inference on the image
    results = model(image)

    humans = []
    for r in results:
        for box in r.boxes.data:
            print("BOXES DETECTED:", box.tolist())
            x1, y1, x2, y2, conf, cls = box.tolist()
            class_id = int(cls)

            # Only detect persons (class ID 0)
            if class_id in TARGET_CLASSES and conf > 0.8:
                humans.append({
                    "x1": int(x1),
                    "y1": int(y1),
                    "x2": int(x2),
                    "y2": int(y2),
                    "confidence": float(conf),
                    "class": TARGET_CLASSES[class_id]
                })

    return humans

@app.route('/video_feed', methods=['POST'])
def video_feed():
    """Receive video frames, detect people and send bounding boxes"""
    file = request.files.get('frame')
    if not file:
        return "No frame received", 400
    
    nparr = np.frombuffer(file.read(), np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    humans = detect_people_and_faces(frame)

    # Store bounding boxes in queue for streaming
    bbox_queue.put(humans)

    # Draw bounding boxes on frame (for debugging)
    for human in humans:
        label = f"{human['class']} {human['confidence']:.2f}"
        cv2.rectangle(frame, (human["x1"], human["y1"]), (human["x2"], human["y2"]), (0, 255, 0), 2)
        cv2.putText(frame, label, (human["x1"], human["y1"] - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

    cv2.imshow('YOLO Detection', frame)
    cv2.waitKey(10)
    
    return jsonify({"message": "Frame received", "humans": humans}), 200

@app.route('/control', methods=['POST'])
def control_motor():
    """Send control commands to Arduino"""
    data = request.json
    command = data.get("command")

    if not command:
        return jsonify({"error": "No command received"}), 400

    try:
        response = requests.get(f"http://<arduino-ip>/{command}")
        return jsonify({"message": f"Sent {command} to Arduino", "arduino_response": response.text}), 200
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to send command to Arduino: {e}"}), 500

@app.route('/speech', methods=['POST'])
def receive_speech():
    """Receive and store speech transcripts"""
    data = request.json
    transcript = data.get("transcript")

    if not transcript:
        return jsonify({"error": "No transcript received"}), 400

    speech_queue.put(transcript)
    return jsonify({"message": "Speech transcript received", "transcript": transcript}), 200

@app.route('/speech_stream', methods=['GET'])
def speech_stream():
    """Stream speech transcripts via SSE"""
    def event_stream():
        while True:
            if not speech_queue.empty():
                transcript = speech_queue.get()
                yield f"data: {transcript}\n\n"
            time.sleep(0.5)  # Prevent excessive CPU usage

    return Response(event_stream(), mimetype="text/event-stream")

@app.route('/bbox_stream', methods=['GET'])
def bbox_stream():
    """Stream bounding boxes via SSE"""
    def event_stream():
        while True:
            if not bbox_queue.empty():
                boxes = bbox_queue.get()
                json_data = json.dumps(boxes)
                print("json_data", json_data)
                yield f"data: {json_data}\n\n"

            time.sleep(0.5)  # Prevent CPU overload

    return Response(event_stream(), mimetype="text/event-stream")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)
