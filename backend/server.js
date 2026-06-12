require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const authRoutes = require("./routes/auth");
const Room = require("./models/Room");

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

// ─── In-memory cache (mirrors DB for fast real-time access) ───
const roomCache = {};

// Helper: persist strokes to DB (debounced per room)
const saveTimers = {};
const persistRoom = (roomId) => {
  if (saveTimers[roomId]) clearTimeout(saveTimers[roomId]);
  saveTimers[roomId] = setTimeout(async () => {
    try {
      const strokes = roomCache[roomId] || [];
      await Room.findOneAndUpdate(
        { roomId },
        { roomId, strokes, updatedAt: new Date() },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error("Error persisting room", roomId, err.message);
    }
  }, 1000); // debounce: save at most once per second
};

// ─── Socket.IO auth middleware ───
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
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

    socket.to(room).emit("cursorLeave", socket.id);

    // If room is empty, persist and clear cache after a delay
    const clients = io.sockets.adapter.rooms.get(room);
    if (!clients || clients.size === 0) {
      persistRoom(room);
      // Keep cache for 5 minutes in case someone rejoins quickly
      setTimeout(() => {
        const stillEmpty = !io.sockets.adapter.rooms.get(room) || io.sockets.adapter.rooms.get(room).size === 0;
        if (stillEmpty) {
          delete roomCache[room];
        }
      }, 5 * 60 * 1000);
    }
  });

  socket.on("joinRoom", async (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;

    // Load from cache, or from DB, or start empty
    if (!roomCache[roomId]) {
      try {
        const room = await Room.findOne({ roomId });
        roomCache[roomId] = room ? room.strokes : [];
      } catch (err) {
        console.error("Error loading room", roomId, err.message);
        roomCache[roomId] = [];
      }
    }

    socket.emit("loadStrokes", roomCache[roomId]);

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
    if (!socket.roomId) return;
    if (!roomCache[socket.roomId]) roomCache[socket.roomId] = [];
    roomCache[socket.roomId].push(stroke);
    socket.to(socket.roomId).emit("strokeComplete", stroke);
    persistRoom(socket.roomId);
  });

  socket.on("undoStroke", (strokeId) => {
    if (!socket.roomId) return;
    if (roomCache[socket.roomId]) {
      roomCache[socket.roomId] = roomCache[socket.roomId].filter((s) => s.id !== strokeId);
    }
    socket.to(socket.roomId).emit("undoStroke", strokeId);
    persistRoom(socket.roomId);
  });

  socket.on("clearCanvas", () => {
    if (!socket.roomId) return;
    roomCache[socket.roomId] = [];
    socket.to(socket.roomId).emit("clearCanvas");
    persistRoom(socket.roomId);
  });

  socket.on("eraseStroke", (strokeId) => {
    if (!socket.roomId) return;
    if (roomCache[socket.roomId]) {
      roomCache[socket.roomId] = roomCache[socket.roomId].filter((s) => s.id !== strokeId);
    }
    socket.to(socket.roomId).emit("eraseStroke", strokeId);
    persistRoom(socket.roomId);
  });

  socket.on("redoStroke", (stroke) => {
    if (!socket.roomId) return;
    if (!roomCache[socket.roomId]) roomCache[socket.roomId] = [];
    roomCache[socket.roomId].push(stroke);
    socket.to(socket.roomId).emit("redoStroke", stroke);
    persistRoom(socket.roomId);
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
