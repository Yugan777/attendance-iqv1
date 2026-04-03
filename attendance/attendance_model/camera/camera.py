from typing import Union
import cv2
import os
from config import CAMERA_SOURCE, CAMERA_CAPTURE_WIDTH, CAMERA_CAPTURE_HEIGHT, USE_FFMPEG_BACKEND


class Camera:
    def __init__(self, source: Union[int, str] = CAMERA_SOURCE):
        """
        Initialize camera with source (index or RTSP URL).
        """
        # Set backend to FFmpeg for RTSP/RTSPS if specified in config
        backend = cv2.CAP_ANY
        if isinstance(source, str) and USE_FFMPEG_BACKEND:
            # Set environment variable to prefer FFmpeg (sometimes helps on Pi)
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
            backend = cv2.CAP_FFMPEG

        self.cap = cv2.VideoCapture(source, backend)
        
        # Set resolution for USB cameras (ignored by many RTSP streams but good practice)
        if isinstance(source, int):
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, CAMERA_CAPTURE_WIDTH)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAMERA_CAPTURE_HEIGHT)
        else:
            # RTSP optimizations: reduce buffer size for lower latency
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            # For RTSPS, we might need some extra time to connect
            if str(source).startswith('rtsps'):
                print(f"[CAMERA] Connecting to secure RTSPS stream...")

    def is_opened(self) -> bool:
        return self.cap.isOpened()

    def read(self):
        return self.cap.read()

    def release(self):
        if self.cap is not None:
            self.cap.release()
            self.cap = None


def frames(source: Union[int, str] = CAMERA_SOURCE):
    cam = Camera(source)
    try:
        while cam.is_opened():
            ret, frame = cam.read()
            if not ret:
                break
            yield frame
    finally:
        cam.release()
