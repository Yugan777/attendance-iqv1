import cv2
import numpy as np
from detection.mtcnn_detector import detect_faces
from recognition.facenet_model import get_embedding
from database.sqlite_db import save_student, init_db
from camera.blur_filter import is_blurry
from config import CAMERA_SOURCE

MIN_FACE_SIZE = 100
MIN_CONF = 0.90

def enroll_student(student_id, name):

    init_db()

    cap = cv2.VideoCapture(CAMERA_SOURCE)
    
    # RTSP optimizations
    if not isinstance(CAMERA_SOURCE, int):
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    embeddings = []
    frames_collected = 0

    print("Enrollment started.")
    print("Look at camera and move slightly left/right.")

    while frames_collected < 20:

        ret, frame = cap.read()
        if not ret:
            continue

        if is_blurry(frame):
            continue

        boxes = detect_faces(frame, min_conf=MIN_CONF)

        for (x, y, w, h) in boxes:
            H, W = frame.shape[:2]
            if w < MIN_FACE_SIZE or h < MIN_FACE_SIZE:
                continue
            x1 = max(x - 10, 0)
            y1 = max(y - 10, 0)
            x2 = min(x + w + 10, W)
            y2 = min(y + h + 10, H)
            face = frame[y1:y2, x1:x2]
            if face.size == 0:
                continue
            emb = get_embedding(face)
            embeddings.append(emb)

            frames_collected += 1
            print(f"Captured {frames_collected}/20")

        cv2.imshow("Enrollment - Press ESC to exit", frame)

        if cv2.waitKey(1) == 27:
            break

    cap.release()
    cv2.destroyAllWindows()

    if len(embeddings) == 0:
        print("Enrollment failed. No face detected.")
        return

    # Normalize each embedding first
    normalized = [e / np.linalg.norm(e) for e in embeddings]

    avg_embedding = np.mean(normalized, axis=0)
    avg_embedding /= np.linalg.norm(avg_embedding)

    save_student(student_id, name, avg_embedding)

    print("Enrollment successful.")
if __name__ == "__main__":
    student_id = input("Enter Student ID: ")
    name = input("Enter Name: ")
    enroll_student(student_id, name)