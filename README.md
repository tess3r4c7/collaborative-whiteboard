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
+-- backend/
|   +-- middleware/
|   |   +-- auth.js
|   +-- models/
|   |   +-- Room.js
|   |   +-- User.js
|   +-- routes/
|   |   +-- auth.js
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
|   +-- package.json
|   +-- vite.config.ts
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
node server.js
```

For development with auto-restart:

```bash
npx nodemon server.js
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
node server.js          # Start backend server
npx nodemon server.js   # Start backend with auto-restart
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

## Deployment Notes

The project is split into two deployable apps:

- Deploy `frontend` to Vercel, Netlify, or another static frontend host.
- Deploy `backend` to Render, Railway, Fly.io, or another Node.js server host.
- Add the deployed frontend URL to the backend Socket.IO/CORS allowed origins in `backend/server.js`.
- Set `VITE_API_URL` in the frontend host to the deployed backend URL.
- Set `MONGODB_URI` and `JWT_SECRET` in the backend host environment variables.

## Future Improvements

- Add named boards and a dashboard of saved rooms
- Add shape tools, text boxes, and sticky notes
- Add role-based room permissions
- Add image import support
- Add presence list for active collaborators
- Add automated tests for auth routes and socket events
