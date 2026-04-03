# Tasks

## Phase 1: Database & Security Foundation
- [ ] Create `utils/security.py` with `hash_password` and `check_password` functions. <!-- id: 0 -->
- [ ] Update `sqlite_db.py` `init_db()` to create new tables: `audit_logs`, `classes`, `teacher_assignments`. <!-- id: 1 -->
- [ ] Modify `teachers` table schema (add `email`, `phone`, `employee_id`, `is_active`, `role`) - *Note: SQLite requires migration logic or recreation*. <!-- id: 2 -->
- [ ] Create a migration script `migrate_db.py` to preserve existing data while updating schema. <!-- id: 3 -->

## Phase 2: Backend Logic & API
- [ ] Implement `TeacherService` in `services/teacher_service.py`: <!-- id: 4 -->
    - [ ] `create_teacher(data)`
    - [ ] `update_teacher(id, data)`
    - [ ] `soft_delete_teacher(id)`
    - [ ] `get_all_teachers(filters)`
- [ ] Implement `ValidationService` in `services/validation_service.py` (Email regex, Phone check). <!-- id: 5 -->
- [ ] Create Admin API Blueprint in `routes/admin_routes.py`. <!-- id: 6 -->
- [ ] Implement `POST /admin/teachers/add` endpoint. <!-- id: 7 -->
- [ ] Implement `POST /admin/teachers/delete` endpoint. <!-- id: 8 -->

## Phase 3: Frontend Implementation
- [ ] Create `templates/layouts/admin_base.html` (Sidebar, Navbar). <!-- id: 9 -->
- [ ] Create `templates/admin/dashboard.html` (Stats). <!-- id: 10 -->
- [ ] Create `templates/admin/teachers_list.html` (Table, Search, Filter). <!-- id: 11 -->
- [ ] Create `templates/admin/teacher_form.html` (Add/Edit). <!-- id: 12 -->
- [ ] Integrate "SweetAlert2" or similar for confirmation dialogs. <!-- id: 13 -->

## Phase 4: Assignments & Audit
- [ ] Implement Class/Subject management UI. <!-- id: 14 -->
- [ ] Build Assignment interface (Assign Teacher -> Class). <!-- id: 15 -->
- [ ] Implement Audit Logging in all modification functions. <!-- id: 16 -->

## Phase 5: Testing & Refinement
- [ ] Run manual tests on Teacher Add/Delete flows. <!-- id: 17 -->
- [ ] Verify validation error messages. <!-- id: 18 -->
- [ ] Check mobile responsiveness. <!-- id: 19 -->

## Phase 6: Cloud Backend & APIs (README_PI)
- [x] Step 2.1: Verify detection/embedding helpers are exposed (`detect_faces`, `get_embedding`, DB helpers). <!-- id: 20 -->
- [x] Step 2.2: Implement `POST /cloud/recognize_frame` in `app.py` using existing model logic (MTCNN + FaceNet + SQLite). <!-- id: 21 -->
- [x] Step 2.3: Implement `POST /cloud/scan/start` and `GET /cloud/scan/status` in `app.py` to manage scan sessions. <!-- id: 22 -->
- [x] Step 2.4: Implement `GET /cloud/attendance` to return per-scan attendance list for a given `class_id` and `scan_id`. <!-- id: 23 -->
- [x] Step 4.1: Add `X-PI-KEY` API key check decorator for all `/cloud/*` Pi endpoints. <!-- id: 24 -->

## Phase 7: Pi Client & Simulator (README_PI)
- [x] Step 5.1: Create `pi_simulator.py` that reads frames from webcam/video and calls `/cloud/recognize_frame`. <!-- id: 25 -->
- [x] Step 5.2: Add `pi_config.json` (or `.env`) with `SOURCE_TYPE`, `VIDEO_PATH/IMAGE_FOLDER`, `CLOUD_API_BASE_URL`, `PI_API_KEY`, `CLASSROOM_ID`. <!-- id: 26 -->
- [x] Step 5.3: Implement scan loop in `pi_simulator.py`: poll `/cloud/scan/status`, send frames during active window, stop after timeout. <!-- id: 27 -->

## Phase 8: Cloud Deployment & React Frontend (README_PI)
- [ ] Step 3: Write a `Dockerfile` or deployment script for running Flask + Gunicorn + Nginx on a VPS. <!-- id: 28 -->
- [ ] Step 7.1: Scaffold React frontend (Vite) with pages: Login, Dashboard, ClassScanPage, AttendanceView, EnrollPage. <!-- id: 29 -->
- [ ] Step 7.2: Wire React API client to `/cloud/*` endpoints via `API_BASE_URL` environment variable. <!-- id: 30 -->
