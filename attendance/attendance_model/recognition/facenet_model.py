import cv2
import numpy as np
from keras_facenet import FaceNet

_facenet = FaceNet()


def get_embeddings_batch(faces):
    """
    Compute embeddings for a list of face images in one batch.
    Args:
        faces: list of BGR images (numpy arrays) of varying sizes
    Returns:
        embeddings: numpy array of shape (N, 512), L2 normalized
    """
    if not faces:
        return np.empty((0, 512))

    processed = []
    for face in faces:
        # Resize to 160x160 for FaceNet
        f = cv2.resize(face, (160, 160), interpolation=cv2.INTER_CUBIC)
        # BGR -> RGB
        rgb = cv2.cvtColor(f, cv2.COLOR_BGR2RGB).astype("float32")
        processed.append(rgb)

    # Batch inference
    embeddings = _facenet.embeddings(processed)

    # L2 Normalize (PRD Section 4: FaceNet generates L2 normalized embeddings)
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True) + 1e-8
    embeddings = embeddings / norms

    return embeddings


def get_embedding(face_image):
    """Compute a single face embedding."""
    return get_embeddings_batch([face_image])[0]
