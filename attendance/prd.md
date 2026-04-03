📄 PRODUCT REQUIREMENT DOCUMENT (FINAL – PROTOTYPE VERSION)
Project Title

AI Classroom Attendance System (Edge Prototype)

1. Project Overview

The goal of this project is to develop a camera-based automated classroom attendance system using computer vision.

The system detects and recognizes students’ faces and automatically records attendance.

The prototype system will use:

USB camera connected to Raspberry Pi

Python Flask backend

MTCNN face detection

FaceNet embeddings

Supabase database

Teacher web dashboard

The system should complete attendance scanning within:

30–40 seconds
2. System Architecture

The prototype system architecture is:

Teacher Dashboard (Frontend)
        │
        ▼
HTTP API Request
        │
        ▼
Raspberry Pi API Server (Flask)
        │
        ▼
Face Recognition Engine
(MTCNN + FaceNet)
        │
        ▼
Supabase Database

The frontend directly communicates with the Raspberry Pi using its local IP address.

3. Connection Method (Method 1 – Direct IP API)

The system will use Direct IP API communication between the frontend and Raspberry Pi.

The Raspberry Pi runs a Flask server exposing API endpoints.

The frontend sends HTTP requests to the Raspberry Pi’s IP address.

Example:

http://RASPBERRY_PI_IP:5000/api/start-attendance

Example architecture:

Frontend (Teacher Dashboard)
        │
        ▼
HTTP Request
        │
        ▼
Raspberry Pi API Server
        │
        ▼
Face Detection Engine

Advantages:

simple architecture

minimal infrastructure

suitable for prototype demonstration

Limitation:

works only within the same local network.

4. Current Face Recognition Pipeline

The system currently uses the following pipeline:

USB Camera
      │
      ▼
Frame Capture (Raspberry Pi)
      │
      ▼
Send frame to recognition engine
      │
      ▼
Face Detection (MTCNN)
      │
      ▼
Face Cropping
      │
      ▼
Face Embedding (FaceNet)
      │
      ▼
Cosine Similarity Matching
      │
      ▼
Attendance Marking

FaceNet generates 512-dimension embeddings which are L2 normalized.

5. Backend Changes Required

The backend must be converted into an API-based service.

Remove the old HTML-based frontend.

Delete:

templates/
static/
ui.html
enroll.html
index.html

The Flask server will only expose REST API endpoints.

6. Supabase Database Integration

The system will use:

Supabase

Supabase will store:

student records

face embeddings

attendance logs

Required Database Tables
students
id (uuid)
name (text)
embedding (json/vector)
image_url (text)
created_at (timestamp)
attendance
id (uuid)
student_id (uuid)
classroom (text)
timestamp (timestamp)
status (text)
7. Raspberry Pi Camera Client

The Raspberry Pi will act as the camera capture device.

Instead of RTSP cameras, the prototype uses a USB webcam connected directly to the Pi.

Responsibilities:

capture frames from USB camera
resize frames
send frames to recognition engine
Raspberry Pi Pipeline
USB Camera
      │
      ▼
Capture frame every 2 seconds
      │
      ▼
Resize frame (640x360)
      │
      ▼
Encode frame as JPEG
      │
      ▼
Send frame to recognition API
8. Backend API Endpoints

The Raspberry Pi API server must provide the following endpoints.

Start Attendance
POST /api/start-attendance

Triggered by the teacher dashboard.

Starts the attendance scanning process.

Stop Attendance
POST /api/stop-attendance

Stops the scanning process.

Recognize Face
POST /api/recognize

Input:

image frame

Process:

MTCNN face detection
FaceNet embedding
cosine similarity matching

Output:

recognized student names
Enroll Student
POST /api/enroll

Input:

student name
face image

Process:

detect face
generate embedding
store embedding in Supabase
Get Attendance Records
GET /api/attendance

Returns the list of students marked present.

9. Recognition Logic

The recognition engine must follow these rules.

Cosine Similarity Threshold
similarity > 0.6  → known student
similarity ≤ 0.6  → unknown
Face Size Filtering

Ignore very small faces:

if face_width < 60px:
    ignore

Small faces produce inaccurate embeddings.

Duplicate Attendance Prevention

Ensure each student is marked present only once.

if student already marked present:
    skip
10. Frame Optimization

To reduce computation load:

Resize frames
cv2.resize(frame,(640,360))
Frame sampling

Process frames every:

2–3 seconds
11. Teacher Web Dashboard

A web dashboard will allow teachers to control attendance.

Frontend technology stack:

Node.js
React
Next.js

Deployment platform:

Vercel

Teacher Dashboard Features
Start Attendance
Start Attendance

Triggers attendance scanning.

Stop Attendance
Stop Attendance

Stops scanning.

View Attendance Results

Displays recognized students.

Admin Panel

Admin capabilities:

Add Student
Upload Student Image
View Students
View Attendance Logs
12. Camera Setup (Prototype Version)

For the prototype system:

USB webcam connected to Raspberry Pi
camera resolution: 1280x720
processing resolution: 640x360

This simplifies setup for development and demonstrations.

Future versions will support RTSP IP cameras.

13. Known Issues
Small Faces

Faces smaller than 80px reduce recognition accuracy.

Mitigation:

ignore faces < 60px
False Recognition

Cause:

low similarity threshold

Solution:

threshold = 0.6
MTCNN Performance

MTCNN may become slower with many faces.

Planned future improvement:

SCRFD face detector
ArcFace embeddings
14. Future Improvements (Phase 2)

Planned architecture upgrade:

SCRFD face detection
ArcFace recognition
FAISS vector similarity search
Oracle Cloud inference server
RTSP IP cameras

These improvements will increase:

speed
accuracy
scalability
15. Expected Performance

Prototype performance estimate:

≈ 10 frames captured
≈ 20–30 faces per frame
≈ 30 seconds total attendance time
16. Success Criteria

The system is considered successful if:

attendance completes within 30–40 seconds
recognition accuracy > 85%
attendance logs stored in Supabase
teacher dashboard successfully triggers Raspberry Pi engine
17. Deliverables

The final prototype must include:

Python Flask backend API
Supabase database integration
Raspberry Pi camera client
Teacher web dashboard
Face recognition pipeline