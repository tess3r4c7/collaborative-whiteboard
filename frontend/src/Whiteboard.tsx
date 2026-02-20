import { useRef, useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

type Point = {x: number, y: number};

type Stroke = {
  id: string;
  userId: string;
  points: Point[];
};

const Whiteboard = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStroke = useRef<Stroke | null>(null);

  const lastEmitTime = useRef(0);
  const pointBuffer = useRef<Point[]>([]);

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
  }, []);

  useEffect(() => {
    socket.on("start", ({x, y}) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.beginPath();
        ctx.moveTo(x, y);
    });

    socket.on("draw", (points: Point[]) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        for(const p of points) {
          ctx.lineTo(p.x, p.y);
        }

        ctx.stroke();
    });

    socket.on("strokeComplete", (stroke: Stroke) => {
      setStrokes((prev) => [...prev, stroke]);
    });

    socket.on("undoStroke", (strokeId: string) => {
      setStrokes((prev) => prev.filter((s) => s.id !== strokeId));
    });

    return () => {
        socket.off("start");
        socket.off("draw");
        socket.off("strokeComplete");
        socket.off("undoStroke");
    };
  }, []);

  useEffect(() => {
    redrawCanvas();
  }, [strokes]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const stroke of strokes) {
      if (!stroke || stroke.points.length === 0) continue;

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }

      ctx.stroke()
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const x = e.nativeEvent.offsetX
    const y = e.nativeEvent.offsetY

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);

    const newStroke: Stroke = {
      id: crypto.randomUUID(),
      userId: socket.id || "local",
      points: [{x, y}],
    };

    currentStroke.current = newStroke;
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

    ctx.lineTo(x, y);
    ctx.stroke();

    if (currentStroke.current) {
      currentStroke.current.points.push({x, y});
    }

    pointBuffer.current.push({x, y});

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
    if (!currentStroke.current) {
      setIsDrawing(false);
      return;
    }

    if (pointBuffer.current.length > 0) {
      socket.emit("draw", pointBuffer.current);
      pointBuffer.current = [];
    }

    const strokeToCommit = currentStroke.current;

    if (strokeToCommit.points.length > 1) {
      setStrokes((prev) => [...prev, strokeToCommit]);
      socket.emit("strokeComplete", strokeToCommit);
    }

    currentStroke.current = null;
    setIsDrawing(false);
  };

  const handleUndo = () => {
    setStrokes((prev) => {
      const index = [...prev].reverse().findIndex(
        (stroke) => stroke.userId === (socket.id || "local")
      );

      if (index === -1) return prev;

      const realIndex = prev.length - 1 - index;
      const strokeToRemove = prev[realIndex];

      socket.emit("undoStroke", strokeToRemove.id);

      return prev.filter((s) => s.id !== strokeToRemove.id);
    });
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <button
        onClick={handleUndo}
        className="absolute top-4 left-4 z-10 bg-black text-white px-4 py-2 rounded"
      >
        Undo
      </button>

      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full bg-white cursor-crosshair"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      />
    </div>
  );
};

export default Whiteboard;