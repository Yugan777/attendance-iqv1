# AttendanceIQ — Smart Attendance Management System

## Overview
Professional attendance dashboard for schools with AI-powered face recognition via Raspberry Pi integration. Built with React 18, Express, PostgreSQL, Clerk Auth, and Shadcn UI.

## Architecture
- **Frontend**: React 18 + Vite + Tailwind CSS + Shadcn UI + Clerk React SDK
- **Backend**: Express.js + Clerk Express SDK + PostgreSQL (Drizzle ORM)
- **Auth**: Clerk (signup → onboarding → admin approval → dashboard access)
- **AI Integration**: Raspberry Pi API at configurable IP for face enrollment/detection

## Key Features
1. **Clerk Auth Flow**: Signup → Name + Subject selection → Admin approval → Dashboard
2. **Timetable Grid**: 5x8 grid (Mon-Fri, 8 periods) with active session highlighting
3. **Attendance UI**: Student cards with 3-state toggles (Present/Absent/Late)
4. **Subject-Based Security**: Teachers can only mark attendance for their own subject — enforced on frontend (timetable clickability, section filtering) and backend (server-side validation)
5. **Face Enrollment**: 10-photo burst capture via webcam → Pi API
6. **Auto-Capture**: MTCNN face detection via Pi for automatic attendance
7. **Reports**: Defaulter list (<75% attendance) with PDF download
8. **Admin Panel**: Approve/reject pending teacher registrations

## Data Model
- `students`: id, name, rollNumber, section, enrolled, imageUrl
- `attendance_records`: id, studentId, teacherId, date, period, status (present/absent/late)
- `timetable_slots`: id, teacherId, dayOfWeek, period, subject, section, room

## API Routes
- `GET/POST /api/students` — CRUD students
- `GET/POST /api/attendance` — Attendance records
- `POST /api/attendance/bulk` — Bulk upsert attendance
- `GET/POST /api/timetable` — Timetable management
- `GET /api/reports/defaulters` — Defaulter report
- `GET /api/admin/pending-users` — List pending teachers
- `POST /api/admin/approve-user` — Approve teacher
- `POST /api/admin/reject-user` — Reject teacher
- `POST /api/onboarding` — Set teacher subject/status

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk frontend key
- `CLERK_SECRET_KEY` — Clerk backend key
- `SESSION_SECRET` — Session secret

## File Structure
```
client/src/
├── App.tsx              — Main app with auth gate & routing
├── lib/clerk-provider.tsx — Clerk provider wrapper
├── hooks/use-active-period.ts — Period/time tracking
├── components/layout.tsx — App shell with nav
├── pages/
│   ├── timetable.tsx    — 5x8 timetable grid
│   ├── attendance.tsx   — Student attendance cards
│   ├── enrollment.tsx   — Webcam face enrollment
│   ├── reports.tsx      — Defaulter reports + PDF
│   ├── admin.tsx        — Admin approval panel
│   ├── onboarding.tsx   — Subject selection
│   └── pending-approval.tsx — Waiting screen
server/
├── index.ts             — Express server setup
├── routes.ts            — API endpoints
├── storage.ts           — Database operations
├── seed.ts              — Sample data seeder
├── db.ts                — Database connection
shared/
└── schema.ts            — Drizzle schema + types
```
