"""creates endpoint for websocket and video stream, forwarded to localhost:7860

diff: defaults and managing target/obstacles better
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
from nanoowl.tree_drawing import draw_tree_output
from nanoowl.owl_predictor import OwlPredictor
import numpy as np
from typing import List, Tuple
from aiohttp.web import middleware
from aiohttp_cors import setup as cors_setup, ResourceOptions
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

# Modify the handle_video_stream function
async def handle_video_stream(request):
    response = web.StreamResponse()
    response.content_type = 'multipart/x-mixed-replace; boundary=frame'
    response.headers['Access-Control-Allow-Origin'] = '*'
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
                        merged_detections = merge_overlapping_boxes(detections, iou_threshold=0.8)
                        tree_output = TreeOutput(detections=merged_detections)
                    
                    frame = draw_tree_output(frame, tree_output, prompt_data['tree'])
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

# Add this new handler function
async def handle_control(request):
    global current_control, last_control_time
    
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

    prompt_data = None

    logging.basicConfig(level=logging.INFO)
    app = web.Application(middlewares=[cors_middleware])
    
    # Setup CORS
    cors = cors_setup(app, defaults={
        "*": ResourceOptions(
            allow_credentials=True,
            expose_headers="*",
            allow_headers="*",
            allow_methods="*"
        )
    })
    
    # Routes
    app.router.add_get("/", handle_index_get)
    app.router.add_route("GET", "/ws", websocket_handler)
    app.router.add_get("/video-feed", handle_video_stream)
    app.router.add_post("/update-prompt", handle_prompt_update)
    app.router.add_post("/control", handle_control)
    
    # Configure CORS for all routes
    for route in list(app.router.routes()):
        cors.add(route)
    
    app.on_shutdown.append(on_shutdown)
    web.run_app(app, host=args.host, port=args.port)