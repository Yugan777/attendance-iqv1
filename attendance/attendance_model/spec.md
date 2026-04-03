# Specification: Comprehensive Teacher Management System

## 1. Overview
The goal is to implement a robust, secure, and user-friendly Teacher Management System (TMS) within the existing Flask-based attendance application. The system will empower administrators to manage teacher profiles, assign classes, and handle removals securely. It will feature role-based access control (RBAC), secure authentication, and a responsive UI.

## 2. Core Functionality

### 2.1 Teacher Addition Module
- **Interface**: Admin form to add new teachers.
- **Fields**:
  - Name (Full Name)
  - Employee ID (Unique)
  - Email (Unique, Validated)
  - Phone Number (Validated)
  - Qualifications (Text/Tags)
  - Subjects Taught (Multi-select from predefined list)
- **Security**:
  - Auto-generated strong temporary password (or admin-set).
  - Password hashing using `werkzeug.security` (scrypt/pbkdf2).
  - Credentials sent via email (simulated for now) or displayed once.

### 2.2 Teacher-Class Assignment System
- **Functionality**: Map teachers to Classes/Subjects.
- **Features**:
  - Many-to-Many relationship (Teacher <-> Class/Subject).
  - Conflict detection: Prevent assigning the same teacher to two classes at the same time (if schedule data exists).
  - Load tracking: Display number of classes assigned per teacher.

### 2.3 Teacher Removal Module
- **Process**:
  - Soft delete by default (`is_active` flag).
  - Hard delete option with confirmation.
  - Reassignment: Prompt to reassign active classes before deletion.
- **Audit**: Log the deletion action (who, when, whom).

## 3. Authentication & Security Architecture

### 3.1 Role-Based Access Control (RBAC)
- **Roles**:
  - `Admin`: Full access (Manage teachers, assignments, settings).
  - `Teacher`: Limited access (View own schedule, mark attendance, view own stats).
  - `View-Only`: (Optional future scope) Read-only access.
- **Implementation**:
  - Middleware/Decorator `@role_required('admin')`.
  - Session-based storage of user role.

### 3.2 Security Measures
- **Passwords**: Migrate from plain text (current demo) to hashed passwords.
- **Session**: Secure cookie configuration (HttpOnly, SameSite).
- **Audit Logs**: New table `audit_logs` to track `action`, `actor_id`, `target_id`, `timestamp`.

## 4. Database Schema Changes (SQLite)

### 4.1 New/Modified Tables

**`teachers` (Modified)**
- `id` (PK)
- `employee_id` (Unique, String) [NEW]
- `name` (String)
- `email` (Unique, String) [NEW]
- `phone` (String) [NEW]
- `password_hash` (String) [Replaces `password`]
- `is_active` (Boolean, Default True) [NEW]
- `role` (String, Default 'teacher') [NEW]
- `created_at` (Timestamp)

**`classes` (New)**
- `id` (PK)
- `name` (e.g., "Class 10-A")
- `subject` (e.g., "Mathematics")
- `schedule` (String/JSON, e.g., "Mon 10:00")

**`teacher_assignments` (New)**
- `id` (PK)
- `teacher_id` (FK -> teachers.id)
- `class_id` (FK -> classes.id)
- `semester` (String)

**`audit_logs` (New)**
- `id` (PK)
- `action` (String, e.g., "TEACHER_ADDED")
- `actor_id` (FK -> teachers.id or Admin ID)
- `details` (Text/JSON)
- `timestamp` (Datetime)

## 5. API Endpoints (RESTful)

### 5.1 Teacher Management
- `GET /api/admin/teachers` - List all (paginated, filtered).
- `POST /api/admin/teachers` - Create new teacher.
- `GET /api/admin/teachers/<id>` - Get details.
- `PUT /api/admin/teachers/<id>` - Update profile.
- `DELETE /api/admin/teachers/<id>` - Soft delete.

### 5.2 Assignments
- `POST /api/admin/assignments` - Assign teacher to class.
- `DELETE /api/admin/assignments/<id>` - Remove assignment.

## 6. User Interface (Templates)

- **Layout**: Extend `base.html` for consistent sidebar/header.
- **Pages**:
  - `admin_dashboard.html`: Stats overview.
  - `teacher_list.html`: Data table with actions (Edit, Delete, Assign).
  - `teacher_form.html`: Add/Edit modal or page.
  - `audit_log.html`: View system logs.

## 7. Implementation Plan

1.  **Database Migration**:
    - Create new tables.
    - Migrate existing dummy teachers to new schema with hashed passwords.
2.  **Backend Logic**:
    - Implement `TeacherService` class.
    - Implement `AuthService` (hashing, login).
    - Add validation logic (email, phone, duplicates).
3.  **API Routes**:
    - Create blueprints for `admin` routes.
4.  **Frontend**:
    - Build responsive HTML/CSS templates.
    - Add JavaScript for dynamic forms and validation.
5.  **Testing**:
    - Unit tests for validation logic.
    - Manual verification of flows.

## 8. Immediate Next Steps (Phase 1)
- [ ] Update `sqlite_db.py` to support the new schema.
- [ ] Create `utils/security.py` for password hashing.
- [ ] Implement the "Add Teacher" form and backend handler.
