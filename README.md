# EvalAI — AI-Assisted Student Project Evaluation

React + Vite **`frontend/`**, Node/Express + MongoDB **`backend/`**, wired together
as npm workspaces from the root `package.json`. All data is real and stored in
MongoDB — there is **no seeded demo data**. The dashboards start empty until real
users register and real projects are submitted.

## Flow

1. Student registers (`/register/student`) → logs in (`/login`)
2. Student uploads a real project **ZIP** → backend extracts & analyzes it
3. Evaluator registers (`/register/evaluator`) → logs in (`/evaluator`) → opens the
   submission → sees the real file tree, detected technologies, an evidence-based
   AI suggested score and **"Why this score?"** → adjusts/accepts → submits
4. Student opens **My Results** → sees the real score, rubric, strengths,
   weaknesses, recommendations and skill profile
5. Admin logs in (`/admin`) → sees real students, projects, evaluations and stats

## Prerequisites

- Node.js 18+
- MongoDB — either a local `mongod` or a free **MongoDB Atlas** cluster

## Setup

```bash
# 1. install every workspace from the repo root
npm install

# 2. backend env
cp backend/.env.example backend/.env
#   then edit backend/.env:
#   MONGO_URI=mongodb://127.0.0.1:27017/evalai      (or your Atlas URI)
#   JWT_SECRET=<long random string>
#   PORT=5000
#   CLIENT_ORIGIN=http://localhost:5173
#   ADMIN_EMAIL=<your admin email>
#   ADMIN_PASSWORD=<your admin password>

# 3. frontend env
cp frontend/.env.example frontend/.env    # VITE_API_URL=http://localhost:5000/api

# 4. start the backend  (terminal 1)
npm run server            # or: npm run server:dev  (auto-restart)

# 5. start the frontend (terminal 2)
npm run dev
```

Open http://localhost:5173.

All commands are run from the repo root; they delegate to the right workspace
(`npm run dev`/`build`/`lint` → `frontend`, `npm run server`/`test:e2e` →
`backend`). You can also `cd frontend` / `cd backend` and run their scripts
directly.

- On first boot the backend creates **one admin account** from `ADMIN_EMAIL` /
  `ADMIN_PASSWORD` (only if it does not already exist). There is no admin
  registration page.
- The default evaluation rubric (100 marks) is created automatically and can be
  edited by the admin under **Evaluation Criteria**.

## Environment variables

| File                  | Key             | Purpose                                 |
| --------------------- | --------------- | --------------------------------------- |
| `backend/.env`        | `MONGO_URI`     | MongoDB connection string              |
| `backend/.env`        | `JWT_SECRET`    | signs auth tokens                       |
| `backend/.env`        | `PORT`          | backend port (default 5000)            |
| `backend/.env`        | `CLIENT_ORIGIN` | allowed CORS origin (frontend dev URL) |
| `backend/.env`        | `ADMIN_EMAIL`   | initial admin login                    |
| `backend/.env`        | `ADMIN_PASSWORD`| initial admin password (hashed on save)|
| `frontend/.env`       | `VITE_API_URL`  | backend API base URL for the frontend  |

`backend/.env`, `frontend/.env` and `backend/uploads/` are git-ignored. Secrets
are never hard-coded.

## Tests

```bash
npm run test:backend   # offline: ZIP analysis + rule-based AI
npm run test:e2e       # full flow against an in-memory MongoDB
```

## Security

- Passwords are hashed with bcrypt; plain-text passwords are never stored.
- JWT auth (`Authorization: Bearer <token>`); every `/api/admin`, `/api/student`
  and `/api/evaluator` route is protected by auth + role middleware, so a student
  cannot call admin APIs by changing the URL.
- Uploaded ZIPs are stored under random internal names; filesystem paths are never
  exposed. Analysis guards against oversized archives / zip bombs.
- Files containing `API_KEY`, `PASSWORD`, `TOKEN`, `SECRET`, `MONGO_URI`,
  `JWT_SECRET`, connection strings or private keys are flagged as
  **"Sensitive value detected"** — the value itself is never read into the
  response or shown in the UI.

## API

```
POST /api/auth/register/student
POST /api/auth/register/evaluator
POST /api/auth/login
GET  /api/auth/me

GET  /api/admin/dashboard | students | evaluations | syllabus | criteria
POST /api/admin/syllabus | questions | assessments
PUT  /api/admin/criteria

GET  /api/student/dashboard | projects | results | assessments | assessments/:id
POST /api/student/projects            (multipart: project=<zip>)
POST /api/student/assessments/:id/attempt

GET  /api/evaluator/dashboard | pending | completed | projects/:id
POST /api/evaluator/evaluations
PUT  /api/evaluator/evaluations/:id
```

## Project structure

```
EvalAI/
├── frontend/
│   ├── src/
│   │   ├── components/  pages/  context/  hooks/  config/  lib/
│   │   └── services/  api.js  authApi.js  projectApi.js  evaluationApi.js
│   ├── public/   index.html   vite.config.js   package.json
├── backend/
│   ├── config/db.js
│   ├── models/       User  Syllabus  ProjectSubmission  Evaluation  Criteria  Mcq
│   ├── middleware/    auth.js (JWT + role)   upload.js (multer, zip only, 15 MB)
│   ├── controllers/   auth  admin  student  evaluator  mcq
│   ├── routes/        auth  admin  student  evaluator
│   ├── services/      projectAnalyzer.js (jszip)   mockAI.js (rule-based, evidence)
│   ├── scripts/       check.mjs   e2e.mjs
│   ├── uploads/       student ZIPs (git-ignored)
│   ├── server.js      .env   package.json
├── .gitignore   README.md   package.json  (root workspace)
```
