# Local Windows Deployment & Verification Guide

This guide details how to install, configure, and execute the GFMS Technical Foundation Prototype on Microsoft Windows 10/11 with PostgreSQL.

---

## 1. Prerequisites Installation

You can install both required tools using Windows Package Manager (`winget`):

```powershell
winget install OpenJS.NodeJS.LTS
winget install PostgreSQL.PostgreSQL.16
```

Verify your installations by opening a new Command Prompt or PowerShell:

```cmd
node -v
npm -v
psql --version
```

---

## 2. PostgreSQL Database Setup

1. Start the PostgreSQL service if not already running (Windows Services > `postgresql-x64-16`).
2. Launch `psql` using your superuser account:
```cmd
psql -U postgres
```
3. Create the dedicated GFMS prototype database:
```sql
CREATE DATABASE gfms_db;
\q
```

---

## 3. Project Configuration

1. Extract the downloaded `GFMS-Technical-Foundation-v0.1.zip` (or clone the repository) into a folder of your choice, e.g. `C:\Projects\GFMS`.
2. Copy `.env.example` to `.env`:
```cmd
copy .env.example .env
```
3. Open `.env` in Notepad or VS Code and set your PostgreSQL credentials:
```env
PORT=3000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/gfms_db
JWT_SECRET=gfms_production_secure_secret_change_me_2026
NODE_ENV=development
```

---

## 4. Install Dependencies

In the project root folder, run:

```cmd
npm install
```

---

## 5. Run Database Migrations & Seeds

You can apply the SQL migrations directly via npm:

```cmd
npm run migrate
```
Or execute the SQL scripts directly via `psql`:
```cmd
psql -U postgres -d gfms_db -f database/migrations/001_create_initial_tables.sql
psql -U postgres -d gfms_db -f database/seeds/001_seed_initial_data.sql
```

---

## 6. Execute Automated Test Suite

Before running the server, verify that all 8 architectural test cases pass on your local Windows PostgreSQL instance:

```cmd
npm run test
```

Expected output:
```text
====================================================
GFMS Technical Foundation Prototype - Automated Tests
====================================================
✓ [System] Test #1: API Health Check & Metrics
✓ [Database] Test #2: PostgreSQL Database Connectivity
✓ [Authentication] Test #3: Successful Login with Valid Credentials
✓ [Authentication] Test #4: Failed Login Handling & Rejection
✓ [Authorization] Test #5: Unauthorized API Access Protection
✓ [Authorization] Test #6: Role-Based Permission Enforcement (RBAC)
✓ [User Management] Test #7: User Provisioning & Bcrypt Verification
✓ [Security & Compliance] Test #8: Audit Log Generation & Immutability
----------------------------------------------------
Summary: 8/8 tests passed
====================================================
```

---

## 7. Start Full-Stack Application

Launch the full-stack server (runs Express API + Vite frontend on port 3000):

```cmd
npm run dev
```

Open your browser and navigate to:
```
http://localhost:3000
```

### Initial Prototype Login Credentials:
- **System Administrator:** Username: `admin` | Password: `Admin@123`
- **Factory Manager:** Username: `manager` | Password: `Manager@123`
- **Department User:** Username: `deptuser` | Password: `Dept@123`

---

## 8. Standalone Independent Backend / Frontend Execution (Optional)

If you prefer to run the backend and frontend in separate terminals:

**Terminal 1 (Backend on port 5000):**
```cmd
cd backend
npm install
npm run dev
```

**Terminal 2 (Frontend on port 3000):**
```cmd
cd frontend
npm install
npm run dev
```
