from flask import Flask, request, Response
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
