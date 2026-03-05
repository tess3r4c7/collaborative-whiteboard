import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  const createRoom = () => {
    const roomId = crypto.randomUUID().slice(0, 6);
    navigate(`/room/${roomId}`);
  };

  return (
    <div className="flex items-center justify-center h-screen w-screen bg-blue-500">
      <button
        onClick={createRoom}
        className="bg-black text-white px-6 py-3 rounded text-lg"
      >
        Create Whiteboard
      </button>
    </div>
  );
}

export default Home;