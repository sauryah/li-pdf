import math
from typing import Optional, Tuple, Dict, Any, List
import cv2
import numpy as np
from PIL import Image
from ..specs.models import FaceLandmarksData
from ..utils.image_io import pil_to_cv2

try:
    import mediapipe as mp
    # Initialize mediapipe face mesh & face detector
    mp_face_mesh = mp.solutions.face_mesh
    mp_face_detection = mp.solutions.face_detection
    MEDIAPIPE_AVAILABLE = True
except Exception as e:
    MEDIAPIPE_AVAILABLE = False


class FaceDetector:
    def __init__(self):
        self._face_mesh = None
        self._face_detector = None
        if MEDIAPIPE_AVAILABLE:
            try:
                self._face_mesh = mp_face_mesh.FaceMesh(
                    static_image_mode=True,
                    max_num_faces=4,
                    refine_landmarks=True,
                    min_detection_confidence=0.5
                )
                self._face_detector = mp_face_detection.FaceDetection(
                    model_selection=1, # 1 for full range (portraits)
                    min_detection_confidence=0.5
                )
            except Exception:
                pass

        # Load OpenCV Haar cascade as fallback if available
        self._haar_cascade = None
        try:
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            cascade = cv2.CascadeClassifier(cascade_path)
            if not cascade.empty():
                self._haar_cascade = cascade
        except Exception:
            self._haar_cascade = None

    def detect_landmarks(self, image: Image.Image) -> FaceLandmarksData:
        """
        Detect face, compute eye tilt, top-of-head (crown), and chin.
        """
        np_img = np.array(image.convert("RGB"))
        h, w, _ = np_img.shape

        if MEDIAPIPE_AVAILABLE and self._face_mesh is not None:
            try:
                results = self._face_mesh.process(np_img)
                if results.multi_face_landmarks and len(results.multi_face_landmarks) > 0:
                    face_count = len(results.multi_face_landmarks)
                    primary_landmarks = results.multi_face_landmarks[0].landmark

                    # Extract key landmark indices (MediaPipe Face Mesh canonical indices)
                    # Chin: 152
                    # Forehead top: 10
                    # Left eye center: 468 (or 33/133 average)
                    # Right eye center: 473 (or 362/263 average)
                    # Nose tip: 1
                    
                    chin_lm = primary_landmarks[152]
                    forehead_lm = primary_landmarks[10]
                    nose_lm = primary_landmarks[1]

                    # Pupil or eye corners
                    # MediaPipe refined landmarks: 468 = left iris, 473 = right iris
                    if len(primary_landmarks) > 473:
                        left_eye_lm = primary_landmarks[468]
                        right_eye_lm = primary_landmarks[473]
                    else:
                        # Fallback to corner averages
                        left_eye_lm = primary_landmarks[33]
                        right_eye_lm = primary_landmarks[263]

                    chin_x, chin_y = chin_lm.x, chin_lm.y
                    forehead_x, forehead_y = forehead_lm.x, forehead_lm.y
                    left_eye_x, left_eye_y = left_eye_lm.x, left_eye_lm.y
                    right_eye_x, right_eye_y = right_eye_lm.x, right_eye_lm.y
                    nose_x, nose_y = nose_lm.x, nose_lm.y

                    # Calculate tilt angle between eyes (in degrees)
                    dx = (right_eye_x - left_eye_x) * w
                    dy = (right_eye_y - left_eye_y) * h
                    tilt_angle = math.degrees(math.atan2(dy, dx))

                    # Estimate crown (top of head / hair). 
                    # Forehead to chin distance:
                    face_h = abs(chin_y - forehead_y)
                    # Crown is approximately 0.45 * face_h above forehead
                    crown_y = max(0.0, forehead_y - (face_h * 0.45))
                    crown_x = (forehead_x + chin_x) / 2.0

                    # Compute overall bounding box
                    all_x = [lm.x for lm in primary_landmarks]
                    all_y = [lm.y for lm in primary_landmarks]
                    x_min = max(0.0, min(all_x))
                    x_max = min(1.0, max(all_x))
                    y_min = max(0.0, crown_y)
                    y_max = min(1.0, max(all_y))

                    return FaceLandmarksData(
                        has_face=True,
                        face_count=face_count,
                        bounding_box=[x_min, y_min, x_max, y_max],
                        chin_point=[chin_x, chin_y],
                        crown_point=[crown_x, crown_y],
                        left_eye=[left_eye_x, left_eye_y],
                        right_eye=[right_eye_x, right_eye_y],
                        nose_tip=[nose_x, nose_y],
                        tilt_angle_deg=round(tilt_angle, 2)
                    )
            except Exception as e:
                pass

        # Fallback to Haar Cascades if MediaPipe is unavailable or fails
        if self._haar_cascade is not None:
            gray = cv2.cvtColor(np_img, cv2.COLOR_RGB2GRAY)
            try:
                faces = self._haar_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
                if len(faces) > 0:
                    face_count = len(faces)
                    fx, fy, fw, fh = max(faces, key=lambda f: f[2] * f[3])
                    x_min = fx / w
                    y_min = max(0.0, (fy - 0.3 * fh) / h)  # estimate crown
                    x_max = (fx + fw) / w
                    y_max = min(1.0, (fy + fh) / h)       # chin

                    chin_x, chin_y = (fx + fw / 2) / w, y_max
                    crown_x, crown_y = (fx + fw / 2) / w, y_min
                    left_eye = [(fx + 0.3 * fw) / w, (fy + 0.35 * fh) / h]
                    right_eye = [(fx + 0.7 * fw) / w, (fy + 0.35 * fh) / h]
                    nose = [(fx + 0.5 * fw) / w, (fy + 0.55 * fh) / h]

                    return FaceLandmarksData(
                        has_face=True,
                        face_count=face_count,
                        bounding_box=[x_min, y_min, x_max, y_max],
                        chin_point=[chin_x, chin_y],
                        crown_point=[crown_x, crown_y],
                        left_eye=left_eye,
                        right_eye=right_eye,
                        nose_tip=nose,
                        tilt_angle_deg=0.0
                    )
            except Exception:
                pass

        # If synthetic / no detector matches, provide center heuristic if image is portrait
        return FaceLandmarksData(
            has_face=False,
            face_count=0,
            tilt_angle_deg=0.0
        )


detector_instance = FaceDetector()

def get_face_detector() -> FaceDetector:
    return detector_instance
