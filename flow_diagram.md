# System Flow Diagrams

## 1. Student Enrollment Flow
This flow describes how a new student's face is registered into the system.

```mermaid
sequenceDiagram
    participant T as Teacher (Web Dashboard)
    participant P as Raspberry Pi (Python API)
    participant C as Camera (RTSP/USB)
    participant DB as Supabase (PostgreSQL)

    T->>T: Enter Student Details (Name, Roll No)
    T->>P: POST /api/enroll (Start Capture)
    loop Capture & Process
        P->>C: Capture Frame
        P->>P: MTCNN Detect Face
        P->>P: Check Blur & Size
        P->>P: FaceNet Generate Embedding (512-d)
    end
    P-->>T: Return Average Embedding
    T->>DB: Save Student + Embedding
    DB-->>T: Success
```

---

## 2. Attendance Detection Flow
This flow describes the automated attendance process during a class.

```mermaid
sequenceDiagram
    participant T as Teacher (Web Dashboard)
    participant P as Raspberry Pi (Python API)
    participant C as Camera (RTSP/USB)
    participant DB as Supabase (PostgreSQL)

    T->>DB: Fetch Enrolled Students for Section
    DB-->>T: List of Students + Embeddings
    T->>P: POST /api/detect (Send Student List)
    P->>C: Capture Burst of 5-10 Frames
    loop Per Frame
        P->>P: MTCNN Detect All Faces
        P->>P: FaceNet Batch Generate Embeddings
        P->>P: Cosine Similarity Matching
    end
    P-->>T: Return Recognized Student IDs
    T->>T: Update UI (Present/Absent)
    T->>DB: Bulk Save Attendance Records
    DB-->>T: Success
```

---

## 3. Connectivity Flow (Remote/Hotspot)
This flow describes how the system maintains connectivity in a remote setup.

```mermaid
graph TD
    subgraph "Local Network (Remote Site)"
        CAM[RTSP Camera] -- Ethernet -- L[Teacher Laptop]
    end

    subgraph "Tailscale Mesh Network"
        L -- "Hotspot (WiFi)" -- P[Raspberry Pi]
        L -- "Internet" -- S[Supabase/Clerk]
        P -- "Internet" -- S
    end

    subgraph "Data Path"
        CAM -- "RTSP Stream" --> L
        L -- "MediaMTX Proxy" --> P
        P -- "Recognition Results" --> L
        L -- "SQL/HTTPS" --> S
    end
```
