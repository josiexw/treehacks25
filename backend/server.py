from flask import Flask, request, Response, jsonify
import requests
import cv2
import numpy as np
import queue

app = Flask(__name__)

# Queue to store speech transcripts
speech_queue = queue.Queue()

@app.route('/video_feed', methods=['POST'])
def video_feed():
    file = request.files['frame']
    if not file:
        return "No frame received", 400
    
    nparr = np.frombuffer(file.read(), np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    cv2.imshow('Jetson Stream', frame)
    cv2.waitKey(1)
    
    return "Frame received", 200


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

    return Response(event_stream(), mimetype="text/event-stream")


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)
