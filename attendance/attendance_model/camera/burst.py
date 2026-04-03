import cv2
import time
from config import CAMERA_SOURCE

def burst_capture(source=CAMERA_SOURCE, num_frames=10, duration=1.5):
    cap = cv2.VideoCapture(source)
    
    # RTSP optimizations
    if not isinstance(source, int):
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        
    frames = []

    start_time = time.time()

    while len(frames) < num_frames:
        ret, frame = cap.read()
        if not ret:
            break

        frames.append(frame)

        if time.time() - start_time > duration:
            break

    cap.release()
    return frames