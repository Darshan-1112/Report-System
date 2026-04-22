# Employee Reporting System

A full-stack web application for managing employee daily work reports with role-based access control. Employees submit reports, managers review and approve/reject them, and admins oversee the entire system.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | MySQL (mysql2 with connection pooling) |
| Auth | JWT (JSON Web Tokens) + bcryptjs |
| HTTP Client | Axios |
| State/Session | React Context API + js-cookie |

---

## Project Structure

```
Reporting System/
├── client/                        # Next.js Frontend
│   └── src/
│       ├── app/
│       │   ├── (dashboard)/       # Protected dashboard routes
│       │   │   ├── admin/         # Admin pages
│       │   │   ├── manager/       # Manager pages
│       │   │   └── employee/      # Employee pages
│       │   ├── login/             # Public login page
│       │   └── register/          # Public register page
│       ├── components/            # Shared UI components
│       ├── context/AuthContext.js # Global auth state
│       └── utils/api.js           # Axios instance with JWT interceptor
│
└── server/                        # Express Backend
    ├── config/db.js               # MySQL connection pool
    ├── controllers/               # Business logic
    ├── middleware/authMiddleware.js
    ├── models/userModel.js
    ├── routes/                    # API route definitions
    ├── utils/jwtHelper.js
    └── server.js                  # Entry point
```

---

## Database Schema

### Table: `users`
Stores all system users regardless of role.

```sql
CREATE TABLE users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(100) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,          -- bcrypt hashed
    role        ENUM('admin','manager','employee') NOT NULL,
    manager_id  INT NULL,                        -- FK → users.id (self-referencing)
    department  VARCHAR(100) NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
);
```

**Logic:** Self-referencing foreign key. An employee's `manager_id` points to another row in the same table where `role = 'manager'`. Admin assigns this relationship via the User Management page.

---

### Table: `reports`
Each submitted daily report by an employee.

```sql
CREATE TABLE reports (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT NOT NULL,                   -- FK → users.id (the employee)
    title        VARCHAR(200) NOT NULL,
    description  TEXT NULL,
    total_hours  DECIMAL(5,2) NOT NULL,          -- Sum of all task hours
    status       ENUM('pending','approved','rejected') DEFAULT 'pending',
    is_deleted   BOOLEAN DEFAULT FALSE,          -- Soft delete flag
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Logic:** When an employee submits a report, `total_hours` is calculated on the server by summing all task hours. Status starts as `pending` and is updated by the manager.

---

### Table: `report_tasks`
Individual tasks within a report (one report → many tasks).

```sql
CREATE TABLE report_tasks (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    report_id   INT NOT NULL,                    -- FK → reports.id
    task_name   VARCHAR(200) NOT NULL,
    hours       DECIMAL(4,2) NOT NULL,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);
```

**Logic:** One-to-many relationship with `reports`. When a report is deleted, all its tasks are cascade-deleted. The manager can expand a report card to see the full task breakdown.

---

### Table: `report_feedback`
Manager's rejection comment for a specific report.

```sql
CREATE TABLE report_feedback (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    report_id   INT NOT NULL,                    -- FK → reports.id
    manager_id  INT NOT NULL,                    -- FK → users.id (the manager)
    comment     TEXT NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id),
    FOREIGN KEY (manager_id) REFERENCES users(id)
);
```

**Logic:** Only created when a manager rejects a report. The employee sees this comment in their history page in red italic text.

---

### Table: `audit_logs`
System-wide activity log for every significant action.

```sql
CREATE TABLE audit_logs (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,                    -- Who performed the action
    action      VARCHAR(100) NOT NULL,           -- e.g. REPORT_CREATED, REPORT_APPROVED
    entity_type VARCHAR(50) NOT NULL,            -- e.g. 'reports'
    entity_id   INT NOT NULL,                    -- ID of the affected record
    timestamp   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Logic:** Every report submission, approval, and rejection writes a row here automatically inside a database transaction. Admin views this on the Audit Logs page with search and filter.

---

## Table Relationships

```
users ──────────────────────────────────────────────────────┐
  │  (manager_id → users.id)  self-referencing              │
  │                                                          │
  ├──< reports (user_id → users.id)                         │
  │       │                                                  │
  │       ├──< report_tasks (report_id → reports.id)        │
  │       │                                                  │
  │       └──< report_feedback (report_id → reports.id)     │
  │                 │                                        │
  │                 └── manager_id → users.id ──────────────┘
  │
  └──< audit_logs (user_id → users.id)
```

---

## Authentication Flow

```
1. User submits email + password → POST /api/auth/login
2. Server finds user by email in DB
3. bcrypt.compare() checks password against stored hash
4. If valid → generateToken() creates JWT with payload: { id, role, manager_id }
5. JWT stored in browser cookie (js-cookie, expires 1 day)
6. Every API request → Axios interceptor reads cookie → adds Authorization: Bearer <token>
7. Server verifyToken middleware decodes JWT → attaches req.user
8. authorize(['role']) middleware checks req.user.role against allowed roles
9. On logout → cookies cleared → redirect to /login
```

---

## Role-Based Access Control

| Feature | Employee | Manager | Admin |
|---|---|---|---|
| Submit report | ✅ | ❌ | ❌ |
| View own reports | ✅ | ❌ | ❌ |
| View team pending reports | ❌ | ✅ | ❌ |
| Approve / Reject reports | ❌ | ✅ | ❌ |
| View all users | ❌ | ❌ | ✅ |
| Assign manager to employee | ❌ | ❌ | ✅ |
| View audit logs | ❌ | ❌ | ✅ |
| View system stats | own only | team only | global |

---

## API Endpoints

### Auth — `/api/auth`
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/register` | Public | Register new user |
| POST | `/login` | Public | Login, returns JWT + user |

### Reports — `/api/reports`
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/submit` | Employee | Submit new report with tasks (transaction) |
| GET | `/my` | Employee | Get own report history with feedback |
| GET | `/stats` | All roles | Dashboard stats (filtered by role) |
| GET | `/chart` | Employee | Task hours from last submitted report |
| GET | `/pending` | Manager | Get team's pending reports |
| PUT | `/review/:id` | Manager | Approve or reject a report |
| GET | `/:id/tasks` | Manager | Get task breakdown for a specific report |

### Admin — `/api/admin`
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/users` | Admin | All users with manager names |
| PUT | `/users/:userId/assign-manager` | Admin | Assign manager to employee |
| GET | `/logs` | Admin | All audit logs with user info |

---

## Core Business Logic

### Report Submission (Transaction)
When an employee submits a report, the server uses a **MySQL transaction** to ensure all-or-nothing:
1. Insert row into `reports` → get `reportId`
2. Insert all task rows into `report_tasks` with `reportId`
3. Insert row into `audit_logs` with action `REPORT_CREATED`
4. If any step fails → `ROLLBACK` (nothing is saved)
5. If all succeed → `COMMIT`

### Manager Review (Transaction)
1. Update `reports.status` to `approved` or `rejected`
2. If rejected → insert comment into `report_feedback`
3. Insert row into `audit_logs` with action `REPORT_APPROVED` or `REPORT_REJECTED`
4. All inside a transaction — rollback on failure

### Manager Sees Only Their Team
The `getPendingReports` query joins `reports` with `users` and filters by `users.manager_id = req.user.id`. A manager only ever sees reports from employees assigned to them.

### Stats Are Role-Aware
The `/reports/stats` endpoint checks `req.user.role`:
- **Employee** → counts their own reports (total, pending, approved, hours)
- **Manager** → counts team size and team pending reports
- **Admin** → counts total users, global pending reports, total audit log entries

---

## How to Run

### Prerequisites
- Node.js v18+
- MySQL 8+

### 1. Database Setup
```sql
CREATE DATABASE employee_reporting_system;
-- Then run the CREATE TABLE statements from the schema above
```

### 2. Backend
```bash
cd server
npm install
# Create .env file:
# DB_HOST=localhost
# DB_USER=root
# DB_PASSWORD=yourpassword
# DB_NAME=employee_reporting_system
# JWT_SECRET=your_secret_key
# PORT=5000
node server.js
```

### 3. Frontend
```bash
cd client
npm install
npm run dev
```

### 4. Access
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api

---

## Default User Roles to Create

Register users via `/register` with these roles:
- `admin` — full system access
- `manager` — team report review
- `employee` — submit and view own reports

After creating users, log in as admin and use **User Management** to assign managers to employees.
