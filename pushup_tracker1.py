import cv2
import mediapipe as mp
import numpy as np
import time
from datetime import datetime

# -----------------------------
# Utility Functions
# -----------------------------
def calculate_angle(a, b, c):
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)
    radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
    angle = np.abs(radians * 180.0 / np.pi)
    if angle > 180.0:
        angle = 360 - angle
    return angle

def is_body_straight(shoulder, hip, knee):
    angle = calculate_angle(shoulder, hip, knee)
    return 160 <= angle <= 200

def landmarks_visible(landmarks, required_points, threshold=0.5):
    for point in required_points:
        if landmarks[point.value].visibility < threshold:
            return False
    return True

# -----------------------------
# MediaPipe Setup
# -----------------------------
mp_drawing = mp.solutions.drawing_utils
mp_pose = mp.solutions.pose

# -----------------------------
# Counters and Timer
# -----------------------------
counter = 0
correct_reps = 0
incorrect_reps = 0
stage = None
start_time = time.time()

# -----------------------------
# Video Capture
# -----------------------------
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("❌ Cannot open camera. Check camera index or permissions.")
    exit()

with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose:

    while True:
        ret, frame = cap.read()
        if not ret:
            print("❌ Failed to grab frame")
            break

        # Convert to RGB
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image.flags.writeable = False
        results = pose.process(image)
        image.flags.writeable = True
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

        if results.pose_landmarks:
            landmarks = results.pose_landmarks.landmark

            # Required landmarks
            required = [
                mp_pose.PoseLandmark.RIGHT_SHOULDER,
                mp_pose.PoseLandmark.RIGHT_ELBOW,
                mp_pose.PoseLandmark.RIGHT_WRIST,
                mp_pose.PoseLandmark.RIGHT_HIP,
                mp_pose.PoseLandmark.RIGHT_KNEE,
                mp_pose.PoseLandmark.RIGHT_ANKLE,
                mp_pose.PoseLandmark.NOSE
            ]

            if landmarks_visible(landmarks, required):
                # Extract positions
                shoulder = [landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x,
                            landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y]
                elbow = [landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].x,
                         landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].y]
                wrist = [landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].x,
                         landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].y]
                hip = [landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].x,
                       landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].y]
                knee = [landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].x,
                        landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].y]
                ankle = [landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].x,
                         landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].y]

                # Angles
                elbow_angle = calculate_angle(shoulder, elbow, wrist)
                body_angle = calculate_angle(shoulder, hip, knee)
                knee_angle = calculate_angle(hip, knee, ankle)

                # Good form check
                good_form = is_body_straight(shoulder, hip, knee) and knee_angle > 160

                # Stage logic
                if elbow_angle > 160 and good_form:
                    stage = "up"
                if elbow_angle < 90 and stage == "up" and good_form:
                    stage = "down"
                    counter += 1
                    correct_reps += 1
                elif elbow_angle < 90:
                    stage = "down"
                    incorrect_reps += 1

                # Draw angles
                for angle, point in [(elbow_angle, elbow), (body_angle, hip), (knee_angle, knee)]:
                    color = (0,255,0) if 90<=angle<=180 else (0,0,255)
                    cv2.putText(image, str(int(angle)),
                                tuple(np.multiply(point,[640,480]).astype(int)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2, cv2.LINE_AA)

        # UI overlay
        cv2.rectangle(image, (0,0), (350,140), (245,117,16), -1)
        cv2.putText(image, 'REPS', (15,20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,0), 1)
        cv2.putText(image, str(counter), (10,70), cv2.FONT_HERSHEY_SIMPLEX, 2, (255,255,255), 2)
        cv2.putText(image, 'STAGE', (130,20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,0), 1)
        cv2.putText(image, stage if stage else "-", (130,70), cv2.FONT_HERSHEY_SIMPLEX, 2, (255,255,255), 2)
        elapsed_time = int(time.time() - start_time)
        cv2.putText(image, f"Time: {elapsed_time//60:02d}:{elapsed_time%60:02d}", (10,110),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255), 2)

        # Draw skeleton
        if results.pose_landmarks:
            mp_drawing.draw_landmarks(
                image, results.pose_landmarks, mp_pose.POSE_CONNECTIONS,
                mp_drawing.DrawingSpec(color=(245,117,66), thickness=2, circle_radius=2),
                mp_drawing.DrawingSpec(color=(245,66,230), thickness=2, circle_radius=2)
            )

        cv2.imshow('Push-up Tracker', image)

        if cv2.waitKey(10) & 0xFF == ord('q'):
            break

# -----------------------------
# Release and report
# -----------------------------
cap.release()
cv2.destroyAllWindows()

timestamp = datetime.now().strftime("%d-%b-%Y %I:%M %p")
total_time = int(time.time() - start_time)
minutes = total_time//60
seconds = total_time%60
accuracy = (correct_reps/counter*100) if counter>0 else 0

report = [
    f"Workout Report - {timestamp}",
    "--------------------------------",
    f"Total Time: {minutes}m {seconds}s",
    f"Total Push-ups: {counter}",
    f"Correct Push-ups: {correct_reps}",
    f"Incorrect Push-ups: {incorrect_reps}",
    f"Accuracy: {accuracy:.1f}%",
    "--------------------------------\n"
]

print("\n".join(report))
with open("report.txt", "a") as f:
    f.write("\n".join(report)+"\n\n")
print("✅ Report appended to report.txt")
