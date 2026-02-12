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

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });

  socket.on("start", (data) => {
    socket.broadcast.emit("start", data);
  });

  socket.on("draw", (data) => {
    socket.broadcast.emit("draw", data);
  });
});

app.get("/", (req, res) => {
  res.send("Backend is running");
});

server.listen(5000, () => {
  console.log("Server running on port 5000");
});
