const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const roomStrokes = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;

    if (!roomStrokes[roomId]) {
      roomStrokes[roomId] = [];
    }

    socket.emit("loadStrokes", roomStrokes[roomId]);
  });

  socket.on("start", (data) => {
    socket.to(socket.roomId).emit("start", data);
  });

  socket.on("draw", (data) => {
    socket.to(socket.roomId).emit("draw", data);
  });

  socket.on("strokeComplete", (stroke) => {
    roomStrokes[socket.roomId].push(stroke);
    socket.to(socket.roomId).emit("strokeComplete", stroke);
  });

  socket.on("undoStroke", (strokeId) => {
    if (roomStrokes[socket.roomId]) {
      roomStrokes[socket.roomId] = roomStrokes[socket.roomId].filter(s => s.id !== strokeId);
    }
    
    socket.to(socket.roomId).emit("undoStroke", strokeId);
  });

  socket.on("clearCanvas", () => {
    roomStrokes[socket.roomId] = [];
    socket.to(socket.roomId).emit("clearCanvas");
  });
});

app.get("/", (req, res) => {
  res.send("Backend is running");
});

server.listen(5000, () => {
  console.log("Server running on port 5000");
});
