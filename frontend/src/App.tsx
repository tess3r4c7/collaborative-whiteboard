import { Routes, Route } from "react-router-dom";
import Whiteboard from "./Whiteboard";
import Home from "./Home";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:roomId" element={<Whiteboard />} />
    </Routes>
  );
}

export default App;