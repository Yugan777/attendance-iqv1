import os

# Recognition thresholds (Tuned for distance - matching SCRFD performance)
COSINE_THRESHOLD = 0.55      # Reduced from 0.6 for better distance matching
MIN_FACE_SIZE = 30           # Reduced from 60 to capture distant students
FRAME_WIDTH = 1280           # Increased from 640 for better detail at distance
FRAME_HEIGHT = 720           # Increased from 360 for better detail at distance
MIN_DETECTION_CONF = 0.6     # Reduced from 0.85 for sensitive distant detection
BLUR_THRESHOLD = float(os.environ.get("BLUR_THRESHOLD", "12")) # More lenient for distant blur

# Camera settings (PRD Section 12)
# Default RTSPS URL provided by user
# Note: rtsps requires OpenCV built with FFmpeg support (standard on most Pi OS builds)
DEFAULT_RTSP_URL = "rtsps://admin:AttendanceCam_Alpha23@192.168.0.200:554/video/live?channel=1&subtype=1"

# Camera source: can be an integer (USB index) or a string (RTSP URL)
CAMERA_SOURCE = os.environ.get("CAMERA_SOURCE", DEFAULT_RTSP_URL)

# Use FFmpeg as the backend for RTSP streams for better protocol support (RTSPS)
# Set to True to force FFmpeg backend for string sources
USE_FFMPEG_BACKEND = True

# Try to convert to int if it's a numeric string (USB camera index)
try:
    if str(CAMERA_SOURCE).isdigit():
        CAMERA_SOURCE = int(CAMERA_SOURCE)
        USE_FFMPEG_BACKEND = False
except (ValueError, TypeError):
    pass

CAMERA_CAPTURE_WIDTH = 1280  # PRD: camera resolution 1280x720
CAMERA_CAPTURE_HEIGHT = 720
