import { useRef, useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

const Whiteboard = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastEmitTime = useRef(0);
  const pointBuffer = useRef<{x:number,y:number}[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    socket.on("start", ({x, y}) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.beginPath();
        ctx.moveTo(x, y);
    });

    socket.on("draw", (points) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        for(const p of points) {
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
    });

    return () => {
        socket.off("start");
        socket.off("draw");
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

    pointBuffer.current = [];

    socket.emit("start", {x, y});

  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const x = e.nativeEvent.offsetX
    const y = e.nativeEvent.offsetY

    pointBuffer.current.push({ x, y });

    ctx.lineTo(x, y);
    ctx.stroke();

    const now = Date.now();

    if (now - lastEmitTime.current > 16) {
      if (pointBuffer.current.length > 0) {
        socket.emit("draw", pointBuffer.current);

        pointBuffer.current = [];
        lastEmitTime.current = now;
      }
    }
  
  };

  const stopDrawing = () => {
    setIsDrawing(false);

    if (pointBuffer.current.length > 0) {
      socket.emit("draw", pointBuffer.current);
      pointBuffer.current = [];
    }
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