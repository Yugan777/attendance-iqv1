# Fix Bugs & Verify AI Classroom Attendance System

Your project is **~90% complete**. The Raspberry Pi backend, frontend dashboard, and Supabase integration are all built. There are 3 bugs preventing the system from working correctly, plus the database schema needs to be pushed.

## Proposed Changes

### Fix 1: Port Conflict Between Frontend and Pi

The frontend Express server defaults to port `5000`, which is the same port the Pi Flask server uses. The frontend should use port `3000` to avoid conflicts.

#### [MODIFY] [index.ts](file:///c:/Users/yugan/Desktop/attendencerobo/attendance/frontend/server/index.ts)
- Change the default PORT from `5000` to `3000`

---

### Fix 2: Route Ordering Bug

`GET /api/students/enrolled` is registered **after** `GET /api/students/:id`, so Express matches `/enrolled` as an `:id` parameter. The enrolled route must come first.

#### [MODIFY] [routes.ts](file:///c:/Users/yugan/Desktop/attendencerobo/attendance/frontend/server/routes.ts)
- Move the `/api/students/enrolled` route **before** `/api/students/:id`

---

### Fix 3: Missing Storage Interface Methods

[IStorage](file:///c:/Users/yugan/Desktop/attendencerobo/attendance/frontend/server/storage.ts#10-30) interface is missing [updateStudentEmbedding](file:///c:/Users/yugan/Desktop/attendencerobo/attendance/frontend/server/storage.ts#55-63) and [getStudentsWithEmbeddings](file:///c:/Users/yugan/Desktop/attendencerobo/attendance/frontend/server/storage.ts#64-70), even though [DatabaseStorage](file:///c:/Users/yugan/Desktop/attendencerobo/attendance/frontend/server/storage.ts#31-160) implements them. TypeScript will complain.

#### [MODIFY] [storage.ts](file:///c:/Users/yugan/Desktop/attendencerobo/attendance/frontend/server/storage.ts)
- Add [updateStudentEmbedding](file:///c:/Users/yugan/Desktop/attendencerobo/attendance/frontend/server/storage.ts#55-63) and [getStudentsWithEmbeddings](file:///c:/Users/yugan/Desktop/attendencerobo/attendance/frontend/server/storage.ts#64-70) to the [IStorage](file:///c:/Users/yugan/Desktop/attendencerobo/attendance/frontend/server/storage.ts#10-30) interface

## Verification Plan

### Automated Tests
1. **Install dependencies**: `cd c:\Users\yugan\Desktop\attendencerobo\attendance\frontend && npm install`
2. **Push DB schema**: `cd c:\Users\yugan\Desktop\attendencerobo\attendance\frontend && npx drizzle-kit push`
3. **Start dev server**: `cd c:\Users\yugan\Desktop\attendencerobo\attendance\frontend && npm run dev`
4. **Browser test**: Open the app in browser and verify:
   - Sign-in page loads
   - Timetable page renders after auth
   - Attendance page shows Pi settings
   - Enrollment page shows form
