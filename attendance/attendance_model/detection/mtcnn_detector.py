import cv2
from mtcnn import MTCNN
from config import MIN_FACE_SIZE

# Initialize MTCNN with a smaller min_face_size for distance
_detector = MTCNN(min_face_size=MIN_FACE_SIZE)

def detect_faces(frame, min_conf=0.6):

    try:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = _detector.detect_faces(rgb)
    except Exception as e:
        # If MTCNN crashes, skip frame safely
        print("MTCNN error, skipping frame")
        return []

    boxes = []

    for result in results:
        if result.get('confidence', 0) < min_conf:
            continue
        x, y, w, h = result['box']

        # Ensure valid positive dimensions
        if w > 0 and h > 0:
            boxes.append((x, y, w, h))

    return boxes
