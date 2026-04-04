require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const authRoutes = require("./routes/auth");

const allowedOrigins = [
  "https://collaborative-whiteboard-pearl.vercel.app",
  "http://localhost:5173",
];

const app = express();
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
  },
});

// ─── MongoDB connection ───
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ─── API routes ───
app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("Backend is running");
});

// ─── Room state ───
const roomStrokes = {};

// ─── Socket.IO auth middleware ───
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    // Allow unauthenticated connections but without username
    socket.username = "Anonymous";
    return next();
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.username = decoded.username;
    socket.userId = decoded.id;
    next();
  } catch {
    socket.username = "Anonymous";
    next();
  }
});

// ─── Socket.IO events ───
io.on("connection", (socket) => {
  console.log("User connected:", socket.id, "username:", socket.username);

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    const room = socket.roomId;
    if (!room) return;

    // Notify room that cursor left
    socket.to(room).emit("cursorLeave", socket.id);

    const clients = io.sockets.adapter.rooms.get(room);
    if (!clients || clients.size === 0) {
      delete roomStrokes[room];
    }
  });

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;

    if (!roomStrokes[roomId]) {
      roomStrokes[roomId] = [];
    }

    socket.emit("loadStrokes", roomStrokes[roomId]);

    // Notify room about new user
    socket.to(roomId).emit("userJoined", {
      socketId: socket.id,
      username: socket.username,
    });
  });

  socket.on("start", (data) => {
    if (!socket.roomId) return;
    socket.to(socket.roomId).emit("start", { ...data, socketId: socket.id });
  });

  socket.on("draw", (data) => {
    if (!socket.roomId) return;
    socket.to(socket.roomId).emit("draw", { points: data, socketId: socket.id });
  });

  socket.on("strokeComplete", (stroke) => {
    if (!socket.roomId || !roomStrokes[socket.roomId]) return;
    roomStrokes[socket.roomId].push(stroke);
    socket.to(socket.roomId).emit("strokeComplete", stroke);
  });

  socket.on("undoStroke", (strokeId) => {
    if (!socket.roomId) return;
    if (roomStrokes[socket.roomId]) {
      roomStrokes[socket.roomId] = roomStrokes[socket.roomId].filter((s) => s.id !== strokeId);
    }
    socket.to(socket.roomId).emit("undoStroke", strokeId);
  });

  socket.on("clearCanvas", () => {
    if (!socket.roomId) return;
    roomStrokes[socket.roomId] = [];
    socket.to(socket.roomId).emit("clearCanvas");
  });

  socket.on("eraseStroke", (strokeId) => {
    if (!socket.roomId) return;
    if (roomStrokes[socket.roomId]) {
      roomStrokes[socket.roomId] = roomStrokes[socket.roomId].filter((s) => s.id !== strokeId);
    }
    socket.to(socket.roomId).emit("eraseStroke", strokeId);
  });

  // ─── Cursor position broadcasting ───
  socket.on("cursorMove", (data) => {
    if (!socket.roomId) return;
    socket.to(socket.roomId).emit("cursorMove", {
      socketId: socket.id,
      username: socket.username,
      x: data.x,
      y: data.y,
      tool: data.tool,
      color: data.color,
    });
  });

  socket.on("cursorLeave", () => {
    if (!socket.roomId) return;
    socket.to(socket.roomId).emit("cursorLeave", socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
