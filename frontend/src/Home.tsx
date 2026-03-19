import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");

  const createRoom = () => {
    const roomId = crypto.randomUUID().slice(0, 6);
    navigate(`/room/${roomId}`);
  };

  const joinRoom = () => {
    const trimmed = roomCode.trim();
    if (!trimmed) return;
    navigate(`/room/${trimmed}`);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-blue-500 gap-6">
      <button
        onClick={createRoom}
        className="bg-black text-white px-6 py-3 rounded text-lg"
      >
        Create Whiteboard
      </button>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Enter room code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && joinRoom()}
          className="px-4 py-3 rounded text-black text-lg"
        />
        <button
          onClick={joinRoom}
          className="bg-white text-black px-6 py-3 rounded text-lg"
        >
          Join Room
        </button>
      </div>
    </div>
  );
}

export default Home;