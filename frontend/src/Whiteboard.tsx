import { useRef, useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

const Whiteboard = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    socket.on("stroke", ({type, x, y}) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        if (type == "start") {
            ctx.beginPath();
            ctx.moveTo(x, y);
        }
        
        if (type == "draw") {
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    });

    return () => {
        socket.off("stroke");
    };
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();

    const x = e.nativeEvent.offsetX
    const y = e.nativeEvent.offsetY

    ctx.moveTo(x, y);
    setIsDrawing(true);

    socket.emit("stroke", {type: "start", x, y});
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const x = e.nativeEvent.offsetX
    const y = e.nativeEvent.offsetY

    ctx.lineTo(x, y);
    ctx.stroke();

    socket.emit("stroke", {type: "draw", x, y});
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  return (
    <canvas
      ref={canvasRef}
      className="bg-white cursor-crosshair"
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
    />
  );
};

export default Whiteboard;