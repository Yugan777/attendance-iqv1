# Checklist

## Database
- [ ] `teachers` table has `email`, `phone`, `employee_id` columns.
- [ ] `audit_logs` table exists.
- [ ] Passwords are hashed in the database (no plain text).

## Security
- [ ] Admin routes are protected by `@role_required('admin')` or equivalent check.
- [ ] SQL Injection prevented (using parameterized queries).
- [ ] Passwords hashed with salt.

## Features
- [ ] Admin can add a teacher with Name, Email, Phone, Subject.
- [ ] System prevents duplicate Email or Employee ID.
- [ ] Admin can soft-delete a teacher.
- [ ] Admin can view a list of all teachers.
- [ ] Basic "Audit Log" shows creation/deletion events.

## UI/UX
- [ ] Dashboard is responsive.
- [ ] Success/Error messages are clearly visible.
- [ ] Confirmation modal appears before deletion.
