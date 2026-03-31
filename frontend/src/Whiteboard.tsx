import { useRef, useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Pen, Eraser, Undo2, Share2, Trash2, Download, Home } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "https://whiteboard-backend-c3yc.onrender.com";

let socket: Socket;

type Point = { x: number, y: number };

type Stroke = {
  id: string;
  userId: string;
  points: Point[];
  color: string;
  width: number;
};

const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 900;

const Whiteboard = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStroke = useRef<Stroke | null>(null);

  const lastEmitTime = useRef(0);
  const pointBuffer = useRef<Point[]>([]);

  // Pan & zoom state (refs for 60fps direct DOM updates, no re-renders)
  const panOffset = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const lastPinchCenter = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef(0);
  const isPanning = useRef(false);

  const [color, setColor] = useState("#000000");
  const [width, setWidth] = useState(2);

  const [tool, setTool] = useState<"pen" | "eraser">("pen");

  const { roomId } = useParams();

  // Remote cursors
  type CursorInfo = { username: string; x: number; y: number; tool: string; color: string };
  const [remoteCursors, setRemoteCursors] = useState<Record<string, CursorInfo>>({});

  // Assign a consistent color to each remote user
  const cursorColors = useRef<Record<string, string>>({});
  const getCursorColor = (socketId: string) => {
    if (!cursorColors.current[socketId]) {
      const hue = (Object.keys(cursorColors.current).length * 137) % 360;
      cursorColors.current[socketId] = `hsl(${hue}, 70%, 55%)`;
    }
    return cursorColors.current[socketId];
  };

  // Initialize socket with auth token
  useEffect(() => {
    socket = io(API_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      auth: { token: token || "" },
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    if (!roomId) return;

    const joinRoom = () => {
      socket.emit("joinRoom", roomId);
    };

    // Join immediately if already connected
    if (socket.connected) {
      joinRoom();
    }

    // Re-join on every (re)connect so the server always knows our room
    socket.on("connect", joinRoom);

    return () => {
      socket.off("connect", joinRoom);
    };
  }, [roomId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Fixed large canvas for pannable workspace
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctxRef.current = ctx;

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Position canvas: centered horizontally, below toolbar vertically
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const TOOLBAR_HEIGHT = 52;
    const GAP = 16;

    panOffset.current = {
      x: (vw - CANVAS_WIDTH) / 2,
      y: TOOLBAR_HEIGHT + GAP,
    };
    // On phones (canvas wider than viewport), center it
    if (CANVAS_WIDTH > vw) {
      panOffset.current.x = -(CANVAS_WIDTH - vw) / 2;
    }
    if (CANVAS_HEIGHT > vh) {
      panOffset.current.y = -(CANVAS_HEIGHT - vh) / 2;
    }
    scaleRef.current = 1;
    applyTransform();
  }, []);

  useEffect(() => {
    socket.on("start", ({ x, y, color, width }) => {
      const ctx = ctxRef.current;
      if (!ctx) return;

      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y);
    });

    socket.on("draw", (points: Point[]) => {
      const ctx = ctxRef.current
      if (!ctx) return

      for (const p of points) {
        ctx.lineTo(p.x, p.y);
      }

      ctx.stroke();
    });

    socket.on("strokeComplete", (stroke: Stroke) => {
      setStrokes((prev) => [...prev, stroke]);
    });

    // Replace (not append) to avoid duplicates on reconnect
    socket.on("loadStrokes", (loadedStrokes: Stroke[]) => {
      setStrokes(loadedStrokes);
    });

    socket.on("undoStroke", (strokeId: string) => {
      setStrokes((prev) => prev.filter((s) => s.id !== strokeId));
    });

    socket.on("clearCanvas", () => {
      setStrokes([]);
    });

    socket.on("eraseStroke", (strokeId: string) => {
      setStrokes((prev) => prev.filter((s) => s.id !== strokeId));
    });

    // Cursor events
    socket.on("cursorMove", (data: { socketId: string; username: string; x: number; y: number; tool: string; color: string }) => {
      setRemoteCursors((prev) => ({
        ...prev,
        [data.socketId]: { username: data.username, x: data.x, y: data.y, tool: data.tool, color: data.color },
      }));
    });

    socket.on("cursorLeave", (socketId: string) => {
      setRemoteCursors((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    });

    return () => {
      socket.off("start");
      socket.off("draw");
      socket.off("strokeComplete");
      socket.off("loadStrokes");
      socket.off("undoStroke");
      socket.off("clearCanvas");
      socket.off("eraseStroke");
      socket.off("cursorMove");
      socket.off("cursorLeave");
    };
  }, []);

  useEffect(() => {
    redrawCanvas();
  }, [strokes]);

  useEffect(() => {
    const handleResize = () => {
      redrawCanvas();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [strokes]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = ctxRef.current;
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const stroke of strokes) {
      if (!stroke || stroke.points.length === 0) continue;

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;

      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }

      ctx.stroke()
    }
  };

  // Apply combined translate + scale transform to the canvas wrapper
  const applyTransform = () => {
    if (canvasWrapperRef.current) {
      canvasWrapperRef.current.style.transform =
        `translate(${panOffset.current.x}px, ${panOffset.current.y}px) scale(${scaleRef.current})`;
      canvasWrapperRef.current.style.transformOrigin = "0 0";
    }
  };

  // Helper to get canvas-relative coordinates from a touch event
  // Accounts for CSS scale by using the ratio of canvas pixels to visual pixels
  const getTouchPos = (touch: Touch): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (touch.clientX - rect.left) * (canvas.width / rect.width),
      y: (touch.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  // Midpoint between two touches (for pan gesture)
  const getMidpoint = (t1: Touch, t2: Touch): Point => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  });

  // Distance between two touches (for pinch-to-zoom)
  const getDistance = (t1: Touch, t2: Touch): number => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // ─── Core drawing logic (coordinates only, no event type dependency) ───

  const handleStartDrawing = useCallback((x: number, y: number) => {
    setIsDrawing(true);

    if (tool === "eraser") return;

    const ctx = ctxRef.current;
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);

    const newStroke: Stroke = {
      id: crypto.randomUUID(),
      userId: socket.id || "local",
      points: [{ x, y }],
      color: color,
      width: width,
    };

    currentStroke.current = newStroke;
    pointBuffer.current = [];

    socket.emit("start", { x, y, color, width });
  }, [tool, color, width]);

  const handleDraw = useCallback((x: number, y: number) => {
    if (tool === "eraser") {
      if (isDrawing) handleErase(x, y);
      return;
    }

    if (!isDrawing) return;

    const ctx = ctxRef.current;
    if (!ctx) return;

    ctx.lineWidth = width;
    ctx.strokeStyle = color;

    ctx.lineTo(x, y);
    ctx.stroke();

    if (currentStroke.current) {
      currentStroke.current.points.push({ x, y });
    }

    pointBuffer.current.push({ x, y });

    const now = Date.now();

    if (now - lastEmitTime.current > 16) {
      if (pointBuffer.current.length > 0) {
        socket.emit("draw", pointBuffer.current);

        pointBuffer.current = [];
        lastEmitTime.current = now;
      }
    }
  }, [tool, isDrawing, color, width]);

  const handleStopDrawing = useCallback(() => {
    setIsDrawing(false);

    if (tool === "eraser") return;

    if (!currentStroke.current) return;

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
  }, [tool]);

  // ─── Mouse event wrappers ───

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleStartDrawing(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleDraw(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
  };

  // ─── Touch event listeners (1 finger = draw, 2 fingers = pan + zoom) ───

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();

      // Two fingers → start panning + zooming
      if (e.touches.length === 2) {
        isPanning.current = true;
        // Cancel any in-progress stroke
        if (currentStroke.current) {
          currentStroke.current = null;
          pointBuffer.current = [];
          setIsDrawing(false);
        }
        lastPinchCenter.current = getMidpoint(e.touches[0], e.touches[1]);
        lastPinchDist.current = getDistance(e.touches[0], e.touches[1]);
        return;
      }

      // One finger → draw (only if not already panning)
      if (e.touches.length === 1 && !isPanning.current) {
        const pos = getTouchPos(e.touches[0]);
        handleStartDrawing(pos.x, pos.y);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();

      // Pan + zoom with two fingers
      if (isPanning.current && e.touches.length >= 2) {
        const mid = getMidpoint(e.touches[0], e.touches[1]);
        const dist = getDistance(e.touches[0], e.touches[1]);

        // --- Zoom (pinch) ---
        if (lastPinchDist.current > 0) {
          const zoomRatio = dist / lastPinchDist.current;
          const oldScale = scaleRef.current;
          const newScale = Math.min(3, Math.max(0.3, oldScale * zoomRatio));
          const actualRatio = newScale / oldScale;

          // Focal-point zoom: keep the midpoint between fingers stationary
          panOffset.current.x = mid.x - (mid.x - panOffset.current.x) * actualRatio;
          panOffset.current.y = mid.y - (mid.y - panOffset.current.y) * actualRatio;
          scaleRef.current = newScale;
        }

        // --- Pan ---
        const dx = mid.x - lastPinchCenter.current.x;
        const dy = mid.y - lastPinchCenter.current.y;
        panOffset.current.x += dx;
        panOffset.current.y += dy;

        lastPinchCenter.current = mid;
        lastPinchDist.current = dist;

        applyTransform();
        return;
      }

      // Drawing with one finger
      if (e.touches.length === 1 && !isPanning.current) {
        const pos = getTouchPos(e.touches[0]);
        handleDraw(pos.x, pos.y);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();

      // If panning, stop when all fingers are lifted
      if (isPanning.current) {
        if (e.touches.length === 0) {
          isPanning.current = false;
        }
        return;
      }

      // Stop drawing when finger is lifted
      if (e.touches.length === 0) {
        handleStopDrawing();
      }
    };

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [handleStartDrawing, handleDraw, handleStopDrawing]);

  // ─── Desktop: mouse wheel / touchpad panning & zooming ───

  useEffect(() => {
    const container = canvasWrapperRef.current?.parentElement;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey) {
        // Ctrl + scroll = zoom (touchpad pinch generates this)
        const zoomSensitivity = 0.01;
        const oldScale = scaleRef.current;
        const newScale = Math.min(3, Math.max(0.3, oldScale - e.deltaY * zoomSensitivity));
        const ratio = newScale / oldScale;

        // Focal-point zoom towards cursor position
        const focalX = e.clientX;
        const focalY = e.clientY;
        panOffset.current.x = focalX - (focalX - panOffset.current.x) * ratio;
        panOffset.current.y = focalY - (focalY - panOffset.current.y) * ratio;
        scaleRef.current = newScale;
      } else {
        // Regular scroll = pan
        panOffset.current.x -= e.deltaX;
        panOffset.current.y -= e.deltaY;
      }

      applyTransform();
    };

    container.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", onWheel);
    };
  }, []);

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

  const copyRoomLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("Room link copied to clipboard!");
    } catch {
      alert("Failed to copy link");
    }
  };

  const handleClear = () => {
    setStrokes([]);
    socket.emit("clearCanvas");
  };

  const handleErase = (x: number, y: number) => {
    const threshold = 10;

    setStrokes((prev) => {
      const remaining = prev.filter((stroke) => {
        return !stroke.points.some((p) => {
          const dx = p.x - x;
          const dy = p.y - y;
          return Math.sqrt(dx * dx + dy * dy) < threshold;
        });
      });

      const removed = prev.filter((s) => !remaining.includes(s));

      removed.forEach((s) => {
        socket.emit("eraseStroke", s.id);
      });

      return remaining;
    });
  };

  const exportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = "whiteboard.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // Emit cursor position during drawing
  const emitCursor = (x: number, y: number) => {
    if (!socket) return;
    socket.emit("cursorMove", { x, y, tool, color });
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ touchAction: "none", backgroundColor: "#e5e7eb" }}>
      {/* Redesigned pill toolbar */}
      <div className="wb-toolbar">
        <button onClick={() => navigate("/")} className="wb-tool-btn" title="Home">
          <Home size={18} />
        </button>

        <div className="wb-toolbar-divider" />

        <button
          onClick={() => setTool("pen")}
          className={`wb-tool-btn ${tool === "pen" ? "active" : ""}`}
          title="Pen"
        >
          <Pen size={18} />
        </button>

        <button
          onClick={() => setTool("eraser")}
          className={`wb-tool-btn ${tool === "eraser" ? "active" : ""}`}
          title="Eraser"
        >
          <Eraser size={18} />
        </button>

        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="wb-color-input"
          title="Color"
        />

        <input
          type="range"
          value={width}
          min="1"
          max="10"
          onChange={(e) => setWidth(Number(e.target.value))}
          className="wb-width-slider"
          title="Brush size"
        />

        <div className="wb-toolbar-divider" />

        <button onClick={handleUndo} className="wb-tool-btn" title="Undo">
          <Undo2 size={18} />
        </button>

        <button onClick={copyRoomLink} className="wb-tool-btn" title="Copy room link">
          <Share2 size={18} />
        </button>

        <button onClick={exportImage} className="wb-tool-btn" title="Export image">
          <Download size={18} />
        </button>

        <button onClick={handleClear} className="wb-tool-btn danger" title="Clear all">
          <Trash2 size={18} />
        </button>

        <div className="wb-toolbar-divider" />

        <span className="wb-room-code">{roomId}</span>
      </div>

      {/* Remote cursor labels */}
      {Object.entries(remoteCursors).map(([socketId, cursor]) => {
        const cursorColor = getCursorColor(socketId);
        // Convert canvas coords to screen coords using pan offset and scale
        const screenX = cursor.x * scaleRef.current + panOffset.current.x;
        const screenY = cursor.y * scaleRef.current + panOffset.current.y;
        return (
          <div
            key={socketId}
            className="cursor-label"
            style={{ left: screenX, top: screenY }}
          >
            <div className="cursor-dot" style={{ backgroundColor: cursorColor }} />
            <span className="cursor-name" style={{ backgroundColor: cursorColor }}>
              {cursor.username}
            </span>
          </div>
        );
      })}

      {/* Pannable canvas wrapper */}
      <div ref={canvasWrapperRef} style={{ position: "absolute", top: 0, left: 0 }}>
        <canvas
          ref={canvasRef}
          className="bg-white"
          style={{
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            touchAction: "none",
            boxShadow: "0 2px 16px rgba(0,0,0,0.12)",
            borderRadius: 4,
            cursor: tool === "eraser"
              ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Crect x='2' y='6' width='16' height='10' rx='2' fill='%23fff' stroke='%23555' stroke-width='1.5'/%3E%3Crect x='2' y='6' width='7' height='10' rx='2' fill='%23f87171' stroke='%23555' stroke-width='1.5'/%3E%3C/svg%3E") 10 10, cell`
              : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Cline x1='10' y1='0' x2='10' y2='20' stroke='black' stroke-width='1.5'/%3E%3Cline x1='0' y1='10' x2='20' y2='10' stroke='black' stroke-width='1.5'/%3E%3C/svg%3E") 10 10, crosshair`
          }}
          onMouseDown={onMouseDown}
          onMouseMove={(e) => {
            onMouseMove(e);
            emitCursor(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
          }}
          onMouseUp={handleStopDrawing}
          onMouseLeave={() => {
            handleStopDrawing();
            socket?.emit("cursorLeave");
          }}
        />
      </div>
    </div>
  );
};

export default Whiteboard;