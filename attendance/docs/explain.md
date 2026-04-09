# AttendanceIQ — Complete Codebase Explanation

> **AI-powered classroom attendance system** using Raspberry Pi face recognition + a cloud-backed web dashboard.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Directory Structure](#3-directory-structure)
4. [Pi Backend — `attendance_model/`](#4-pi-backend--attendance_model)
   - [app.py — Main Flask API](#41-apppy--main-flask-api)
   - [config.py — Global Constants](#42-configpy--global-constants)
   - [camera/ — Camera Utilities](#43-camera--camera-utilities)
   - [detection/ — Face Detection](#44-detection--face-detection)
   - [recognition/ — Face Embedding](#45-recognition--face-embedding)
   - [enrollment/ — Local Enrollment Script](#46-enrollment--local-enrollment-script)
5. [Frontend — `frontend/`](#5-frontend--frontend)
   - [shared/schema.ts — Database Schema](#51-sharedschema-ts--database-schema)
   - [server/ — Express Backend](#52-server--express-backend)
   - [client/ — React App](#53-client--react-app)
6. [Data Flow Diagrams](#6-data-flow-diagrams)
7. [API Contracts](#7-api-contracts)
8. [Authentication & Roles](#8-authentication--roles)
9. [Key Algorithms](#9-key-algorithms)
10. [Configuration & Environment Variables](#10-configuration--environment-variables)
11. [Tech Stack Summary](#11-tech-stack-summary)

---

## 1. Project Overview

**AttendanceIQ** is a two-part system:

| Part | Where it runs | What it does |
|------|--------------|--------------|
| **Pi Backend** | Raspberry Pi (or any Linux machine with USB camera) | Captures video, detects faces, generates embeddings, compares faces against enrolled students |
| **Web Frontend** | Cloud / local server | Teacher dashboard for enrollment, attendance, timetable, reports, and admin |

The Pi has **no database** — it is purely a face-processing micro-service. All data (students, embeddings, attendance records) lives in **Supabase PostgreSQL**, managed through the frontend.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Teacher Browser                     │
│  React (Vite) + Clerk Auth + TanStack Query             │
└────────────────────┬────────────────────────────────────┘
                     │  HTTP (REST)
┌────────────────────▼────────────────────────────────────┐
│               Express Server  (Node.js)                  │
│  Routes → Storage (Drizzle ORM) → Supabase PostgreSQL   │
│  Auth: Clerk middleware                                  │
└────────────────────┬────────────────────────────────────┘
                     │  HTTP (REST)
┌────────────────────▼────────────────────────────────────┐
│          Raspberry Pi — Flask API (Python)               │
│  GET  /api/health                                        │
│  POST /api/detect  — face match against embeddings       │
│  POST /api/enroll  — process images, return embedding    │
│  Modules: MTCNN detection → FaceNet recognition          │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Directory Structure

```
attendencerobo/
└── attendance/
    ├── attendance_model/          # Raspberry Pi Python Flask API
    │   ├── app.py                 # Main Flask app (3 API endpoints)
    │   ├── config.py              # Tunable constants (thresholds, camera)
    │   ├── requirements.txt       # Python dependencies
    │   ├── camera/
    │   │   ├── camera.py          # Camera class / generator
    │   │   └── blur_filter.py     # Laplacian blur detection
    │   ├── detection/
    │   │   └── mtcnn_detector.py  # MTCNN face bounding-box detector
    │   ├── recognition/
    │   │   └── facenet_model.py   # FaceNet 512-d embedding extractor
    │   ├── enrollment/
    │   │   └── enroll.py          # Standalone CLI enrollment script
    │   └── database/
    │       └── __init__.py        # (Stub — no DB on Pi)
    │
    └── frontend/                  # Node.js + React web app
        ├── server/
        │   ├── index.ts           # Express entry point
        │   ├── routes.ts          # All REST API routes
        │   ├── storage.ts         # Drizzle ORM data-access layer
        │   ├── db.ts              # PostgreSQL connection
        │   └── seed.ts            # Timetable seeder
        ├── shared/
        │   └── schema.ts          # Shared DB schema + Zod validators
        └── client/src/
            ├── App.tsx            # Root component + routing + auth gate
            ├── pages/
            │   ├── attendance.tsx    # Mark attendance with Pi integration
            │   ├── enrollment.tsx    # Enroll students via Pi camera
            │   ├── timetable.tsx     # Weekly timetable CRUD
            │   ├── reports.tsx       # Defaulter detection + analytics
            │   ├── admin.tsx         # Admin user management
            │   ├── onboarding.tsx    # First-time teacher setup
            │   └── pending-approval.tsx
            ├── components/
            │   └── layout.tsx        # Sidebar navigation
            └── hooks/ lib/           # React Query, theme, utilities
```

---

## 4. Pi Backend — `attendance_model/`

### 4.1 `app.py` — Main Flask API

The heart of the Raspberry Pi service. It is a lightweight Flask app with three endpoints. CORS is enabled so the browser-hosted frontend can call it directly.

#### Helper Functions

| Function | Purpose |
|----------|---------|
| `decode_image(base64_str)` | Converts a base64-encoded image string (from the browser) into an OpenCV `numpy` array for processing |
| `clahe_enhance(frame)` | Applies **CLAHE** (Contrast Limited Adaptive Histogram Equalization) in YCrCb colour space to improve face detection in poor lighting |
| `capture_frames(num_frames, interval)` | Opens the USB camera, discards 5 warm-up frames, then captures `num_frames` frames with `interval` seconds between them |
| `preprocess_face(face)` | Resizes a face crop to `160×160` and converts BGR → RGB; prepares it for FaceNet input |

#### Endpoint: `GET /api/health`
Returns `{"status": "ok", "service": "attendance-pi", "timestamp": <unix>}`.  
Used by the frontend to check Pi connectivity before starting detection.

#### Endpoint: `POST /api/detect`

**Request body:**
```json
{
  "section": "10-A",
  "students": [
    { "id": "uuid", "rollNumber": "01", "name": "Aarav", "embedding": [0.1, 0.2, ...] }
  ]
}
```

**What it does (step-by-step):**
1. Validates that at least one student has a 512-dimensional `embedding`.
2. Builds a **normalized embedding matrix** from all student embeddings.
3. Calls `capture_frames(5, 0.2)` — captures 5 frames from the USB camera.
4. For each frame:
   - Resizes to 640×360 and applies CLAHE.
   - Calls `detect_faces()` to get bounding boxes.
   - Skips faces smaller than `MIN_FACE_SIZE` (60 px).
   - Crops & preprocesses each valid face.
5. Runs **batch FaceNet inference** on all collected faces at once.
6. For each face embedding, computes **cosine similarity** against all student embeddings.
7. If best similarity > `COSINE_THRESHOLD` (0.6), the student is marked detected (keeping their highest confidence score across all frames).

**Response:**
```json
{
  "detected": [{ "studentId": "uuid", "confidence": 0.87 }],
  "frameCount": 5,
  "faceCount": 12
}
```

#### Endpoint: `POST /api/enroll`

**Request body:**
```json
{
  "studentId": "uuid",
  "images": ["base64img1", "base64img2", ...]
}
```

**What it does (step-by-step):**
1. Decodes each base64 image.
2. Applies CLAHE, then MTCNN detection.
3. Selects the **largest** detected face bounding box.
4. Checks that the face is not too small (`< MIN_FACE_SIZE`) and not blurry (`blur_variance < BLUR_THRESHOLD`).
5. Generates FaceNet embeddings for all accepted faces (`get_embeddings_batch`).
6. **L2-normalizes** each embedding, then averages them, then L2-normalizes the average.
7. Returns the final 512-d embedding — the frontend stores this in Supabase.

**Response:**
```json
{
  "status": "success",
  "studentId": "uuid",
  "embedding": [0.1, 0.2, ...],
  "imagesProcessed": 8,
  "imagesTotal": 10
}
```

---

### 4.2 `config.py` — Global Constants

| Constant | Value | Meaning |
|----------|-------|---------|
| `COSINE_THRESHOLD` | `0.6` | Minimum cosine similarity to call a face "recognized" |
| `MIN_FACE_SIZE` | `60` | Minimum face bounding box width/height in pixels |
| `FRAME_WIDTH` | `640` | Processing resolution width |
| `FRAME_HEIGHT` | `360` | Processing resolution height |
| `MIN_DETECTION_CONF` | `0.85` | MTCNN minimum detection confidence |
| `BLUR_THRESHOLD` | `20` (env) | Laplacian variance below this → frame discarded |
| `CAMERA_INDEX` | `0` (env) | OpenCV camera device index |
| `CAMERA_CAPTURE_WIDTH/HEIGHT` | `1280×720` | Camera capture resolution |

---

### 4.3 `camera/` — Camera Utilities

#### `camera.py`
Defines a `Camera` class wrapping `cv2.VideoCapture`. A `frames(index)` generator yields frames indefinitely until the camera closes or a frame fails to read.

#### `blur_filter.py`
Three functions for sharpness checking:

| Function | What it does |
|----------|-------------|
| `blur_variance(frame)` | Converts to grayscale, applies CLAHE, runs Laplacian, returns variance. Higher = sharper. |
| `is_blurry(frame, threshold=25)` | Returns `True` if variance < threshold |
| `filter_sharp_frames(frames)` | Filters a list of frames, keeping only sharp ones |

---

### 4.4 `detection/` — Face Detection

#### `mtcnn_detector.py`
Uses the **MTCNN** (Multi-task Cascaded Convolutional Networks) library for robust face detection.

- Initializes a single global `_detector = MTCNN()` at import time (avoids re-loading on every request).
- `detect_faces(frame, min_conf=0.9)`:
  - Converts BGR → RGB.
  - Runs `_detector.detect_faces(rgb)`.
  - Filters results by `confidence >= min_conf`.
  - Returns a list of `(x, y, w, h)` bounding boxes.

**Why MTCNN?** It detects faces even at various angles, scales, and lighting conditions — better than Haar cascades for real classrooms.

---

### 4.5 `recognition/` — Face Embedding

#### `facenet_model.py`
Uses **keras-facenet** (a Keras wrapper around the FaceNet model) to produce 512-dimensional face embeddings.

- Initializes a single global `_facenet = FaceNet()` at import time.
- `get_embeddings_batch(faces)`:
  - Accepts a list of BGR face images.
  - Resizes each to 160×160, converts BGR → RGB.
  - Runs `_facenet.embeddings(processed)` — **batch inference** (much faster than one-by-one).
  - L2-normalizes all embeddings.
  - Returns numpy array of shape `(N, 512)`.
- `get_embedding(face_image)`: Single-face wrapper that calls the batch function.

**Why FaceNet?** It produces compact, accurate 512-d embeddings where cosine similarity directly measures face similarity.

---

### 4.6 `enrollment/` — Local Enrollment Script

#### `enroll.py`
A **standalone CLI script** (not used by the Flask API). Originally used for testing enrollment directly on the Pi without the web frontend.

- Opens the camera live.
- Collects 20 non-blurry frames with detected faces.
- Generates an averaged L2-normalized embedding.
- Saves it to a SQLite database via `database.sqlite_db.save_student`.

> **Note:** In production, enrollment is done via the web frontend's `/api/enroll` endpoint, not this script.

---

## 5. Frontend — `frontend/`

### 5.1 `shared/schema.ts` — Database Schema

Defines the **PostgreSQL database schema** using **Drizzle ORM** with Zod validation.

#### Tables

**`students`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | `varchar` PK | Auto-generated UUID |
| `name` | `text` | Student full name |
| `rollNumber` | `text` | Roll number within section |
| `section` | `text` | Class section (e.g. "10-A") |
| `enrolled` | `boolean` | True when face embedding exists |
| `imageUrl` | `text` | Optional profile photo URL |
| `embedding` | `json` (number[]) | 512-d FaceNet embedding from Pi |
| `createdAt` | `timestamp` | Auto-set on creation |

Unique constraint: `(rollNumber, section)` pair must be unique.

**`attendanceRecords`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | `varchar` PK | UUID |
| `studentId` | `varchar` FK → students | |
| `teacherId` | `text` | Clerk user ID of teacher |
| `date` | `text` | Date string (YYYY-MM-DD) |
| `period` | `integer` | Period number (1–8) |
| `status` | enum | `present` / `absent` / `late` |

**`timetableSlots`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | `varchar` PK | UUID |
| `teacherId` | `text` | Clerk user ID |
| `dayOfWeek` | `integer` | 0 = Monday … 6 = Sunday |
| `period` | `integer` | Period number |
| `subject` | `text` | Subject name |
| `section` | `text` | Class section |
| `room` | `text` | Room number |
| `startTime/endTime` | `text` | Time strings |

**`attendanceStatusEnum`**: PostgreSQL enum with values `present`, `absent`, `late`.

---

### 5.2 `server/` — Express Backend

#### `index.ts`
Entry point. Creates an Express app, applies middleware, registers all routes from `routes.ts`, and starts the HTTP server.

#### `db.ts`
Creates a Drizzle ORM instance connected to Supabase PostgreSQL via the `DATABASE_URL` environment variable.

#### `storage.ts`
Implements `DatabaseStorage`, the **data-access layer** (implements the `IStorage` interface). All database queries go through this class, not through raw SQL elsewhere (except for the defaulters report and the section-delete cascade which use `db.execute` with raw SQL).

Key methods:

| Method | What it does |
|--------|-------------|
| `getStudentsWithEmbeddings(section)` | Returns only enrolled students (those who have a face embedding) for a given section — these get sent to the Pi for detection |
| `updateStudentEmbedding(id, embedding)` | Stores the 512-d embedding returned by Pi enrollment; also sets `enrolled = true` |
| `upsertAttendance(record)` | Creates or updates an attendance record for (student, date, period) — prevents duplicate marking |
| `bulkUpsertAttendance(records)` | Loops `upsertAttendance` for all records (from Pi bulk detection result) |
| `getDefaulters(threshold)` | Raw SQL query joining students + attendance; returns students whose attendance % < threshold |
| `deleteStudentsBySection(section)` | Cascades: deletes attendance records first, then students |

#### `routes.ts`
Registers all Express REST routes. **Clerk middleware** protects all routes. Key design decisions:

- **`/api/students/enrolled`** is registered *before* `/api/students/:id` to prevent "enrolled" being treated as an `:id` param.
- **Timetable authorization:** when a teacher marks attendance, the system checks that they have a timetable slot matching the date + period + subject. Teachers can only mark attendance for their own assigned classes.
- **Admin check:** performed on-demand via Clerk user metadata (looks for `role: "admin"` or email in whitelist `ADMIN_EMAILS`).
- New teachers go through **onboarding** → set to `pending` → admin approves → `approved`.

#### `seed.ts`
Helper to auto-populate an initial timetable for a new teacher on first login.

---

### 5.3 `client/` — React App

#### `App.tsx` — Root + Auth Gate

The app is wrapped in:
- `ThemeProvider` — light/dark mode
- `QueryClientProvider` — TanStack React Query for server state
- Clerk auth: shows `SignInPage` when signed out, `AuthenticatedRouter` when signed in

**`AuthGate` component** enforces the approval flow:
```
User signed in → has subject (onboarding done)?
  No  → show OnboardingPage
  Yes → status?
    pending  → PendingApprovalPage
    rejected → Access Denied screen
    approved → render app
```

#### Pages

| Page | Route | Description |
|------|-------|-------------|
| `timetable.tsx` | `/` | Weekly timetable view. Teachers manage their schedule. Auto-seeded on first login. |
| `attendance.tsx` | `/attendance` | Main attendance page. Teacher selects section + period → frontend fetches enrolled students → sends them to Pi `/api/detect` → Pi returns detected IDs → frontend marks attendance in bulk. Shows real-time status updates during Pi processing. |
| `enrollment.tsx` | `/enrollment` | Add students to a section, then enroll them via Pi camera. The browser captures 10 images from user's webcam, sends them to Pi `/api/enroll`, receives 512-d embedding, and stores it in Supabase via `/api/students/:id/embedding`. |
| `reports.tsx` | `/reports` | Shows students below a configurable attendance threshold (defaulters). |
| `admin.tsx` | `/admin` | Admin panel: approve/reject pending teachers, view all users, change user roles. |
| `onboarding.tsx` | N/A | First-time setup: teacher enters their name + subject. Sets `status: pending`. |
| `pending-approval.tsx` | N/A | Waiting screen shown while admin has not yet approved the teacher. |

---

## 6. Data Flow Diagrams

### Enrollment Flow

```
Teacher Browser                   Express Server          Raspberry Pi          Supabase DB
─────────────────────────────────────────────────────────────────────────────────────────
1. Create student record  ──────► POST /api/students ──────────────────────► INSERT INTO students
                          ◄──────  {id, name, ...}
2. Open webcam, capture 10 images
3. Send to Pi            ──────────────────────────────► POST /api/enroll
   (base64 images)                                       - Decode images
                                                         - MTCNN detect faces
                                                         - FaceNet embed
                                                         - Average + L2 norm
                         ◄──────────────────────────────  {embedding: [512 floats]}
4. Store embedding       ──────► PATCH /api/students/:id/embedding ────────► UPDATE students
                         ◄──────  {enrolled: true, embedding: [...]}
```

### Attendance Flow

```
Teacher Browser                   Express Server          Raspberry Pi          Supabase DB
─────────────────────────────────────────────────────────────────────────────────────────
1. Select section+period
2. Fetch enrolled students ────► GET /api/students/enrolled?section=X ─────► SELECT WHERE enrolled=true
                           ◄────  [ {id, embedding: [512]}, ... ]
3. Send to Pi for detection ────────────────────────────► POST /api/detect
                                                          - capture_frames(5)
                                                          - MTCNN detect
                                                          - FaceNet embed (batch)
                                                          - Cosine similarity match
                            ◄────────────────────────────  {detected: [{studentId, confidence}]}
4. Bulk mark attendance    ────► POST /api/attendance/bulk ─────────────────► UPSERT attendance_records
                           ◄────  [{id, status: "present"/"absent"}, ...]
```

---

## 7. API Contracts

### Pi API (Flask — port 5000)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `GET` | `/api/health` | None | Connectivity check |
| `POST` | `/api/detect` | None | Detect faces, match to students |
| `POST` | `/api/enroll` | None | Process images, return embedding |

### Frontend API (Express — port 5000/3000)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `GET` | `/api/students` | Clerk | List all / filter by section |
| `GET` | `/api/students/enrolled` | Clerk | Enrolled students with embeddings for a section |
| `GET` | `/api/students/:id` | Clerk | Single student |
| `POST` | `/api/students` | Clerk | Create student (upserts on duplicate roll+section) |
| `PATCH` | `/api/students/:id/enrollment` | Clerk | Toggle enrolled status |
| `PATCH` | `/api/students/:id/embedding` | Clerk | Save embedding from Pi |
| `DELETE` | `/api/students/section/:section` | Clerk (admin) | Delete all students in section |
| `GET` | `/api/attendance` | Clerk | Get records for date+period |
| `POST` | `/api/attendance` | Clerk | Mark single attendance |
| `POST` | `/api/attendance/bulk` | Clerk | Mark multiple at once |
| `GET` | `/api/timetable` | Clerk | Teacher's timetable (auto-seeds if empty) |
| `POST/PUT/DELETE` | `/api/timetable[/:id]` | Clerk | CRUD timetable slots |
| `GET` | `/api/reports/defaulters` | Clerk | Students below attendance threshold |
| `POST` | `/api/onboarding` | Clerk | Complete teacher onboarding |
| `GET` | `/api/admin/pending-users` | Clerk (admin) | Pending approval list |
| `POST` | `/api/admin/approve-user` | Clerk (admin) | Approve a teacher |
| `POST` | `/api/admin/reject-user` | Clerk (admin) | Reject a teacher |
| `GET` | `/api/admin/all-users` | Clerk (admin) | All approved users |
| `POST` | `/api/admin/update-role` | Clerk (admin) | Change user role |

---

## 8. Authentication & Roles

Authentication is handled by **Clerk** (third-party auth service).

| Role | Permissions |
|------|------------|
| `admin` | Full access; approve/reject teachers; manage all users; delete sections |
| `teacher` | Mark attendance for their own timetable slots only; manage students; view reports |
| `viewer` | Read-only (future use) |

**Admin detection:** A user is admin if `publicMetadata.role === "admin"` OR their email is in `ADMIN_EMAILS` (hardcoded whitelist in `routes.ts`). On first admin login, the role is auto-set in Clerk metadata.

**Onboarding flow:**
1. Teacher signs up via Clerk.
2. `AuthGate` detects no `subject` in metadata → redirects to `OnboardingPage`.
3. Teacher submits name + subject → `POST /api/onboarding` sets `status: pending`.
4. Admin approves → `status: approved`.
5. Teacher gets full access.

---

## 9. Key Algorithms

### Face Detection — MTCNN
Multi-task Cascaded Convolutional Networks. Three stages:
1. **P-Net** (Proposal Net) — generates candidate windows fast.
2. **R-Net** (Refine Net) — filters candidates.
3. **O-Net** (Output Net) — output bounding boxes + 5 landmarks.

Returns `(x, y, w, h)` boxes with confidence scores. Any result below `MIN_DETECTION_CONF` (0.85) is discarded.

### Face Recognition — FaceNet
FaceNet maps a face image to a **512-dimensional embedding vector** in a space where:
- Same person → embeddings are close (high cosine similarity)
- Different people → embeddings are far apart

**L2 normalization** ensures all embedding vectors have unit length, so cosine similarity simplifies to a dot product:

```
similarity = embedding_A · embedding_B
```

### Enrollment Averaging
When enrolling with N images:
1. Generate embedding for each accepted face.
2. L2-normalize each embedding.
3. Compute the mean vector.
4. L2-normalize the mean again.

This produces a **robust average representation** that handles minor pose/lighting variation.

### Attendance Matching (Cosine Similarity Matrix)
```python
# Pre-normalize all student embeddings into a matrix
normalized_emb = emb_matrix / norms   # shape: (S, 512)

# For each detected face embedding:
emb_norm = emb / norm                 # shape: (512,)
sims = normalized_emb @ emb_norm      # shape: (S,) — all similarities at once

best_idx = argmax(sims)
if sims[best_idx] > COSINE_THRESHOLD:
    mark student_ids[best_idx] as present
```

This computes all student similarities in **one matrix multiplication** — O(S) instead of a loop.

### Blur Detection — Laplacian Variance
The **Laplacian** of an image measures the second derivative (edge strength). Sharp images have high edge variance; blurry images have low variance:

```python
variance = cv2.Laplacian(gray, cv2.CV_64F).var()
# < 20 → blurry, discard
# ≥ 20 → sharp, keep
```

CLAHE is applied first to prevent low-light images from being falsely discarded.

---

## 10. Configuration & Environment Variables

### Pi Backend (`attendance_model/`)
| Variable | Default | Description |
|----------|---------|-------------|
| `CAMERA_INDEX` | `0` | OpenCV USB camera index |
| `BLUR_THRESHOLD` | `20` | Laplacian variance threshold |
| `APP_HOST` | `0.0.0.0` | Flask bind host |
| `APP_PORT` | `5000` | Flask port |

### Frontend (`frontend/.env`)
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk frontend key |
| `CLERK_SECRET_KEY` | Clerk backend key |
| `VITE_PI_URL` | URL of the Raspberry Pi Flask API (e.g. `http://192.168.1.100:5000`) |

---

## 11. Tech Stack Summary

### Raspberry Pi Backend
| Technology | Purpose |
|------------|---------|
| Python 3.11 | Runtime |
| Flask + Flask-CORS | REST API framework |
| OpenCV (`cv2`) | Camera capture, image processing |
| MTCNN | Face detection |
| keras-facenet | FaceNet face embeddings |
| NumPy | Array math, cosine similarity |

### Web Frontend
| Technology | Purpose |
|------------|---------|
| TypeScript | Language |
| React 18 + Vite | Frontend framework + build tool |
| Wouter | Client-side routing |
| TanStack React Query | Server state management |
| Tailwind CSS | Styling |
| shadcn/ui | UI component library |
| Clerk | Authentication + user management |
| Express.js | Backend API server |
| Drizzle ORM | Type-safe database queries |
| Zod | Schema validation |
| Supabase | PostgreSQL cloud database |

---

*Generated: 2026-03-13 | AttendanceIQ project documentation*
