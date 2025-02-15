from flask import Flask, request, jsonify
import requests

app = Flask(__name__)
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
