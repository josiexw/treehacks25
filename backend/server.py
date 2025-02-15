from flask import Flask, request, Response, jsonify
import requests
import cv2
import numpy as np

app = Flask(__name__)

@app.route('/video_feed', methods=['POST'])
def video_feed():
    file = request.files['frame']
    if not file:
        return "No frame received", 400
    
    # Convert frame to OpenCV format
    nparr = np.frombuffer(file.read(), np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Display the received frame
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


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
