"""creates endpoint for websocket and video stream, forwarded to localhost:7860

diff: make autonomous control/motor control work
"""

import asyncio
import argparse
from aiohttp import web, WSCloseCode
import logging
import weakref
import cv2
import time
import PIL.Image
import matplotlib.pyplot as plt
from typing import List
from nanoowl.tree import Tree
from nanoowl.tree_predictor import (
    TreePredictor,
    TreeOutput,
    TreeDetection
)
from nanoowl.owl_predictor import OwlPredictor
import numpy as np
from typing import List
from aiohttp.web import middleware
from datetime import datetime

def calculate_iou(box1, box2):
    """Calculate intersection over union between two bounding boxes."""
    x1_1, y1_1, x2_1, y2_1 = box1
    x1_2, y1_2, x2_2, y2_2 = box2
    
    x1_i = max(x1_1, x1_2)
    y1_i = max(y1_1, y1_2)
    x2_i = min(x2_1, x2_2)
    y2_i = min(y2_1, y2_2)
    
    if x2_i < x1_i or y2_i < y1_i:
        return 0.0
    
    intersection = (x2_i - x1_i) * (y2_i - y1_i)
    area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
    area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
    union = area1 + area2 - intersection
    
    return intersection / union if union > 0 else 0.0

def merge_overlapping_boxes(detections: List[TreeDetection], iou_threshold: float = 0.5) -> List[TreeDetection]:
    """Merge overlapping bounding boxes with IoU above threshold."""
    if not detections:
        return detections
        
    filtered_detections = [d for d in detections if d.id != 0]
    image_detections = [d for d in detections if d.id == 0]
    
    if not filtered_detections:
        return detections
        
    sorted_detections = sorted(filtered_detections, key=lambda x: x.scores[0], reverse=True)
    merged_detections = []
    
    while sorted_detections:
        current = sorted_detections.pop(0)
        to_merge = []
        
        i = 0
        while i < len(sorted_detections):
            if (current.labels[0] == sorted_detections[i].labels[0] and
                calculate_iou(current.box, sorted_detections[i].box) > iou_threshold):
                to_merge.append(sorted_detections.pop(i))
            else:
                i += 1
        
        if to_merge:
            total_score = current.scores[0] + sum(d.scores[0] for d in to_merge)
            weights = [d.scores[0]/total_score for d in [current] + to_merge]
            
            merged_box = [0, 0, 0, 0]
            for idx, det in enumerate([current] + to_merge):
                for i in range(4):
                    merged_box[i] += det.box[i] * weights[idx]
            
            current.box = tuple(merged_box)
            current.scores = [total_score / (len(to_merge) + 1)]
            
        merged_detections.append(current)
    
    return image_detections + merged_detections

def get_colors(count: int):
    cmap = plt.cm.get_cmap("rainbow", count)
    colors = []
    for i in range(count):
        color = cmap(i)
        color = [int(255 * value) for value in color]
        colors.append(tuple(color))
    return colors

def cv2_to_pil(image):
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    return PIL.Image.fromarray(image)

async def handle_index_get(request: web.Request):
    logging.info("handle_index_get")
    return web.FileResponse("./index.html")

async def websocket_handler(request):
    global prompt_data

    ws = web.WebSocketResponse()
    await ws.prepare(request)
    logging.info("Websocket connected.")
    request.app['websockets'].add(ws)

    try:
        async for msg in ws:
            logging.info(f"Received message from websocket.")
            if "prompt" in msg.data:
                header, prompt = msg.data.split(":")
                logging.info("Received prompt: " + prompt)
                try:
                    tree = Tree.from_prompt(prompt)
                    clip_encodings = predictor.encode_clip_text(tree)
                    owl_encodings = predictor.encode_owl_text(tree)
                    prompt_data = {
                        "tree": tree,
                        "clip_encodings": clip_encodings,
                        "owl_encodings": owl_encodings
                    }
                    logging.info("Set prompt: " + prompt)
                except Exception as e:
                    logging.error(f"Error processing prompt: {e}")
    finally:
        request.app['websockets'].discard(ws)

    return ws

# Add CORS middleware
@middleware
async def cors_middleware(request, handler):
    response = await handler(request)
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

# Add new global variable near the top with other globals
motor_control_enabled = False

# Add new global variable for autonomous control
autonomous_control_enabled = False

# Add new handler function for autonomous control
async def handle_autonomous_control(request):
    global autonomous_control_enabled, motor_control_enabled
    try:
        data = await request.json()
        enabled = data.get('enabled', False)
        
        # If enabling autonomous control, disable motor control
        if enabled:
            motor_control_enabled = False
            logging.info("🎮 Motor control disabled due to autonomous mode")
        
        autonomous_control_enabled = enabled
        logging.info(f"🤖 Autonomous control {'enabled' if enabled else 'disabled'}")
        
        return web.json_response({
            'autonomous': enabled,
            'motor': False if enabled else motor_control_enabled
        })
    except Exception as e:
        logging.error(f"Error updating autonomous control state: {e}")
        return web.Response(
            status=500,
            text=f'Error updating autonomous control state: {str(e)}'
        )

# Modify the motor control handler
async def handle_motor_control(request):
    global motor_control_enabled, autonomous_control_enabled
    try:
        data = await request.json()
        enabled = data.get('enabled', False)
        
        # If enabling motor control, disable autonomous control
        if enabled:
            autonomous_control_enabled = False
            logging.info("🤖 Autonomous control disabled due to motor control")
        
        motor_control_enabled = enabled
        logging.info(f"🎮 Motor control {'enabled' if enabled else 'disabled'}")
        
        return web.json_response({
            'autonomous': False if enabled else autonomous_control_enabled,
            'motor': enabled
        })
    except Exception as e:
        logging.error(f"Error updating motor control state: {e}")
        return web.Response(
            status=500,
            text=f'Error updating motor control state: {str(e)}'
        )

# Add these global variables near the top
TRACKING_THRESHOLD = 3  # frames before a box is considered valid
IOU_THRESHOLD = 0.6    # threshold for considering boxes to be the same between frames
IOU_THRESHOLD_FOR_MERGING = 0.6 # threshold for merging overlapping boxes (higher = less merging)
MISSING_THRESHOLD = 2  # frames before a box is considered gone
current_tracked_boxes = []  # list of currently tracked boxes

# Modify the TrackedBox class to track missing frames
class TrackedBox:
    def __init__(self, detection, label_map):
        self.box = detection.box
        self.labels = [label_map[label] for label in detection.labels]
        self.scores = detection.scores
        self.frame_count = 1
        self.missing_frames = 0
        self.last_seen = time.time()
    
    def update(self, new_detection, label_map):
        self.box = new_detection.box
        self.labels = [label_map[label] for label in new_detection.labels]
        self.scores = new_detection.scores
        self.frame_count += 1
        self.missing_frames = 0
        self.last_seen = time.time()
    
    def mark_missing(self):
        self.missing_frames += 1
    
    def is_valid(self):
        return (self.frame_count >= TRACKING_THRESHOLD and 
                self.missing_frames < MISSING_THRESHOLD)

# Modify the update_tracked_boxes function
def update_tracked_boxes(detections, label_map):
    global current_tracked_boxes
    current_time = time.time()
    
    # First mark all boxes as missing
    for box in current_tracked_boxes:
        box.mark_missing()
    
    # Match new detections to existing tracked boxes
    matched_detections = set()
    for i, detection in enumerate(detections):
        if detection.id == 0:  # Skip image-level detections
            continue
            
        best_match = None
        best_iou = IOU_THRESHOLD
        best_idx = -1
        
        # Find best matching existing box
        for j, tracked_box in enumerate(current_tracked_boxes):
            iou = calculate_iou(detection.box, tracked_box.box)
            if iou > best_iou:
                best_iou = iou
                best_match = tracked_box
                best_idx = j
        
        if best_match is not None:
            best_match.update(detection, label_map)
            matched_detections.add(i)
    
    # Add new detections that weren't matched
    for i, detection in enumerate(detections):
        if detection.id != 0 and i not in matched_detections:
            current_tracked_boxes.append(TrackedBox(detection, label_map))
    
    # Remove boxes that have been missing too long
    current_tracked_boxes = [box for box in current_tracked_boxes 
                           if box.missing_frames < MISSING_THRESHOLD]
    
    # Return only valid boxes
    return [box for box in current_tracked_boxes if box.is_valid()]

# Modify the handle_video_stream function
async def handle_video_stream(request):
    response = web.StreamResponse()
    response.content_type = 'multipart/x-mixed-replace; boundary=frame'
    response.headers['Cache-Control'] = 'no-cache'
    await response.prepare(request)
    
    camera = cv2.VideoCapture(CAMERA_DEVICE)
    camera.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    
    try:
        while True:
            success, frame = camera.read()
            if not success:
                break
                
            image_pil = cv2_to_pil(frame)
            
            if prompt_data is not None:
                try:
                    tree_output = predictor.predict(
                        image_pil,
                        tree=prompt_data['tree'],
                        clip_text_encodings=prompt_data['clip_encodings'],
                        owl_text_encodings=prompt_data['owl_encodings']
                    )
                    
                    detections = list(tree_output.detections)
                    non_image_dets = [d for d in detections if d.id != 0]
                    if len(non_image_dets) > 1:
                        merged_detections = merge_overlapping_boxes(detections, iou_threshold=0.6)
                        tree_output = TreeOutput(detections=merged_detections)
                    
                    # Get valid tracked boxes
                    label_map = prompt_data['tree'].get_label_map()
                    valid_boxes = update_tracked_boxes(tree_output.detections, label_map)
                    
                    # Draw only valid tracked boxes
                    is_pil = not isinstance(frame, np.ndarray)
                    if is_pil:
                        frame = np.asarray(frame)
                    
                    font = cv2.FONT_HERSHEY_SIMPLEX
                    font_scale = 0.75
                    
                    for tracked_box in valid_boxes:
                        box = [int(x) for x in tracked_box.box]
                        pt0 = (box[0], box[1])
                        pt1 = (box[2], box[3])
                        
                        # Color based on whether it's a target or obstacle
                        is_target = any(label == prompt_data['target'] for label in tracked_box.labels)
                        is_obstacle = any(label in prompt_data['obstacles'] for label in tracked_box.labels)
                        
                        if is_target:
                            color = (107, 107, 255)  # #ff6b6b in BGR
                        elif is_obstacle:
                            color = (251, 218, 97)   # #61dafb in BGR
                        else:
                            color = (128, 128, 128)  # Gray for other objects
                        
                        # Draw bounding box
                        cv2.rectangle(
                            frame,
                            pt0,
                            pt1,
                            color,
                            3
                        )
                        
                        # Draw labels with confidence scores
                        offset_y = 30
                        offset_x = 8
                        for i, label in enumerate(tracked_box.labels):
                            label_text = f"{label} ({tracked_box.scores[i]*100:.1f}%)"
                            cv2.putText(
                                frame,
                                label_text,
                                (box[0] + offset_x, box[1] + offset_y),
                                font,
                                font_scale,
                                color,
                                2,  # thickness
                                cv2.LINE_AA
                            )
                            offset_y += 18
                    
                    if is_pil:
                        frame = PIL.Image.fromarray(frame)
                        
                except Exception as e:
                    logging.error(f"Error processing frame: {e}")
            
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, IMAGE_QUALITY])
            bytes_buffer = buffer.tobytes()
            
            await response.write(
                b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n\r\n' + bytes_buffer + b'\r\n'
            )
            
            await asyncio.sleep(0.03)  # Approximately 30 FPS
            
    except Exception as e:
        logging.error(f"Stream error: {e}")
    finally:
        camera.release()
    
    return response

# Add these global variables after the imports
CONTROL_FREQUENCY = 0.1  # seconds between control messages (10Hz)
last_control_time = datetime.now()
current_control = None

# Modify the handle_prompt_update function to handle obstacles
async def handle_prompt_update(request):
    global prompt_data
    
    try:
        data = await request.json()
        new_prompt = data.get('prompt')
        target = data.get('target', '')
        obstacles = data.get('obstacles', [])
        
        if not new_prompt:
            return web.Response(
                status=400,
                text='Prompt is required in the request body'
            )
        
        logging.info(f"🎯 Target: {target}")
        if obstacles:
            logging.info(f"🚫 Obstacles: {', '.join(obstacles)}")
        
        tree = Tree.from_prompt(new_prompt)
        clip_encodings = predictor.encode_clip_text(tree)
        owl_encodings = predictor.encode_owl_text(tree)
        prompt_data = {
            "tree": tree,
            "clip_encodings": clip_encodings,
            "owl_encodings": owl_encodings,
            "target": target,
            "obstacles": obstacles
        }
        
        return web.Response(
            status=200,
            text=f'Prompt updated successfully: {new_prompt}'
        )
        
    except Exception as e:
        logging.error(f"Error updating prompt: {e}")
        return web.Response(
            status=500,
            text=f'Error updating prompt: {str(e)}'
        )

# Modify the handle_control function to check motor_control_enabled
async def handle_control(request):
    global current_control, last_control_time
    
    if not motor_control_enabled:
        return web.Response(
            status=400,
            text='Motor control is disabled'
        )
    
    try:
        data = await request.json()
        direction = data.get('direction')
        
        if not direction:
            return web.Response(
                status=400,
                text='Direction is required in the request body'
            )

        current_time = datetime.now()
        time_diff = (current_time - last_control_time).total_seconds()
        
        if time_diff >= CONTROL_FREQUENCY or direction != current_control:
            last_control_time = current_time
            current_control = direction
            
            if direction.startswith('target:'):
                logging.info(f"🎯 Target command received: {direction}")
            else:
                logging.info(f"🎮 Control command received: {direction}")
                # Here you would add your RC car control logic
                if direction == 'forward':
                    logging.info("Moving forward ⬆️")
                elif direction == 'backward':
                    logging.info("Moving backward ⬇️")
                elif direction == 'left':
                    logging.info("Turning left ⬅️")
                elif direction == 'right':
                    logging.info("Turning right ➡️")
                elif direction == 'stop':
                    logging.info("Stopping ⏹️")
                    current_control = None
        
        return web.Response(
            status=200,
            text=f'Control command received: {direction}'
        )
        
    except Exception as e:
        logging.error(f"Error processing control command: {e}")
        return web.Response(
            status=500,
            text=f'Error processing control command: {str(e)}'
        )

async def on_shutdown(app: web.Application):
    for ws in set(app['websockets']):
        await ws.close(code=WSCloseCode.GOING_AWAY,
                      message='Server shutdown')

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("image_encode_engine", type=str)
    parser.add_argument("--image_quality", type=int, default=50)
    parser.add_argument("--port", type=int, default=7860)
    parser.add_argument("--host", type=str, default="0.0.0.0")
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--resolution", type=str, default="640x480", help="Camera resolution as WIDTHxHEIGHT")
    args = parser.parse_args()
    width, height = map(int, args.resolution.split("x"))

    CAMERA_DEVICE = args.camera
    IMAGE_QUALITY = args.image_quality

    predictor = TreePredictor(
        owl_predictor=OwlPredictor(
            image_encoder_engine=args.image_encode_engine
        )
    )

    # Set default prompt data
    default_target = "a shoe"
    default_obstacles = ["a bottle"]
    default_prompt = f"[{default_target}, {', '.join(default_obstacles)}]"

    # Initialize with default values
    tree = Tree.from_prompt(default_prompt)
    clip_encodings = predictor.encode_clip_text(tree)
    owl_encodings = predictor.encode_owl_text(tree)
    
    prompt_data = {
        "tree": tree,
        "clip_encodings": clip_encodings,
        "owl_encodings": owl_encodings,
        "target": default_target,
        "obstacles": default_obstacles
    }

    logging.basicConfig(level=logging.INFO)
    logging.info(f"🎯 Default Target: {default_target}")
    logging.info(f"🚫 Default Obstacles: {', '.join(default_obstacles)}")
    app = web.Application(middlewares=[cors_middleware])
    app['websockets'] = weakref.WeakSet()
    
    # Routes
    app.router.add_get("/", handle_index_get)
    app.router.add_route("GET", "/ws", websocket_handler)
    app.router.add_get("/video-feed", handle_video_stream)
    app.router.add_post("/update-prompt", handle_prompt_update)
    app.router.add_post("/control", handle_control)
    app.router.add_post("/motor-control", handle_motor_control)
    app.router.add_post("/autonomous-control", handle_autonomous_control)
    
    app.on_shutdown.append(on_shutdown)
    web.run_app(app, host=args.host, port=args.port)