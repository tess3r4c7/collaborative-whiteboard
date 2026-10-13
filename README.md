# Collaborative Whiteboard

A full-stack real-time collaborative whiteboard built with React, TypeScript, Express, Socket.IO, and MongoDB. Users can create private drawing rooms, share a room code/link, draw together live, see collaborator cursors, and return to saved boards later.

## Features

- Real-time multi-user drawing with Socket.IO rooms
- Account signup/login with JWT authentication
- Persistent whiteboard rooms stored in MongoDB
- Live collaborator cursors with usernames
- Pen and eraser tools
- Adjustable brush color and stroke width
- Undo/redo support for local strokes
- Clear canvas and PNG export
- Shareable room links and short room codes
- Large pannable canvas with mouse wheel/touchpad panning
- Mobile-friendly touch drawing with two-finger pan and pinch zoom
- Protected routes for authenticated users

## Tech Stack

**Frontend**

- React 19
- TypeScript
- Vite
- React Router
- Socket.IO Client
- Tailwind CSS
- Lucide React icons

**Backend**

- Node.js
- Express
- Socket.IO
- MongoDB
- Mongoose
- JWT authentication
- bcrypt password hashing

## Project Structure

```text
collaborative whiteboard/
+-- .github/
|   +-- workflows/
|       +-- ci-cd.yml
+-- backend/
|   +-- __tests__/
|   |   +-- auth.test.js
|   +-- middleware/
|   |   +-- auth.js
|   +-- models/
|   |   +-- Room.js
|   |   +-- User.js
|   +-- routes/
|   |   +-- auth.js
|   +-- Dockerfile
|   +-- .dockerignore
|   +-- package.json
|   +-- server.js
+-- frontend/
|   +-- src/
|   |   +-- context/
|   |   |   +-- AuthContext.tsx
|   |   +-- pages/
|   |   |   +-- Login.tsx
|   |   |   +-- Signup.tsx
|   |   +-- App.tsx
|   |   +-- Home.tsx
|   |   +-- Whiteboard.tsx
|   |   +-- main.tsx
|   +-- Dockerfile
|   +-- .dockerignore
|   +-- nginx.conf
|   +-- package.json
|   +-- vite.config.ts
+-- k8s/
|   +-- namespace.yaml
|   +-- configmap.yaml
|   +-- secret.yaml
|   +-- backend-deployment.yaml
|   +-- backend-service.yaml
|   +-- frontend-deployment.yaml
|   +-- frontend-service.yaml
+-- .gitignore
+-- README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- MongoDB Atlas database or a local MongoDB instance

### 1. Clone the repository

```bash
git clone https://github.com/your-username/collaborative-whiteboard.git
cd collaborative-whiteboard
```

### 2. Install dependencies

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd ../frontend
npm install
```

### 3. Configure environment variables

Create a `.env` file inside the `backend` directory:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=5000
```

Create a `.env` file inside the `frontend` directory:

```env
VITE_API_URL=http://localhost:5000
```

For production, set `VITE_API_URL` to the deployed backend URL.

### 4. Run the backend

```bash
cd backend
npm start
```

For development with auto-restart:

```bash
npm run dev
```

The backend runs on `http://localhost:5000` by default.

### 5. Run the frontend

Open a second terminal:

```bash
cd frontend
npm run dev
```

The frontend runs on `http://localhost:5173`.

## Available Scripts

Frontend scripts:

```bash
npm run dev       # Start Vite development server
npm run build     # Build frontend for production
npm run lint      # Run ESLint
npm run preview   # Preview production build
```

Backend:

```bash
npm start     # Start backend server
npm run dev   # Start backend with auto-restart
```

## How It Works

1. Users sign up or log in through the React frontend.
2. The backend validates credentials and returns a JWT.
3. The frontend sends the token when opening a Socket.IO connection.
4. Users create or join a whiteboard room by room ID.
5. Drawing events are broadcast only to users in the same room.
6. Completed strokes are cached in memory for fast collaboration and debounced to MongoDB for persistence.
7. When a user rejoins a room, the server loads the saved strokes and restores the canvas.

## API Overview

Authentication routes are mounted under `/api/auth`.

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | Create a new user account |
| `POST` | `/api/auth/login` | Log in with email/username and password |
| `GET` | `/api/auth/me` | Get the authenticated user's profile |

Socket.IO events include:

- `joinRoom`
- `loadStrokes`
- `start`
- `draw`
- `strokeComplete`
- `undoStroke`
- `redoStroke`
- `eraseStroke`
- `clearCanvas`
- `cursorMove`
- `cursorLeave`

## CI/CD Pipeline

The project includes a complete GitHub Actions CI/CD pipeline that runs on every push to `main` and on pull requests.

### Pipeline Stages

```
 Push/PR to main
       │
       ▼
 ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
 │  🔍 Lint │───▶│ 🧪 Test  │───▶│ 🐳 Build │───▶│ 🛡️ Scan  │───▶│ 📦 Push  │───▶│ 🚀 Deploy│
 │  ESLint  │    │  Jest +  │    │  Docker  │    │  Trivy   │    │  GHCR    │    │  K8s     │
 │  tsc     │    │ Supertest│    │  images  │    │  CVEs    │    │  SHA tag │    │ rollout  │
 └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                                  main only ────▶ main only
```

| Stage | What it does |
| --- | --- |
| **Lint** | ESLint + TypeScript type checking on the frontend |
| **Test** | 14 Jest unit tests for auth routes and health endpoint (in-memory MongoDB) |
| **Build** | Multi-stage Docker builds for backend + frontend, tagged with commit SHA |
| **Scan** | Trivy vulnerability scan — blocks on CRITICAL and HIGH severity CVEs |
| **Push** | Pushes images to GitHub Container Registry (main branch only) |
| **Deploy** | Applies Kubernetes manifests, waits for rolling update to complete |

### Image Tagging

Images are tagged by commit SHA, never just `latest`:

```
ghcr.io/<user>/whiteboard-backend:sha-abc1234
ghcr.io/<user>/whiteboard-frontend:sha-abc1234
```

## Docker

Both services use multi-stage Dockerfiles for minimal production images:

```bash
# Backend (~120MB vs ~1GB naive)
docker build -t whiteboard-backend ./backend

# Frontend (~25MB vs ~1GB naive)
docker build --build-arg VITE_API_URL=http://localhost:5000 -t whiteboard-frontend ./frontend
```

Run locally:

```bash
docker run -p 5000:5000 -e MONGODB_URI=your_uri -e JWT_SECRET=your_secret whiteboard-backend
docker run -p 3000:80 whiteboard-frontend
```

## Kubernetes Deployment

All K8s manifests are in `k8s/`. Features:

- **Rolling updates**: `maxSurge: 1`, `maxUnavailable: 0` for zero-downtime deploys
- **Health probes**: Readiness + liveness probes on `/api/health` (backend) and `/` (frontend)
- **Resource limits**: Memory and CPU constraints per container
- **Namespace isolation**: Everything runs in the `whiteboard` namespace

### Deploy to a Local kind Cluster

```bash
kind create cluster --name whiteboard
# Edit k8s/secret.yaml with real values
kubectl apply -f k8s/
kubectl port-forward svc/whiteboard-frontend -n whiteboard 3000:80
```

### Rollback

```bash
kubectl rollout undo deployment/whiteboard-backend -n whiteboard
kubectl rollout status deployment/whiteboard-backend -n whiteboard
```

## Testing

```bash
cd backend
npm install
npm test    # 14 tests, in-memory MongoDB, no real DB needed
```

| Suite | Tests | Coverage |
| --- | --- | --- |
| `GET /api/health` | 1 | Health status |
| `GET /` | 1 | Liveness |
| `POST /api/auth/signup` | 5 | Creation, duplicates, validation |
| `POST /api/auth/login` | 4 | Auth, wrong creds, unknown user |
| `GET /api/auth/me` | 3 | Token validation |

## Deployment Notes

The project supports two deployment paths:

**Path 1: Vercel + Render** — Deploy `frontend` to Vercel, `backend` to Render. Set `VITE_API_URL`, `MONGODB_URI`, `JWT_SECRET` as environment variables.

**Path 2: Kubernetes** — Push to `main` triggers the CI/CD pipeline. Docker images are built, scanned, pushed to GHCR, and deployed to K8s with rolling updates.

## Future Improvements

- Add named boards and a dashboard of saved rooms
- Add shape tools, text boxes, and sticky notes
- Add role-based room permissions
- Add image import support
- Add presence list for active collaborators
- Add end-to-end tests with Cypress
- Add Helm chart for Kubernetes deployment
