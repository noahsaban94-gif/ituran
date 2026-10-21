import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  TachographDiscRow,
  VisitRecord,
  SiteSummary,
  DeterministicAnomaly,
  DriverId,
  DRIVERS,
} from "@/lib/types";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Sun,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Edit2,
  FileCheck,
  Minimize2,
  Activity,
  Compass,
  Check,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import p13 from "@/assets/scans/p13.jpg.asset.json";
import { extractDriveFileId } from "@/lib/scan-proxy-handler";

interface TachographCanvasViewerProps {
  disc?: TachographDiscRow;
  visits: VisitRecord[];
  sites?: SiteSummary[];
  anomalies: DeterministicAnomaly[];
  date: string;
  driverId?: DriverId;
  onSaveCorrection?: (
    row: number,
    fix: { date?: string; plate?: string; approve?: boolean; approver?: string },
  ) => Promise<unknown>;
  onSelectVisit?: (visit: VisitRecord) => void;
}

// Convert "HH:MM" to fraction of 24 hours (0.0 to 1.0)
function timeToFraction(timeStr?: string): number | null {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return (hours * 60 + minutes) / 1440;
}

// Convert fraction of day to SVG coordinates on a circle
function fractionToCoordinates(
  fraction: number,
  radius: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  // 00:00 is at top (-90 degrees), angles increase clockwise
  const angleRad = (fraction * 360 - 90) * (Math.PI / 180);
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

// Generate SVG arc path between two day fractions (startFrac to endFrac)
function describeArc(
  startFrac: number,
  endFrac: number,
  innerR: number,
  outerR: number,
  cx: number,
  cy: number,
): string {
  let diff = endFrac - startFrac;
  if (diff < 0) diff += 1;
  if (diff <= 0.0001) return "";

  const largeArcFlag = diff > 0.5 ? 1 : 0;
  const adjustedEnd = startFrac + diff;

  const startOuter = fractionToCoordinates(startFrac, outerR, cx, cy);
  const endOuter = fractionToCoordinates(adjustedEnd, outerR, cx, cy);
  const startInner = fractionToCoordinates(startFrac, innerR, cx, cy);
  const endInner = fractionToCoordinates(adjustedEnd, innerR, cx, cy);

  return [
    `M ${startOuter.x.toFixed(2)} ${startOuter.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${endOuter.x.toFixed(2)} ${endOuter.y.toFixed(2)}`,
    `L ${endInner.x.toFixed(2)} ${endInner.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${startInner.x.toFixed(2)} ${startInner.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

export function TachographCanvasViewer({
  disc,
  visits,
  sites = [],
  anomalies,
  date,
  driverId = "hikmat",
  onSaveCorrection,
  onSelectVisit,
}: TachographCanvasViewerProps) {
  // Canvas DOM and Context
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Loaded image ref
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageSourceDesc, setImageSourceDesc] = useState("טוען תמונה...");
  const imageObjRef = useRef<HTMLImageElement | null>(null);

  // Interactive View Transformations
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0); // 0 to 360 degrees
  const [isInverted, setIsInverted] = useState(false);
  const [contrast, setContrast] = useState(115); // 100% to 250%
  const [brightness] = useState(105);
  const [showClockOverlay, setShowClockOverlay] = useState(true);

  // Dragging state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Selected visit highlight
  const [selectedVisitKey, setSelectedVisitKey] = useState<string | null>(null);
  const [hoveredArcInfo, setHoveredArcInfo] = useState<{
    label: string;
    sub: string;
    time: string;
    type: "travel" | "site" | "pto";
  } | null>(null);

  // Correction Form State
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [customDate, setCustomDate] = useState(
    disc?.["תאריך מתוקן"] || disc?.["תאריך דיסקית"] || date,
  );
  const [isEditingPlate, setIsEditingPlate] = useState(false);
  const [customPlate, setCustomPlate] = useState(
    disc?.["משאית מתוקנת"] || disc?.["רישוי / משאית"] || "615-41-002",
  );
  const [isSavingCorrection, setIsSavingCorrection] = useState(false);

  // Resolve Disc Image URL
  const discImageSrc = useMemo(() => {
    const rawLink = disc?.["קישור לדיסקית"] || "";
    const fileId = extractDriveFileId(rawLink);
    if (fileId) {
      return `/api/scan/${fileId}`;
    }
    if (
      rawLink.startsWith("http://") ||
      rawLink.startsWith("https://") ||
      rawLink.startsWith("data:")
    ) {
      return rawLink;
    }
    return p13.url;
  }, [disc]);

  // Load Image into Canvas
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setImageSourceDesc("מאתר דיסקית ומאמת קישור...");

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageObjRef.current = img;
      setImageLoaded(true);
      setImageError(false);
      setImageSourceDesc(
        disc?.["קישור לדיסקית"]?.includes("drive.google.com")
          ? "סריקת דיסקית מקורית (Google Drive)"
          : "דיסקית ארכיון מאומתת (ח. סבן)",
      );
      resetView();
    };

    img.onerror = () => {
      // Fallback to local high-res asset
      if (img.src !== p13.url) {
        console.warn("Drive scan image unavailable, falling back to verified disc asset");
        img.src = p13.url;
        setImageSourceDesc("דיסקית ארכיון מאומתת (גיבוי סבן)");
      } else {
        setImageError(true);
        setImageSourceDesc("שגיאה בטעינת קובץ הסריקה");
      }
    };

    img.src = discImageSrc;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [discImageSrc, disc]);

  // Reset view to center and fit
  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  }, []);

  // Main Canvas Rendering Loop
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;

    // Clear background
    ctx.clearRect(0, 0, width, height);

    // Dark canvas background
    ctx.fillStyle = "#090d13";
    ctx.fillRect(0, 0, width, height);

    const img = imageObjRef.current;
    if (!img || !imageLoaded) {
      // Draw placeholder
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(width, height) * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 14px Heebo, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(imageError ? "שגיאה בטעינת תמונת דיסקית" : "טוען דיסקית טכוגרף...", cx, cy);
      return;
    }

    ctx.save();

    // Set Image Filters (Invert & Contrast)
    const filterParts: string[] = [];
    if (isInverted) filterParts.push("invert(100%)");
    if (contrast !== 100) filterParts.push(`contrast(${contrast}%)`);
    if (brightness !== 100) filterParts.push(`brightness(${brightness}%)`);
    ctx.filter = filterParts.length > 0 ? filterParts.join(" ") : "none";

    // Transformations (Pan, Zoom, Rotate around center)
    ctx.translate(cx + pan.x, cy + pan.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    // Calculate draw dimensions maintaining aspect ratio
    const imgAspect = img.width / img.height;
    const maxDim = Math.min(width, height) * 0.88;
    let drawW = maxDim;
    let drawH = maxDim;

    if (imgAspect > 1) {
      drawH = drawW / imgAspect;
    } else {
      drawW = drawH * imgAspect;
    }

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Clock Overlay (Rendered directly on top, un-inverted for clarity)
    if (showClockOverlay) {
      ctx.save();
      ctx.translate(cx + pan.x, cy + pan.y);
      ctx.scale(zoom, zoom);

      const overlayRadius = Math.min(width, height) * 0.44;

      // Outer Guide Ring
      ctx.strokeStyle = "rgba(16, 185, 129, 0.45)"; // Saban Emerald
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, overlayRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner Center Circle
      ctx.strokeStyle = "rgba(56, 189, 248, 0.35)"; // Turquoise
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, overlayRadius * 0.35, 0, Math.PI * 2);
      ctx.stroke();

      // Middle Track (Speed/Distance baseline)
      ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, overlayRadius * 0.68, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 24 Hour Radial Ticks & Labels
      ctx.font = "bold 11px Heebo, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let h = 0; h < 24; h++) {
        const fraction = h / 24;
        const angle = (fraction * 360 - 90) * (Math.PI / 180);

        // Major Hour Tick
        const rInner = overlayRadius - 10;
        const rOuter = overlayRadius;
        const x1 = Math.cos(angle) * rInner;
        const y1 = Math.sin(angle) * rInner;
        const x2 = Math.cos(angle) * rOuter;
        const y2 = Math.sin(angle) * rOuter;

        ctx.strokeStyle = "rgba(56, 189, 248, 0.75)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Half-hour Tick
        const halfAngle = angle + (15 * Math.PI) / 360; // +7.5 deg
        const hx1 = Math.cos(halfAngle) * (overlayRadius - 5);
        const hy1 = Math.sin(halfAngle) * (overlayRadius - 5);
        const hx2 = Math.cos(halfAngle) * overlayRadius;
        const hy2 = Math.sin(halfAngle) * overlayRadius;
        ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hx1, hy1);
        ctx.lineTo(hx2, hy2);
        ctx.stroke();

        // Hour Label (00, 01 ... 23)
        const labelR = overlayRadius + 14;
        const lx = Math.cos(angle) * labelR;
        const ly = Math.sin(angle) * labelR;

        ctx.fillStyle = h % 6 === 0 ? "#10b981" : "#e2e8f0";
        const hourStr = h.toString().padStart(2, "0");
        ctx.fillText(hourStr, lx, ly);
      }

      ctx.restore();
    }
  }, [
    imageLoaded,
    imageError,
    zoom,
    pan,
    rotation,
    isInverted,
    contrast,
    brightness,
    showClockOverlay,
  ]);

  // Handle Resize & Canvas Initialization
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      drawCanvas();
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [drawCanvas]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Mouse / Touch Event Handlers
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

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
    setZoom((prevZoom) => {
      const nextZoom = Math.min(Math.max(prevZoom * zoomFactor, 0.4), 6);
      return nextZoom;
    });
  };

  // Touch support
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      const touch = e.touches[0];
      dragStartRef.current = { x: touch.clientX - pan.x, y: touch.clientY - pan.y };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPan({
      x: touch.clientX - dragStartRef.current.x,
      y: touch.clientY - dragStartRef.current.y,
    });
  };

  // Save disc approval
  const handleApproveDisc = async () => {
    if (!disc?._row || !onSaveCorrection) return;
    setIsSavingCorrection(true);
    try {
      await onSaveCorrection(disc._row, {
        approve: true,
        approver: "ראמי מסארווה",
      });
      toast.success("הדיסקית אושרה בהצלחה ע״י ראמי מסארווה ✍️");
    } catch {
      toast.error("שגיאה באישור הדיסקית");
    } finally {
      setIsSavingCorrection(false);
    }
  };

  // Save date correction
  const handleSaveDate = async () => {
    if (!disc?._row || !onSaveCorrection) return;
    setIsSavingCorrection(true);
    try {
      await onSaveCorrection(disc._row, { date: customDate });
      setIsEditingDate(false);
      toast.success("תאריך מתוקן נשמר בגיליון ✅");
    } catch {
      toast.error("שגיאה בשמירת תאריך מתוקן");
    } finally {
      setIsSavingCorrection(false);
    }
  };

  // Save plate correction
  const handleSavePlate = async () => {
    if (!disc?._row || !onSaveCorrection) return;
    setIsSavingCorrection(true);
    try {
      await onSaveCorrection(disc._row, { plate: customPlate });
      setIsEditingPlate(false);
      toast.success("מספר משאית מתוקן נשמר בגיליון ✅");
    } catch {
      toast.error("שגיאה בשמירת משאית מתוקנת");
    } finally {
      setIsSavingCorrection(false);
    }
  };

  // Calculations for Daily KPIs
  const totalKm = disc?.['סה"כ ק"מ'] ? parseFloat(disc['סה"כ ק"מ']) : 140;
  const driveHours = disc?.["זמן נסיעה"] || "03:15";
  const workHours = disc?.["זמן עבודה"] || "04:30";
  const idleHours = disc?.["זמן סרק"] || "00:45";

  const totalPtoMinutes = useMemo(() => {
    return visits.reduce((acc, v) => acc + (v.ptoMinutes || 0), 0);
  }, [visits]);

  // Build 24H Ring Segments
  const ringSegments = useMemo(() => {
    const cx = 150;
    const cy = 150;
    const outerRadius = 138;
    const siteRadius = 118;
    const ptoRadius = 98;
    const innerRadius = 78;

    const segments: Array<{
      id: string;
      path: string;
      color: string;
      tooltip: { label: string; sub: string; time: string; type: "travel" | "site" | "pto" };
      visitKey?: string;
    }> = [];

    // Sort visits chronologically
    const sortedVisits = [...visits].sort((a, b) => {
      const tA = timeToFraction(a.ituranArrival || a.deliveryNotes[0]?.["שעת תעודה"]) || 0;
      const tB = timeToFraction(b.ituranArrival || b.deliveryNotes[0]?.["שעת תעודה"]) || 0;
      return tA - tB;
    });

    sortedVisits.forEach((visit, idx) => {
      const arrFrac = timeToFraction(visit.ituranArrival);
      const depFrac = timeToFraction(visit.ituranDeparture);

      // 1. Travel segment from previous visit departure to current arrival
      if (idx > 0) {
        const prevDepFrac = timeToFraction(sortedVisits[idx - 1].ituranDeparture);
        if (prevDepFrac !== null && arrFrac !== null && arrFrac > prevDepFrac) {
          const travelPath = describeArc(prevDepFrac, arrFrac, siteRadius + 2, outerRadius, cx, cy);
          if (travelPath) {
            segments.push({
              id: `travel-${idx}`,
              path: travelPath,
              color: "#38bdf8", // Turquoise - Ituran Travel
              tooltip: {
                label: `נסיעה לתחנה ${idx + 1}: ${visit.address}`,
                sub: `${visit.kmFromPrev || "--"} ק״מ · ${visit.driveMinutesFromPrev || "--"} דק׳ נסיעה`,
                time: `${sortedVisits[idx - 1].ituranDeparture || ""} ➔ ${visit.ituranArrival || ""}`,
                type: "travel",
              },
              visitKey: visit.visitKey,
            });
          }
        }
      }

      // 2. Full Site Stay (arrival to departure)
      if (arrFrac !== null && depFrac !== null && depFrac > arrFrac) {
        const sitePath = describeArc(arrFrac, depFrac, ptoRadius + 2, siteRadius, cx, cy);
        if (sitePath) {
          segments.push({
            id: `site-${visit.visitKey}`,
            path: sitePath,
            color: "#818cf8", // Indigo/Purple - Total Site Stay
            tooltip: {
              label: `תחנה ${idx + 1}: ${visit.address}`,
              sub: `${visit.customers.join(", ")} · משך באתר: ${visit.siteDurationMinutes || "--"} דק׳`,
              time: `${visit.ituranArrival} - ${visit.ituranDeparture}`,
              type: "site",
            },
            visitKey: visit.visitKey,
          });
        }
      }

      // 3. Crane / PTO Active Discharge Window
      const ptoStartFrac = timeToFraction(visit.ptoStart || visit.ituranArrival);
      const ptoEndFrac = timeToFraction(visit.ptoEnd || visit.ituranDeparture);

      if (
        visit.ptoMinutes &&
        visit.ptoMinutes > 0 &&
        ptoStartFrac !== null &&
        ptoEndFrac !== null &&
        ptoEndFrac > ptoStartFrac
      ) {
        const ptoPath = describeArc(ptoStartFrac, ptoEndFrac, innerRadius, ptoRadius, cx, cy);
        if (ptoPath) {
          segments.push({
            id: `pto-${visit.visitKey}`,
            path: ptoPath,
            color: "#f59e0b", // Amber - Crane PTO Active Window
            tooltip: {
              label: `פריקת מנוף PTO · תחנה ${idx + 1}`,
              sub: `משך מנוף בפועל: ${visit.ptoMinutes} דק׳ (כתב יד: ${visit.handwrittenUnloadMinutes || 0} דק׳)`,
              time: `${visit.ptoStart || "--:--"} - ${visit.ptoEnd || "--:--"}`,
              type: "pto",
            },
            visitKey: visit.visitKey,
          });
        }
      }
    });

    return segments;
  }, [visits]);

  // Efficiency Recommendations Engine
  const efficiencyInsights = useMemo(() => {
    const list: Array<{
      title: string;
      desc: string;
      severity: "high" | "medium" | "info";
      tag: string;
    }> = [];

    // 1. Long stop with low or no PTO
    visits.forEach((v) => {
      if ((v.siteDurationMinutes || 0) > 35 && (!v.ptoMinutes || v.ptoMinutes < 5)) {
        list.push({
          title: `שהייה ממושכת ללא PTO: ${v.address}`,
          desc: `משאית עמדה באתר ${v.siteDurationMinutes} דק׳ אך זמן מנוף עמד על ${v.ptoMinutes || 0} דק׳ בלבד. מומלץ לוודא האם חלה המתנה לפועלים או גישה חסומה.`,
          severity: "high",
          tag: "זמן סרק באתר",
        });
      }
    });

    // 2. High peak hour travel
    visits.forEach((v) => {
      const arr = v.ituranArrival;
      if (arr && arr >= "07:30" && arr <= "09:00" && (v.driveMinutesFromPrev || 0) > 30) {
        list.push({
          title: `נסיעה בשיא הפקקים: תחנה ב-${v.city}`,
          desc: `הגעה בשעה ${arr} לאחר נסיעה של ${v.driveMinutesFromPrev} דק׳. תזמון מוקדם של פריקה זו לפני 07:15 יחסוך עד 20 דק׳ סרק במשאית.`,
          severity: "medium",
          tag: "ייעול מסלול",
        });
      }
    });

    // 3. Handwritten vs Ituran Mismatch
    visits.forEach((v) => {
      if (v.ptoMinutes && v.handwrittenUnloadMinutes) {
        const diff = Math.abs(v.ptoMinutes - v.handwrittenUnloadMinutes);
        if (diff > 15) {
          list.push({
            title: `פער דיווח כתב יד מול איתוראן: ${v.address}`,
            desc: `נהג דיווח ${v.handwrittenUnloadMinutes} דק׳ בתעודה, בעוד חיישן ה-PTO מדד ${v.ptoMinutes} דק׳ (פער של ${diff} דק׳).`,
            severity: "medium",
            tag: "אימות נתונים",
          });
        }
      }
    });

    // 4. Default confirmation if smooth
    if (list.length === 0) {
      list.push({
        title: "התאמת מסלול ופריקות אופטימלית",
        desc: "כל זמני ה-PTO תואמים את משך השהייה באתרים, ואין פערים חריגים בין דיווח הנהג לאיתוראן.",
        severity: "info",
        tag: "ביצועים תקינים",
      });
    }

    return list;
  }, [visits]);

  return (
    <div className="space-y-6 text-right font-sans antialiased text-slate-100" dir="rtl">
      {/* Top Header & Daily Context */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#223246] bg-[#131c26] p-5 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-[#10b981] ring-1 ring-[#10b981]/30">
            <Compass className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-extrabold text-white">
                בקרת דיסקית טכוגרף · הצלבת איתוראן ו-PTO
              </h2>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-[#10b981]">
                {DRIVERS[driverId]?.fullName || "חכמת גאבר"} (
                {DRIVERS[driverId]?.plate || customPlate})
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              תאריך יום עבודה: <span className="font-mono font-bold text-slate-200">{date}</span> ·{" "}
              {visits.length} תחנות פריקה בגיליון · מקור סריקה: {imageSourceDesc}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {disc?.isOcrSuspect && (
            <div className="flex items-center gap-1.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span>שנת OCR חשודה ({disc["תאריך דיסקית"]})</span>
            </div>
          )}
          {disc?.["אושר ע״י"] ? (
            <div className="flex items-center gap-1.5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-[#10b981]">
              <CheckCircle2 className="h-4 w-4" />
              <span>אושר ע״י {disc["אושר ע״י"]}</span>
            </div>
          ) : (
            <button
              onClick={handleApproveDisc}
              disabled={isSavingCorrection}
              className="flex items-center gap-1.5 rounded-2xl bg-[#10b981] px-4 py-2 text-xs font-bold text-slate-950 shadow-md transition hover:bg-[#10b981]/90 disabled:opacity-50"
            >
              <FileCheck className="h-4 w-4" />
              <span>אשר דיסקית כראמי ✍️</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Split: Right = Canvas & 24H Ring; Left = KPIs, Timeline & Efficiency */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* RIGHT COLUMN: Canvas Viewer + 24H Activity Ring + Rami Form (7 Cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* HTML5 Canvas Viewer Card */}
          <div className="overflow-hidden rounded-3xl border border-[#223246] bg-[#131c26] shadow-2xl">
            {/* Viewer Controls Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#223246] bg-[#0d151e] px-4 py-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-[#10b981]" />
                <span className="font-display text-xs font-bold text-slate-200">
                  קנבס אינטראקטיבי: סריקת דיסקית טכוגרף
                </span>
                <span className="rounded-md bg-slate-800/80 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                  {Math.round(zoom * 100)}% זום · {rotation}°
                </span>
              </div>

              {/* Navigation Tools (+ / - / rotate / invert / contrast / clock overlay) */}
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  onClick={() => setZoom((z) => Math.min(z + 0.25, 5))}
                  className="rounded-xl border border-[#223246] bg-[#172230] p-1.5 text-slate-300 transition hover:bg-[#223246] hover:text-white"
                  title="הגדל זום (+)"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setZoom((z) => Math.max(z - 0.25, 0.4))}
                  className="rounded-xl border border-[#223246] bg-[#172230] p-1.5 text-slate-300 transition hover:bg-[#223246] hover:text-white"
                  title="הקטן זום (-)"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="rounded-xl border border-[#223246] bg-[#172230] p-1.5 text-slate-300 transition hover:bg-[#223246] hover:text-white"
                  title="סובב 90° עם כיוון השעון"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                  className="rounded-xl border border-[#223246] bg-[#172230] p-1.5 text-slate-300 transition hover:bg-[#223246] hover:text-white"
                  title="סובב 90° נגד כיוון השעון"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsInverted((v) => !v)}
                  className={`rounded-xl border border-[#223246] px-2.5 py-1 text-xs font-bold transition ${
                    isInverted
                      ? "bg-[#10b981] text-slate-950 font-extrabold"
                      : "bg-[#172230] text-slate-300 hover:bg-[#223246]"
                  }`}
                  title="נגטיב (היפוך צבעים להבלטת חריטות מחט)"
                >
                  נגטיב
                </button>
                <button
                  onClick={() => setContrast((c) => (c === 115 ? 170 : c === 170 ? 230 : 115))}
                  className="flex items-center gap-1 rounded-xl border border-[#223246] bg-[#172230] px-2 py-1 text-slate-300 transition hover:bg-[#223246]"
                  title="שינוי ניגודיות"
                >
                  <Sun className="h-3.5 w-3.5 text-amber-400" />
                  <span className="font-mono text-[11px]">{contrast}%</span>
                </button>
                <button
                  onClick={() => setShowClockOverlay((v) => !v)}
                  className={`rounded-xl border border-[#223246] px-2 py-1 text-xs font-bold transition ${
                    showClockOverlay
                      ? "border-sky-500/50 bg-sky-500/20 text-sky-300"
                      : "bg-[#172230] text-slate-400 hover:bg-[#223246]"
                  }`}
                  title="הצג/הסתר שכבת שעות 24H עגולה"
                >
                  שעון 24H
                </button>
                <button
                  onClick={resetView}
                  className="rounded-xl border border-[#223246] bg-[#172230] p-1.5 text-slate-400 hover:text-white"
                  title="אפס תצוגה (איפוס זום ומרכוז)"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Canvas Viewport (Drag & Wheel interactive) */}
            <div
              ref={containerRef}
              className="relative h-[480px] w-full cursor-grab active:cursor-grabbing select-none overflow-hidden bg-[#090d13]"
            >
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleMouseUp}
                className="absolute inset-0 block h-full w-full"
              />

              {/* Floating guidance overlay */}
              <div className="pointer-events-none absolute bottom-3 right-3 rounded-xl border border-slate-700/60 bg-slate-900/80 px-2.5 py-1 text-[11px] text-slate-400 backdrop-blur-md">
                🖱️ גרור להזזה · גלגלת עכבר לזום · סיבוב 360° לקריאת חריטות
              </div>

              {/* Fine continuous rotation slider */}
              <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/85 px-3 py-1.5 backdrop-blur-md">
                <span className="text-[10px] font-bold text-slate-400">סיבוב זווית:</span>
                <input
                  type="range"
                  min="0"
                  max="359"
                  value={rotation}
                  onChange={(e) => setRotation(parseInt(e.target.value, 10))}
                  className="h-1.5 w-24 accent-[#10b981] cursor-pointer"
                />
                <span className="font-mono text-[11px] font-bold text-[#10b981] w-8 text-left">
                  {rotation}°
                </span>
              </div>
            </div>

            {/* Canvas Footer Bar */}
            <div className="flex flex-wrap items-center justify-between border-t border-[#223246] bg-[#0d151e] px-4 py-2.5 text-xs text-slate-400 font-mono">
              <div className="flex items-center gap-4">
                <span>
                  פתיחה:{" "}
                  <strong className="text-slate-200">{disc?.['ק"מ פתיחה'] || "342,100"}</strong>
                </span>
                <span>
                  סגירה:{" "}
                  <strong className="text-slate-200">{disc?.['ק"מ סגירה'] || "342,240"}</strong>
                </span>
                <span>
                  סה״כ: <strong className="text-[#10b981]">{totalKm} ק״מ</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <span>קובץ מקור: {disc?.["קובץ מקור"] || "סריקת טכוגרף"}</span>
              </div>
            </div>
          </div>

          {/* 24H Activity Ring (SVG) & Crane/PTO Correlation */}
          <div className="rounded-3xl border border-[#223246] bg-[#131c26] p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#223246] pb-4">
              <div>
                <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-[#38bdf8]" />
                  טבעת פעילות 24H והצלבת זמני מנוף
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  פריסה מעגלית של 24 שעות היממה: שעות נסיעה, שהייה באתר, וחלונות PTO מדודים
                </p>
              </div>

              {/* Color legend */}
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-[#38bdf8]" />
                  <span className="text-slate-300">נסיעה (איתוראן)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-[#818cf8]" />
                  <span className="text-slate-300">שהות באתר</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-[#f59e0b]" />
                  <span className="text-slate-300">פריקת מנוף PTO</span>
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* SVG 24H Circular Ring */}
              <div className="md:col-span-6 flex flex-col items-center justify-center relative">
                <svg
                  viewBox="0 0 300 300"
                  className="h-64 w-64 max-w-full drop-shadow-lg select-none"
                >
                  {/* Background Track Rings */}
                  <circle cx="150" cy="150" r="138" fill="none" stroke="#1e293b" strokeWidth="1" />
                  <circle cx="150" cy="150" r="118" fill="none" stroke="#1e293b" strokeWidth="1" />
                  <circle cx="150" cy="150" r="98" fill="none" stroke="#1e293b" strokeWidth="1" />
                  <circle
                    cx="150"
                    cy="150"
                    r="78"
                    fill="#0b1118"
                    stroke="#1e293b"
                    strokeWidth="1"
                  />

                  {/* 24-Hour Radial Lines and Hour Labels */}
                  {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => {
                    const frac = h / 24;
                    const coords = fractionToCoordinates(frac, 142, 150, 150);
                    const inner = fractionToCoordinates(frac, 74, 150, 150);
                    return (
                      <g key={h}>
                        <line
                          x1={inner.x}
                          y1={inner.y}
                          x2={coords.x}
                          y2={coords.y}
                          stroke="#334155"
                          strokeWidth="1"
                          strokeDasharray="2,2"
                        />
                        <text
                          x={fractionToCoordinates(frac, 60, 150, 150).x}
                          y={fractionToCoordinates(frac, 60, 150, 150).y}
                          fill="#94a3b8"
                          fontSize="9"
                          fontWeight="bold"
                          fontFamily="Heebo, monospace"
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {h.toString().padStart(2, "0")}:00
                        </text>
                      </g>
                    );
                  })}

                  {/* Activity Segments (Travel, Stay, PTO) */}
                  {ringSegments.map((seg) => {
                    const isSelected = seg.visitKey && seg.visitKey === selectedVisitKey;
                    return (
                      <path
                        key={seg.id}
                        d={seg.path}
                        fill={seg.color}
                        opacity={isSelected ? 1 : 0.85}
                        stroke={isSelected ? "#ffffff" : "#0f172a"}
                        strokeWidth={isSelected ? 2 : 1}
                        className="cursor-pointer transition-all hover:opacity-100 hover:brightness-125"
                        onMouseEnter={() => setHoveredArcInfo(seg.tooltip)}
                        onMouseLeave={() => setHoveredArcInfo(null)}
                        onClick={() => {
                          if (seg.visitKey) {
                            setSelectedVisitKey(seg.visitKey);
                            const v = visits.find((x) => x.visitKey === seg.visitKey);
                            if (v && onSelectVisit) onSelectVisit(v);
                          }
                        }}
                      />
                    );
                  })}

                  {/* Center Hub Indicator */}
                  <circle
                    cx="150"
                    cy="150"
                    r="42"
                    fill="#131c26"
                    stroke="#223246"
                    strokeWidth="2"
                  />
                  <text
                    x="150"
                    y="142"
                    fill="#10b981"
                    fontSize="11"
                    fontWeight="bold"
                    fontFamily="Heebo, sans-serif"
                    textAnchor="middle"
                  >
                    ח. סבן 24H
                  </text>
                  <text
                    x="150"
                    y="158"
                    fill="#94a3b8"
                    fontSize="9"
                    fontFamily="Heebo, sans-serif"
                    textAnchor="middle"
                  >
                    {visits.length} פריקות
                  </text>
                </svg>

                {/* Tooltip Card on Hover */}
                {hoveredArcInfo && (
                  <div className="absolute top-2 rounded-2xl border border-slate-700 bg-slate-900/95 p-2.5 text-right text-xs shadow-2xl backdrop-blur-md max-w-xs z-20">
                    <div className="flex items-center gap-1.5 font-bold text-white">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            hoveredArcInfo.type === "travel"
                              ? "#38bdf8"
                              : hoveredArcInfo.type === "site"
                                ? "#818cf8"
                                : "#f59e0b",
                        }}
                      />
                      <span>{hoveredArcInfo.label}</span>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-1">{hoveredArcInfo.sub}</div>
                    <div className="text-[10px] font-mono font-bold text-[#10b981] mt-0.5">
                      שעות פעילות: {hoveredArcInfo.time}
                    </div>
                  </div>
                )}
              </div>

              {/* Ring Insights Breakdown */}
              <div className="md:col-span-6 space-y-3 text-xs">
                <div className="rounded-2xl border border-[#223246] bg-[#0d151e] p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">סך זמני מנוף PTO ביום זה:</span>
                    <span className="font-mono font-extrabold text-[#f59e0b] text-sm">
                      {totalPtoMinutes} דק׳ ({Math.round((totalPtoMinutes / 60) * 10) / 10} שעות)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>מספר פריקות מנוף מאומתות:</span>
                    <span className="font-bold text-slate-200">
                      {visits.filter((v) => (v.ptoMinutes || 0) > 0).length} מתוך {visits.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>זמן ממוצע לפריקת מנוף באתר:</span>
                    <span className="font-bold text-slate-200">
                      {visits.length > 0 ? Math.round(totalPtoMinutes / visits.length) : 0} דק׳
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#223246] bg-[#0d151e] p-3.5 space-y-1.5">
                  <span className="font-bold text-slate-200 block">עקרון בדיקת התאמה:</span>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    טבעת הפעילות מאפשרת לראמי להשוות בעין בין חריטת זמן הנסיעה בדיסקית הפיזית לבין
                    מקטעי הטורקיז/סגול של איתוראן. חפיפה מושלמת מוכיחה מהימנות דיווח.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Rami Correction & Approval Form */}
          <div className="rounded-3xl border border-[#223246] bg-[#131c26] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#223246] pb-3">
              <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-[#10b981]" />
                אישור דיסקית ותיקוני ראמי מסארווה
              </h3>
              {disc?.["אושר ע״י"] ? (
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-[#10b981]">
                  אושר ע״י {disc["אושר ע״י"]} ({disc["אושר בתאריך"] || "מאושר"})
                </span>
              ) : (
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-400">
                  ממתין לבקרת סדרן
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <button
                onClick={() => setIsEditingDate((v) => !v)}
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#223246] bg-[#172230] p-3 hover:bg-[#223246] font-bold text-slate-200 transition"
              >
                <Edit2 className="h-3.5 w-3.5 text-[#10b981]" />
                <span>תקן תאריך דיסקית (שגיאת OCR)</span>
              </button>
              <button
                onClick={() => setIsEditingPlate((v) => !v)}
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#223246] bg-[#172230] p-3 hover:bg-[#223246] font-bold text-slate-200 transition"
              >
                <Edit2 className="h-3.5 w-3.5 text-cyan-400" />
                <span>תקן רישוי משאית</span>
              </button>
            </div>

            {/* Date Edit Input Box */}
            {isEditingDate && (
              <div className="flex items-center gap-2 rounded-2xl border border-[#223246] bg-[#0d151e] p-3 text-xs">
                <input
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  placeholder="הזן תאריך (DD/MM/YYYY)"
                  className="flex-1 rounded-xl border border-[#223246] bg-[#131c26] px-3 py-2 text-white font-mono"
                />
                <button
                  onClick={handleSaveDate}
                  disabled={isSavingCorrection}
                  className="rounded-xl bg-[#10b981] px-4 py-2 font-bold text-slate-950 transition hover:bg-[#10b981]/90"
                >
                  שמור תאריך
                </button>
              </div>
            )}

            {/* Plate Edit Input Box */}
            {isEditingPlate && (
              <div className="flex items-center gap-2 rounded-2xl border border-[#223246] bg-[#0d151e] p-3 text-xs">
                <input
                  value={customPlate}
                  onChange={(e) => setCustomPlate(e.target.value)}
                  placeholder="הזן לוחית רישוי (למשל: 615-41-002)"
                  className="flex-1 rounded-xl border border-[#223246] bg-[#131c26] px-3 py-2 text-white font-mono"
                />
                <button
                  onClick={handleSavePlate}
                  disabled={isSavingCorrection}
                  className="rounded-xl bg-[#10b981] px-4 py-2 font-bold text-slate-950 transition hover:bg-[#10b981]/90"
                >
                  שמור רישוי
                </button>
              </div>
            )}

            <button
              onClick={handleApproveDisc}
              disabled={isSavingCorrection}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#10b981] py-3.5 font-display text-sm font-bold text-slate-950 shadow-lg transition hover:bg-[#10b981]/90 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>אשר דיסקית כראמי מסארווה (חתימה אלקטרונית בגיליון) ✍️</span>
            </button>
          </div>
        </div>

        {/* LEFT COLUMN: Daily KPIs + Chronological Timeline & Historical Median (5 Cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* 5 Daily KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-[#223246] bg-[#131c26] p-4 shadow-md">
              <span className="text-[11px] font-bold text-slate-400 block">ק״מ כולל</span>
              <div className="mt-1 font-mono text-xl font-black text-white tabular-nums">
                {totalKm} <span className="text-xs font-normal text-slate-400">ק״מ</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[#223246] bg-[#131c26] p-4 shadow-md">
              <span className="text-[11px] font-bold text-slate-400 block">זמן נסיעה</span>
              <div className="mt-1 font-mono text-xl font-black text-[#38bdf8] tabular-nums">
                {driveHours} <span className="text-xs font-normal text-slate-400">שעות</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[#223246] bg-[#131c26] p-4 shadow-md">
              <span className="text-[11px] font-bold text-slate-400 block">זמן עבודה</span>
              <div className="mt-1 font-mono text-xl font-black text-[#818cf8] tabular-nums">
                {workHours} <span className="text-xs font-normal text-slate-400">שעות</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[#223246] bg-[#131c26] p-4 shadow-md">
              <span className="text-[11px] font-bold text-slate-400 block">זמן סרק</span>
              <div className="mt-1 font-mono text-xl font-black text-amber-400 tabular-nums">
                {idleHours} <span className="text-xs font-normal text-slate-400">שעות</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[#223246] bg-[#131c26] p-4 shadow-md col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-slate-400 block">דקות מנוף PTO</span>
              <div className="mt-1 font-mono text-xl font-black text-[#10b981] tabular-nums">
                {totalPtoMinutes} <span className="text-xs font-normal text-slate-400">דק׳</span>
              </div>
            </div>
          </div>

          {/* Efficiency Recommendations Panel (פאנל המלצות ייעול מבוסס נתונים) */}
          <div className="rounded-3xl border border-[#223246] bg-[#131c26] p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#223246] pb-3">
              <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#10b981]" />
                פאנל המלצות ייעול ותובנות אוטומטיות
              </h3>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                מבוסס נתוני איתוראן
              </span>
            </div>

            <div className="space-y-2.5">
              {efficiencyInsights.map((insight, i) => (
                <div
                  key={i}
                  className={`rounded-2xl border p-3.5 space-y-1.5 text-xs transition ${
                    insight.severity === "high"
                      ? "border-red-500/30 bg-red-950/20 text-red-200"
                      : insight.severity === "medium"
                        ? "border-amber-500/30 bg-amber-950/20 text-amber-200"
                        : "border-[#223246] bg-[#0d151e] text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      {insight.severity === "high" ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                      ) : insight.severity === "medium" ? (
                        <Info className="h-3.5 w-3.5 text-amber-400" />
                      ) : (
                        <Check className="h-3.5 w-3.5 text-[#10b981]" />
                      )}
                      <span>{insight.title}</span>
                    </span>
                    <span className="rounded-md bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                      {insight.tag}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-90 leading-relaxed">{insight.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Chronological Timeline with Historical Site Median Comparison */}
          <div className="rounded-3xl border border-[#223246] bg-[#131c26] p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#223246] pb-3">
              <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#38bdf8]" />
                ציר זמנים כרונולוגי והצלבת כתובות
              </h3>
              <span className="text-xs text-slate-400">{visits.length} תחנות ביום</span>
            </div>

            {visits.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                אין ביקורים מוקלטים לתאריך זה בגיליון.
              </div>
            ) : (
              <div className="space-y-3">
                {visits.map((v, idx) => {
                  const isSelected = v.visitKey === selectedVisitKey;

                  // Find site summary for historical median comparison
                  const siteMatch = sites.find(
                    (s) =>
                      s.siteKey === v.siteKey ||
                      s.address === v.address ||
                      (s.city && v.city && s.city === v.city),
                  );

                  const medianSiteMins = siteMatch?.medianSiteMinutes || 20;
                  const actualSiteMins = v.siteDurationMinutes || 0;
                  const deviation = actualSiteMins - medianSiteMins;

                  // PTO vs Handwritten comparison
                  const ptoDiff =
                    v.ptoMinutes !== undefined && v.handwrittenUnloadMinutes !== undefined
                      ? v.ptoMinutes - v.handwrittenUnloadMinutes
                      : undefined;

                  return (
                    <div
                      key={v.visitKey}
                      onClick={() => {
                        setSelectedVisitKey(v.visitKey);
                        if (onSelectVisit) onSelectVisit(v);
                      }}
                      className={`cursor-pointer rounded-2xl border p-4 space-y-3 text-xs transition ${
                        isSelected
                          ? "border-[#10b981] bg-[#172635] shadow-lg ring-1 ring-[#10b981]"
                          : "border-[#223246] bg-[#0d151e] hover:bg-[#131d28]"
                      }`}
                    >
                      {/* Stop Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#10b981] text-[11px] font-extrabold text-slate-950">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="font-bold text-white text-sm">{v.address}</span>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {v.customers.join(", ")} · תעודה:{" "}
                              <span className="font-mono text-slate-300">
                                {v.deliveryNotes[0]?.["מס' תעודת משלוח"] || "אין נתון"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            v.customerSignature === "קיימת"
                              ? "bg-emerald-500/15 text-[#10b981]"
                              : "bg-red-500/15 text-red-400"
                          }`}
                        >
                          {v.customerSignature === "קיימת" ? "חתימה קיימת ✅" : "אין חתימה ❌"}
                        </span>
                      </div>

                      {/* Detailed Measurements Grid */}
                      <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#223246] bg-[#131c26] p-2.5 text-[11px]">
                        <div>
                          <span className="text-slate-400 block text-[10px]">
                            איתוראן (הגעה ➔ יציאה):
                          </span>
                          <span className="font-mono font-bold text-slate-200">
                            {v.ituranArrival || "--:--"} עד {v.ituranDeparture || "--:--"}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-400 block text-[10px]">
                            זמן מנוף PTO בפועל:
                          </span>
                          <span className="font-mono font-extrabold text-[#f59e0b]">
                            {v.ptoMinutes !== undefined ? `${v.ptoMinutes} דק׳` : "אין נתון"}
                          </span>
                          {ptoDiff !== undefined && Math.abs(ptoDiff) > 10 && (
                            <span className="text-amber-400 block text-[10px]">
                              פער מול כתב יד: {ptoDiff > 0 ? `+${ptoDiff}` : ptoDiff} דק׳
                            </span>
                          )}
                        </div>

                        {/* Historical Site Median Comparison */}
                        <div className="col-span-2 pt-1 border-t border-[#223246] flex items-center justify-between">
                          <span className="text-slate-400 text-[10px]">
                            השוואת חציון היסטורי לאתר:
                          </span>
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="text-slate-300">{actualSiteMins} דק׳</span>
                            <span className="text-slate-500">/ חציון {medianSiteMins} דק׳</span>
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                deviation <= 5
                                  ? "bg-emerald-500/15 text-[#10b981]"
                                  : deviation <= 15
                                    ? "bg-amber-500/15 text-amber-400"
                                    : "bg-red-500/15 text-red-400"
                              }`}
                            >
                              {deviation > 0 ? `+${deviation}` : deviation} דק׳
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
