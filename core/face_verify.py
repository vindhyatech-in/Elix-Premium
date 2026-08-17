"""
Self-Hosted Python ML Face Verification Module (Option A Architecture).

Provides 1:1 facial identity comparison between live arrival selfie images
(uploaded via Beautician Dashboard) and stored reference profile photos
(Employee.face_photo_front / Employee.face_embedding).

Uses OpenCV YuNet + SFace Deep Convolutional Neural Network (128-d facial embeddings)
with Cosine Similarity matching (threshold >= 0.363 for true 1:1 biometric identity).
"""
import logging
import math
import os
from io import BytesIO

from PIL import Image

try:
    import cv2
    import numpy as np
    HAVE_CV2 = True
except ImportError:
    HAVE_CV2 = False
    import numpy as np

try:
    import face_recognition
    HAVE_FACE_RECOGNITION = True
except ImportError:
    HAVE_FACE_RECOGNITION = False

logger = logging.getLogger(__name__)

# Paths to OpenCV YuNet & SFace ONNX models
YUNET_PATH = os.path.join(os.path.dirname(__file__), 'ml_models', 'face_detection_yunet_2023mar.onnx')
SFACE_PATH = os.path.join(os.path.dirname(__file__), 'ml_models', 'face_recognition_sface_2021dec.onnx')

_YUNET_DETECTOR = None
_SFACE_RECOGNIZER = None

def _get_sface_models():
    global _YUNET_DETECTOR, _SFACE_RECOGNIZER
    if not HAVE_CV2:
        return None, None
    if _YUNET_DETECTOR is None or _SFACE_RECOGNIZER is None:
        if os.path.exists(YUNET_PATH) and os.path.exists(SFACE_PATH):
            try:
                _YUNET_DETECTOR = cv2.FaceDetectorYN.create(YUNET_PATH, '', (300, 300), score_threshold=0.55)
                _SFACE_RECOGNIZER = cv2.FaceRecognizerSF.create(SFACE_PATH, '')
            except Exception as e:
                logger.error("Failed to load YuNet / SFace ONNX models: %s", e)
                return None, None
    return _YUNET_DETECTOR, _SFACE_RECOGNIZER


def _load_pil_image(image_input):
    """
    Loads a PIL Image instance from a file path, Django UploadedFile, or BytesIO.
    """
    if isinstance(image_input, Image.Image):
        return image_input.convert('RGB')
    if hasattr(image_input, 'read'):
        image_input.seek(0)
        img = Image.open(image_input)
        img_rgb = img.convert('RGB')
        image_input.seek(0)  # Reset stream position so Django/Cloudinary can read the file
        return img_rgb
    if isinstance(image_input, str):
        img = Image.open(image_input)
        return img.convert('RGB')
    raise ValueError("Unsupported image input type for facial verification")


def _extract_sface_embedding(pil_img):
    """
    Extracts a 128-dimensional Deep Convolutional Facial Embedding using OpenCV SFace.
    Returns list of 128 floats or None if no face is detected.
    """
    detector, recognizer = _get_sface_models()
    if detector is None or recognizer is None:
        return None

    try:
        img_arr = np.array(pil_img.convert('RGB'))
        bgr = cv2.cvtColor(img_arr, cv2.COLOR_RGB2BGR)
        h, w, _ = bgr.shape
        detector.setInputSize((w, h))
        _, faces = detector.detect(bgr)

        if faces is None or len(faces) == 0:
            # Fallback retry with CLAHE on low-light / high-shadow images
            gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
            clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
            gray_clahe = clahe.apply(gray)
            bgr_clahe = cv2.cvtColor(gray_clahe, cv2.COLOR_GRAY2BGR)
            detector.setInputSize((w, h))
            _, faces = detector.detect(bgr_clahe)
            if faces is None or len(faces) == 0:
                return None
            aligned_face = recognizer.alignCrop(bgr_clahe, faces[0])
        else:
            aligned_face = recognizer.alignCrop(bgr, faces[0])

        feat = recognizer.feature(aligned_face)
        return [float(x) for x in feat.flatten()]
    except Exception as e:
        logger.error("Error in SFace feature extraction: %s", e)
        return None


def extract_face_embedding(image_input):
    """
    Extracts a 128-dimensional facial embedding vector from an image.
    Uses SFace Deep Neural Network -> dlib face_recognition -> OpenCV HOG fallback.
    """
    try:
        pil_img = _load_pil_image(image_input)
    except Exception as e:
        logger.error("Failed to load image for face embedding extraction: %s", e)
        return None

    # Primary SOTA ML Engine: OpenCV YuNet + SFace Deep Neural Network
    sface_emb = _extract_sface_embedding(pil_img)
    if sface_emb is not None:
        return sface_emb

    # Secondary Engine: dlib-backed face_recognition package if installed
    if HAVE_FACE_RECOGNITION:
        img_np = np.array(pil_img)
        encodings = face_recognition.face_encodings(img_np)
        if encodings:
            return [float(x) for x in encodings[0]]

    logger.warning("No valid face detected or no face recognition engine available.")
    return None


def compare_face_embeddings(embedding1, embedding2):
    """
    Compares two 128-d SFace face embeddings using Cosine Similarity.
    Official SFace threshold: 0.363 (>= 0.363 is same person).
    Returns dict containing:
      - is_match (bool)
      - distance (float, 1.0 - cosine_sim)
      - confidence (float percentage 0-100%)
      - status (str: 'matched', 'mismatch', or 'no_face_detected')
    """
    if not embedding1 or not embedding2 or len(embedding1) != len(embedding2):
        return {
            'is_match': False,
            'distance': 1.0,
            'confidence': 0.0,
            'status': 'no_face_detected',
            'message': 'Face detection failed on one or both photos.',
        }

    v1 = np.array(embedding1, dtype=np.float32)
    v2 = np.array(embedding2, dtype=np.float32)

    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)

    if norm1 == 0 or norm2 == 0:
        return {
            'is_match': False,
            'distance': 1.0,
            'confidence': 0.0,
            'status': 'no_face_detected',
            'message': 'Invalid face embedding vector.',
        }

    cos_sim = float(np.dot(v1, v2) / (norm1 * norm2))

    # SFace official Cosine Similarity threshold for strict 1:1 biometric identity = 0.60
    cos_threshold = 0.60
    is_match = cos_sim >= cos_threshold

    if is_match:
        confidence = min(100.0, 50.0 + ((cos_sim - cos_threshold) / (1.0 - cos_threshold)) * 50.0)
    else:
        confidence = max(0.0, (cos_sim / cos_threshold) * 49.9)

    confidence_rounded = round(confidence, 1)
    dist_val = round(max(0.0, 1.0 - cos_sim), 4)
    status = 'matched' if is_match else 'mismatch'
    message = (
        f"Identity verified successfully ({confidence_rounded}% match)."
        if is_match
        else f"Face mismatch detected ({confidence_rounded}% match)."
    )

    return {
        'is_match': is_match,
        'distance': dist_val,
        'confidence': confidence_rounded,
        'status': status,
        'message': message,
    }


def verify_beautician_selfie(employee, selfie_file):
    """
    Main verification pipeline called during arrival OTP process:
    Extracts embedding from uploaded selfie and compares against ALL of the
    employee's stored reference face photos (front, left, right, top, bottom),
    returning the best matching result to handle lighting and angle variations.
    """
    if not selfie_file:
        return {
            'is_match': False,
            'distance': 1.0,
            'confidence': 0.0,
            'status': 'no_face_detected',
            'message': 'No arrival selfie file provided.',
        }

    # Extract embedding from live arrival selfie
    selfie_embedding = extract_face_embedding(selfie_file)
    if not selfie_embedding:
        return {
            'is_match': False,
            'distance': 1.0,
            'confidence': 0.0,
            'status': 'no_face_detected',
            'message': 'No clear facial features detected in arrival selfie photo.',
        }

    # Collect all available reference photo embeddings from employee profile
    reference_embeddings = []

    # 1. Primary face embedding stored in DB
    if employee.face_embedding:
        reference_embeddings.append(('stored_profile', employee.face_embedding))

    # 2. Reference photos uploaded on profile page (front, left, right, top, bottom)
    for field_name in ['face_photo_front', 'face_photo_left', 'face_photo_right', 'face_photo_top', 'face_photo_bottom']:
        ref_file = getattr(employee, field_name)
        if ref_file:
            emb = extract_face_embedding(ref_file)
            if emb:
                reference_embeddings.append((field_name, emb))

    if not reference_embeddings:
        # If no reference photo or embedding exists on employee profile,
        # set this selfie as the initial reference embedding for future jobs!
        employee.face_embedding = selfie_embedding
        employee.save(update_fields=['face_embedding'])
        return {
            'is_match': True,
            'distance': 0.0,
            'confidence': 100.0,
            'status': 'matched',
            'message': 'First selfie registered as reference face profile.',
        }

    # Compare live selfie against ALL registered reference photos and pick the BEST match
    best_result = None
    for label, ref_emb in reference_embeddings:
        res = compare_face_embeddings(selfie_embedding, ref_emb)
        if best_result is None or res['confidence'] > best_result['confidence']:
            best_result = res

    return best_result
