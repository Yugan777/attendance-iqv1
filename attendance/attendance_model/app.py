"""
AI Classroom Attendance System – Raspberry Pi Flask API
=======================================================
Lightweight face-processing API running on Raspberry Pi.
No database — all storage is handled by the frontend via Supabase.

Endpoints (matching frontend contracts):
  GET  /api/health  – Health check
  POST /api/detect  – Capture from camera, detect & match faces
  POST /api/enroll  – Process images, return face embedding
"""

import cv2
import base64
import numpy as np
import os
import time
from flask import Flask, request, jsonify
from flask_cors import CORS

from detection.mtcnn_detector import detect_faces
from recognition.facenet_model import get_embedding, get_embeddings_batch, _facenet
from camera.blur_filter import blur_variance
from config import (
    COSINE_THRESHOLD,
    MIN_FACE_SIZE,
    FRAME_WIDTH,
    FRAME_HEIGHT,
    MIN_DETECTION_CONF,
    CAMERA_SOURCE,
    USE_FFMPEG_BACKEND,
    CAMERA_CAPTURE_WIDTH,
    CAMERA_CAPTURE_HEIGHT,
    BLUR_THRESHOLD,
)

# -------- APP SETUP --------
app = Flask(__name__)
CORS(app)  # Allow frontend to call the API


# -------- HELPERS --------

def decode_image(base64_str):
    """Decode a base64 image string to an OpenCV frame."""
    try:
        if "," in base64_str:
            base64_str = base64_str.split(",")[1]
        img_bytes = base64.b64decode(base64_str)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return frame
    except Exception as e:
        print("Image decode error:", e)
        return None


def clahe_enhance(frame):
    """Apply CLAHE enhancement for better detection in varying lighting."""
    try:
        ycrcb = cv2.cvtColor(frame, cv2.COLOR_BGR2YCrCb)
        y, cr, cb = cv2.split(ycrcb)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        y = clahe.apply(y)
        ycrcb = cv2.merge([y, cr, cb])
        return cv2.cvtColor(ycrcb, cv2.COLOR_YCrCb2BGR)
    except Exception:
        return frame


def capture_frames(num_frames=10, interval=0.3):
    """Capture multiple frames from the camera (USB or RTSP)."""
    # Set backend to FFmpeg for RTSP/RTSPS if specified in config
    backend = cv2.CAP_ANY
    if isinstance(CAMERA_SOURCE, str) and USE_FFMPEG_BACKEND:
        # Prefer TCP for stability on RTSP streams
        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
        backend = cv2.CAP_FFMPEG

    cap = cv2.VideoCapture(CAMERA_SOURCE, backend)
    
    # Set resolution for USB cameras (ignored by many RTSP streams but good practice)
    if isinstance(CAMERA_SOURCE, int):
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, CAMERA_CAPTURE_WIDTH)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAMERA_CAPTURE_HEIGHT)
    else:
        # RTSP optimizations: reduce buffer size for lower latency
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    if not cap.isOpened():
        print(f"[ERROR] Could not open camera source: {CAMERA_SOURCE}")
        return None

    frames = []
    # Warm up camera (discard first few frames)
    # For RTSP/RTSPS, this is critical to clear stale frames from the buffer
    for _ in range(5):
        cap.read()

    for _ in range(num_frames):
        ret, frame = cap.read()
        if ret:
            frames.append(frame)
        else:
            print(f"[WARNING] Failed to capture frame from {CAMERA_SOURCE}")
        time.sleep(interval)

    cap.release()
    return frames


def preprocess_face(face):
    """Preprocess a single face for batch embedding generation."""
    # Resize to 160x160 for FaceNet
    f = cv2.resize(face, (160, 160), interpolation=cv2.INTER_CUBIC)
    # BGR -> RGB
    rgb = cv2.cvtColor(f, cv2.COLOR_BGR2RGB).astype("float32")
    return rgb

# -------- API ENDPOINTS --------

@app.route("/api/health", methods=["GET"])
def api_health():
    """GET /api/health — Health check for frontend connectivity test."""
    return jsonify({"status": "ok", "service": "attendance-pi", "timestamp": time.time()})


@app.route("/api/detect", methods=["POST"])
def api_detect():
    """
    POST /api/detect
    Request body: {
        "section": "10-A",
        "students": [
            { "id": "uuid", "rollNumber": "01", "name": "Aarav", "embedding": [0.1, 0.2, ...512] }
        ]
    }
    Response: {
        "detected": [{ "studentId": "uuid", "confidence": 0.85 }],
        "frameCount": 10,
        "faceCount": 5
    }

    Flow:
      1. Capture frames from USB camera
      2. For each frame: resize → MTCNN detect → crop faces → FaceNet embed
      3. Compare each face embedding against student embeddings (cosine similarity)
      4. Return list of matched student IDs with confidence
    """
    data = request.json or {}
    students_list = data.get("students", [])

    if not students_list:
        return jsonify({"error": "No students provided"}), 400

    # Build embedding matrix from student data
    student_ids = []
    student_embeddings = []

    for s in students_list:
        emb = s.get("embedding")
        if emb and isinstance(emb, list) and len(emb) == 512:
            student_ids.append(s["id"])
            student_embeddings.append(np.array(emb, dtype="float32"))

    if not student_embeddings:
        return jsonify({
            "detected": [],
            "frameCount": 0,
            "faceCount": 0,
            "message": "No enrolled students with embeddings"
        })

    emb_matrix = np.vstack(student_embeddings)
    # Pre-normalize for cosine similarity
    norms = np.linalg.norm(emb_matrix, axis=1, keepdims=True) + 1e-8
    normalized_emb = emb_matrix / norms

    # Capture frames from camera (Optimized for speed)
    print("[DETECT] Capturing frames from camera...")
    # Reduced frame count to 5 and faster interval to speed up detection
    frames = capture_frames(num_frames=5, interval=0.2)

    if not frames:
        return jsonify({"error": "Camera not available"}), 503

    print(f"[DETECT] Captured {len(frames)} frames")

    # Process frames
    detected_students = {}  # studentId -> best confidence
    total_faces = 0

    # Collect all faces first to batch process
    all_faces = []
    face_indices = [] # Map index in all_faces back to frame info if needed

    for i, frame in enumerate(frames):
        # Resize to processing resolution (PRD: 640x360)
        proc_frame = cv2.resize(frame, (FRAME_WIDTH, FRAME_HEIGHT))
        det_frame = clahe_enhance(proc_frame)

        # Detect faces
        boxes = detect_faces(det_frame, min_conf=MIN_DETECTION_CONF)
        if not boxes:
            continue

        for (x, y, w, h) in boxes:
            # PRD: ignore faces < 60px
            if w < MIN_FACE_SIZE or h < MIN_FACE_SIZE:
                continue

            face = proc_frame[y:y+h, x:x+w]
            if face.size == 0:
                continue

            total_faces += 1
            
            # Preprocess face for batch embedding
            face_prep = preprocess_face(face)
            all_faces.append(face_prep)

    if not all_faces:
        print("[DETECT] No valid faces found in frames")
        return jsonify({
            "detected": [],
            "frameCount": len(frames),
            "faceCount": 0,
        })

    # Batch embedding generation (Much faster than one-by-one)
    try:
        faces_array = np.array(all_faces)
        # Use the underlying keras model from facenet_model or _facenet directly if accessible
        # Since _facenet wraps the keras model, we can use its embeddings method directly for batch
        # But get_embeddings_batch already handles preprocessing, so we might be double processing if not careful.
        # Let's use the _facenet instance we imported to call .embeddings directly on preprocessed data
        
        embeddings = _facenet.embeddings(all_faces)
        
        # Match each embedding
        for i, emb in enumerate(embeddings):
            # L2 normalize
            norm = np.linalg.norm(emb) + 1e-8
            emb_norm = emb / norm
            
            # Cosine similarity matching
            sims = normalized_emb @ emb_norm
            best_idx = np.argmax(sims)
            best_sim = float(sims[best_idx])

            # PRD: threshold > 0.6
            if best_sim > COSINE_THRESHOLD:
                sid = student_ids[best_idx]
                # Keep best confidence for each student
                if sid not in detected_students or best_sim > detected_students[sid]:
                    detected_students[sid] = best_sim
                    
    except Exception as e:
        print(f"[DETECT] Error in batch processing: {e}")
        # Fallback logic could go here, but batching is standard for Keras

    # Build response
    detected = [
        {"studentId": sid, "confidence": round(conf, 3)}
        for sid, conf in detected_students.items()
    ]

    print(f"[DETECT] Detected {len(detected)} students out of {total_faces} faces across {len(frames)} frames")

    return jsonify({
        "detected": detected,
        "frameCount": len(frames),
        "faceCount": total_faces,
    })


@app.route("/api/enroll", methods=["POST"])
def api_enroll():
    """
    POST /api/enroll
    Request body: {
        "studentId": "uuid",
        "images": ["base64image1", "base64image2", ...]
    }
    Response: {
        "status": "success",
        "studentId": "uuid",
        "embedding": [0.1, 0.2, ...512],
        "imagesProcessed": 8,
        "imagesTotal": 10
    }

    Flow:
      1. Decode each image
      2. MTCNN detect largest face
      3. FaceNet generate embedding
      4. Average all embeddings, L2 normalize
      5. Return final embedding (frontend stores in Supabase)
    """
    data = request.json or {}
    student_id = data.get("studentId", "")
    images = data.get("images", [])

    if not student_id:
        return jsonify({"error": "Missing studentId"}), 400
    if not images or len(images) == 0:
        return jsonify({"error": "No images provided"}), 400

    print(f"[ENROLL] Processing {len(images)} images for student {student_id}")

    faces = []
    face_logs = []

    for i, img_data in enumerate(images):
        frame = decode_image(img_data)
        if frame is None:
            print(f"  Image {i}: decode failed, skipping")
            continue

        # Detect face
        det_frame = clahe_enhance(frame)
        boxes = detect_faces(det_frame, min_conf=MIN_DETECTION_CONF)

        if not boxes:
            print(f"  Image {i}: no face detected, skipping")
            continue

        # Use largest face
        largest = max(boxes, key=lambda b: b[2] * b[3])
        x, y, w, h = largest

        if w < MIN_FACE_SIZE or h < MIN_FACE_SIZE:
            print(f"  Image {i}: face too small ({w}x{h}), skipping")
            continue

        face = frame[y:y+h, x:x+w]
        if face.size == 0:
            continue

        # Check blur
        var = blur_variance(face)
        if var < BLUR_THRESHOLD:
            print(f"  Image {i}: too blurry (variance={var:.1f}), skipping")
            continue

        faces.append(face)
        face_logs.append((i, w, h, var))
        print(f"  Image {i}: OK (face {w}x{h}, blur={var:.1f})")

    if len(faces) == 0:
        return jsonify({"error": "No usable face detected in any image"}), 400

    # Average embeddings and L2 normalize
    embeddings = get_embeddings_batch(faces)
    normalized = [e / (np.linalg.norm(e) + 1e-8) for e in embeddings]
    avg_embedding = np.mean(normalized, axis=0)
    avg_embedding = avg_embedding / (np.linalg.norm(avg_embedding) + 1e-8)

    embedding_list = avg_embedding.astype(float).tolist()

    print(f"[ENROLL] Success: {len(faces)}/{len(images)} images processed")

    return jsonify({
        "status": "success",
        "studentId": student_id,
        "embedding": embedding_list,
        "imagesProcessed": len(faces),
        "imagesTotal": len(images),
    })


# -------- ENTRY POINT --------
if __name__ == "__main__":
    host = os.environ.get("APP_HOST", "0.0.0.0")
    port = int(os.environ.get("APP_PORT", "5000"))
    print(f"🎯 Attendance Pi API starting on {host}:{port}")
    print(f"   Camera source: {CAMERA_SOURCE}")
    print(f"   Threshold: {COSINE_THRESHOLD}")
    print(f"   Min face: {MIN_FACE_SIZE}px")
    app.run(debug=False, use_reloader=False, host=host, port=port)
