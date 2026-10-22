import React, { useState, useEffect, useRef, useCallback } from "react";
import { ZoomIn, ZoomOut, RotateCw, Sun, Minimize2, Clock, Eye, Activity } from "lucide-react";
import { DEFAULT_TACHOGRAPH_DISC_DATA_URL } from "@/assets/default-disc";

export interface InteractiveDiscCanvasProps {
  imageUrl?: string;
  driver?: string;
  truck?: string;
  date?: string;
  kmTotal?: string;
  ptoHours?: string;
  arrival?: string;
  departure?: string;
  height?: number | string;
  showOverlayMarks?: boolean;
}

// Convert "HH:MM" to angle in radians (0 at top / 12:00 or midnight)
function timeToAngle(timeStr?: string): number | null {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  const fraction = (hours * 60 + minutes) / 1440;
  return fraction * 2 * Math.PI - Math.PI / 2;
}

export function InteractiveDiscCanvas({
  imageUrl = DEFAULT_TACHOGRAPH_DISC_DATA_URL,
  driver,
  truck,
  date,
  kmTotal,
  ptoHours,
  arrival,
  departure,
  height = 320,
  showOverlayMarks = true,
}: InteractiveDiscCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageObjRef = useRef<HTMLImageElement | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isInverted, setIsInverted] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showNeedleHighlights, setShowNeedleHighlights] = useState(true);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Load Image into Canvas
  useEffect(() => {
    setImageLoaded(false);
    const img = new Image();
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      img.crossOrigin = "anonymous";
    }

    img.onload = () => {
      imageObjRef.current = img;
      setImageLoaded(true);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };

    img.onerror = () => {
      img.onerror = null;
      if (img.src !== DEFAULT_TACHOGRAPH_DISC_DATA_URL) {
        img.removeAttribute("crossorigin");
        img.src = DEFAULT_TACHOGRAPH_DISC_DATA_URL;
      }
    };

    img.src = imageUrl;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl]);

  // Main Canvas Render
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Dark canvas background
    ctx.fillStyle = isInverted ? "#f8fafc" : "#080c12";
    ctx.fillRect(0, 0, width, height);

    ctx.save();

    // Center and transform
    const cx = width / 2 + pan.x;
    const cy = height / 2 + pan.y;
    ctx.translate(cx, cy);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    // Filter inversion
    if (isInverted) {
      ctx.filter = "invert(100%) contrast(140%) brightness(95%)";
    } else {
      ctx.filter = "none";
    }

    // Draw Disc Image
    const img = imageObjRef.current;
    if (img && imageLoaded) {
      const renderSize = Math.min(width, height) * 0.92;
      ctx.drawImage(img, -renderSize / 2, -renderSize / 2, renderSize, renderSize);
    } else {
      // Placeholder while loading
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(width, height) * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.filter = "none";

    // Overlay needle scratch highlight for stop window
    if (showNeedleHighlights && showOverlayMarks && arrival && departure) {
      const startAngle = timeToAngle(arrival);
      const endAngle = timeToAngle(departure);

      if (startAngle !== null && endAngle !== null) {
        const discRadius = Math.min(width, height) * 0.45;
        const arcRadius = discRadius * 0.72;

        ctx.beginPath();
        let adjustedEnd = endAngle;
        if (adjustedEnd < startAngle) adjustedEnd += Math.PI * 2;
        ctx.arc(0, 0, arcRadius, startAngle, adjustedEnd);
        ctx.lineWidth = 14;
        ctx.strokeStyle = isInverted ? "rgba(16, 185, 129, 0.75)" : "rgba(16, 185, 129, 0.65)";
        ctx.lineCap = "round";
        ctx.stroke();

        // Glowing border on arc
        ctx.beginPath();
        ctx.arc(0, 0, arcRadius, startAngle, adjustedEnd);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      }
    }

    ctx.restore();
  }, [
    zoom,
    pan,
    rotation,
    isInverted,
    imageLoaded,
    showNeedleHighlights,
    showOverlayMarks,
    arrival,
    departure,
  ]);

  // Sync canvas size on mount / resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
      drawCanvas();
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawCanvas]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Non-passive native event listeners for smooth zoom & pan
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.88;
      setZoom((z) => Math.min(Math.max(z * factor, 0.5), 5));
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        isDraggingRef.current = true;
        const touch = e.touches[0];
        dragStartRef.current = { x: touch.clientX - pan.x, y: touch.clientY - pan.y };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || e.touches.length !== 1) return;
      e.preventDefault();
      const touch = e.touches[0];
      setPan({
        x: touch.clientX - dragStartRef.current.x,
        y: touch.clientY - dragStartRef.current.y,
      });
    };

    const onTouchEnd = () => {
      isDraggingRef.current = false;
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("touchcancel", onTouchEnd);

    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [pan.x, pan.y]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };

  return (
    <div
      className="relative rounded-2xl border border-[#223246] bg-[#0d141f] overflow-hidden text-slate-200 select-none shadow-md"
      style={{ height }}
    >
      {/* Top Floating Controls Bar */}
      <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5 rounded-xl border border-[#223246]/80 bg-[#131c26]/90 p-1 backdrop-blur-md shadow-xs">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
          title="הגדל זום (+)"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
          title="הקטן זום (-)"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setRotation((r) => (r + 90) % 360)}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
          title="סובב ב-90 מעלות"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setIsInverted((inv) => !inv)}
          className={`p-1.5 rounded-lg transition ${
            isInverted
              ? "bg-[#10b981]/20 text-[#10b981]"
              : "text-slate-300 hover:text-white hover:bg-slate-800"
          }`}
          title="מצב נגטיב / היפוך צבעים לזיהוי חריטות מחט"
        >
          <Sun className="h-3.5 w-3.5" />
        </button>
        {arrival && departure && (
          <button
            type="button"
            onClick={() => setShowNeedleHighlights((h) => !h)}
            className={`p-1.5 rounded-lg transition ${
              showNeedleHighlights
                ? "bg-emerald-500/20 text-emerald-400"
                : "text-slate-400 hover:text-white"
            }`}
            title="הצג/הסתר סימון חלון עצירה באיתוראן על הדיסקית"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={resetView}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
          title="אפס תצוגה"
        >
          <Minimize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Top Left Driver & Vehicle Badge */}
      <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-2 rounded-xl border border-[#223246]/80 bg-[#131c26]/90 px-2.5 py-1 backdrop-blur-md text-[11px]">
        <Activity className="h-3.5 w-3.5 text-[#10b981]" />
        <span className="font-semibold text-slate-100">{driver || "טכוגרף דיסקית"}</span>
        {truck && <span className="font-mono text-slate-400">({truck})</span>}
      </div>

      {/* Interactive HTML5 Canvas */}
      <div
        ref={containerRef}
        className="relative h-full w-full cursor-grab active:cursor-grabbing touch-none overflow-hidden"
        style={{ touchAction: "none" }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="absolute inset-0 block h-full w-full touch-none"
          style={{ touchAction: "none" }}
        />
      </div>

      {/* Bottom Floating Status Bar */}
      <div
        className="absolute bottom-2 inset-x-2 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#223246]/80 bg-[#131c26]/90 px-3 py-1.5 backdrop-blur-md text-[11px] text-slate-300"
        dir="rtl"
      >
        <div className="flex items-center gap-3">
          {kmTotal && (
            <span>
              ק״מ יומי: <strong className="font-mono text-white">{kmTotal}</strong>
            </span>
          )}
          {ptoHours && (
            <span>
              PTO מנוף: <strong className="font-mono text-emerald-400">{ptoHours} שעות</strong>
            </span>
          )}
          {date && <span className="text-slate-400">{date}</span>}
        </div>

        {arrival && departure ? (
          <div className="flex items-center gap-1.5 font-mono text-emerald-400 text-[10px]">
            <Clock className="h-3 w-3" />
            <span>
              חלון פריקה באיתוראן: {arrival} - {departure}
            </span>
          </div>
        ) : (
          <span className="text-slate-500 text-[10px]">גרור להזזה · גלגלת לזום</span>
        )}
      </div>
    </div>
  );
}

export default InteractiveDiscCanvas;
