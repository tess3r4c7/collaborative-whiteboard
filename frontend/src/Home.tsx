import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Plus, ArrowRight, LogOut, Users, Sparkles, Palette } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
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
    <div className="home-page">
      {/* Decorative background elements */}
      <div className="home-bg-grid" />
      <div className="home-blob home-blob-1" />
      <div className="home-blob home-blob-2" />
      <div className="home-blob home-blob-3" />

      {/* Top bar */}
      <header className="home-header">
        <div className="home-brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" />
          </svg>
          <span>WhiteBoard</span>
        </div>
        <div className="home-user-info">
          <span className="home-username">@{user?.username}</span>
          <button onClick={logout} className="home-logout" title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="home-hero">
        <div className="home-badge">
          <Sparkles size={14} /> Real-time collaboration
        </div>

        <h1 className="home-title">
          Draw together,<br />
          <span className="home-title-gradient">anywhere.</span>
        </h1>

        <p className="home-subtitle">
          A collaborative whiteboard where ideas flow freely. Create a room,
          share the link, and start creating with your team in real time.
        </p>

        {/* Feature pills */}
        <div className="home-features">
          <div className="home-feature">
            <Users size={16} /> Multi-user sync
          </div>
          <div className="home-feature">
            <Palette size={16} /> Colors & tools
          </div>
          <div className="home-feature">
            <Sparkles size={16} /> Live cursors
          </div>
        </div>

        {/* Actions */}
        <div className="home-actions">
          <button onClick={createRoom} className="home-create-btn">
            <Plus size={20} />
            Create Whiteboard
          </button>

          <div className="home-join">
            <input
              type="text"
              placeholder="Enter room code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && joinRoom()}
              className="home-join-input"
            />
            <button onClick={joinRoom} className="home-join-btn" disabled={!roomCode.trim()}>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}