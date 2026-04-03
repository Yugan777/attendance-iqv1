import cv2

def blur_variance(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    # Enhance contrast to make Laplacian more robust in low light
    try:
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)
    except Exception:
        pass
    return cv2.Laplacian(gray, cv2.CV_64F).var()

def is_blurry(frame, threshold=25):
    variance = blur_variance(frame)
    return variance < threshold

def filter_sharp_frames(frames):
    sharp_frames = []
    for f in frames:
        if not is_blurry(f):
            sharp_frames.append(f)
    return sharp_frames
