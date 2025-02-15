from flask import Flask, request, Response, jsonify
from flask_cors import CORS
import requests
import cv2
import numpy as np
import queue
from ultralytics import YOLO
import time
import json

app = Flask(__name__)
CORS(app)

model = YOLO("yolov8n.pt")

# Queue to store speech transcripts
speech_queue = queue.Queue()

# Queue for detected bounding boxes
bbox_queue = queue.Queue()

@app.route('/video_feed', methods=['POST'])
def video_feed():
    file = request.files['frame']
    if not file:
        return "No frame received", 400
    
    nparr = np.frombuffer(file.read(), np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # Run YOLOv8 on the frame
    results = model(frame)

    # Extract bounding boxes for humans (class ID 0 in COCO dataset)
    humans = []
    for r in results:
        for box in r.boxes.data:
            x1, y1, x2, y2, conf, cls = box.tolist()
            if int(cls) == 0:  # Class ID 0 corresponds to "person"
                humans.append({"x1": int(x1), "y1": int(y1), "x2": int(x2), "y2": int(y2), "confidence": float(conf)})

    # Store human bounding boxes in queue for real-time streaming
    bbox_queue.put(humans)

    for human in humans:
        cv2.rectangle(frame, (human["x1"], human["y1"]), (human["x2"], human["y2"]), (0, 255, 0), 2)

    cv2.imshow('Jetson Stream with Detection', frame)
    cv2.waitKey(1)
    
    return jsonify({"message": "Frame received", "humans": humans}), 200


ARDUINO_IP = "http://<arduino-ip>"

@app.route('/control', methods=['POST'])
def control_motor():
    data = request.json
    command = data.get("command")

    if not command:
        return jsonify({"error": "No command received"}), 400

    try:
        response = requests.get(f"{ARDUINO_IP}/{command}")
        return jsonify({"message": f"Sent {command} to Arduino", "arduino_response": response.text}), 200
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to send command to Arduino: {e}"}), 500
    

@app.route('/speech', methods=['POST'])
def receive_speech():
    data = request.json
    transcript = data.get("transcript")

    if not transcript:
        return jsonify({"error": "No transcript received"}), 400

    # Store transcript in the queue
    speech_queue.put(transcript)

    return jsonify({"message": "Speech transcript received", "transcript": transcript}), 200


@app.route('/speech_stream', methods=['GET'])
def speech_stream():
    def event_stream():
        while True:
            if not speech_queue.empty():
                transcript = speech_queue.get()
                yield f"data: {transcript}\n\n"
            time.sleep(0.1)  # Prevent excessive CPU usage

    return Response(event_stream(), mimetype="text/event-stream")


@app.route('/bbox_stream', methods=['GET'])
def bbox_stream():
    """Send properly formatted bounding boxes as SSE"""
    def event_stream():
        while True:
            if not bbox_queue.empty():
                boxes = bbox_queue.get()
                json_data = json.dumps(boxes)
                yield f"data: {json_data}\n\n"

            time.sleep(0.1)  # Prevent CPU overload

    return Response(event_stream(), mimetype="text/event-stream")


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)
