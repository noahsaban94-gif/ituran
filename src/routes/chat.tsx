import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { PageHeader } from "@/components/AppShell";
import noa from "@/assets/noa.jpg";
import { useLogisticsData } from "@/hooks/use-logistics-data";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { InteractiveDiscCanvas } from "@/components/InteractiveDiscCanvas";
import { CrossReferenceInspector } from "@/components/CrossReferenceInspector";
import {
  performClosedLoopCrossReference,
  generateNoahSmartResponse,
  ClosedLoopAnalysis,
  NoahResponsePayload,
} from "@/lib/noah-intelligence";
import { VisitRecord, TachographDiscRow } from "@/lib/types";
import {
  Send,
  CheckCheck,
  Truck,
  FileText,
  Gauge,
  MapPin,
  AlertTriangle,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  ShieldCheck,
  ChevronLeft,
  X,
  Clock,
  Layers,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "נועה AI — חמ״ל לוגיסטי וחיתוך טכוגרף | ח. סבן" },
      {
        name: "description",
        content:
          "חדר מבצעים וצ׳אט בינה תפעולית עם נועה AI עבור ראמי מסארווה. הצלבה סגורה, איתוראן וטכוגרף.",
      },
      { property: "og:title", content: "נועה AI — סדרנית ח. סבן" },
      {
        property: "og:description",
        content: "מערכת הצלבה סגורה, פיצוח תעודות משלוח וניתוח טכוגרף חזותי.",
      },
    ],
  }),
  component: ChatScreen,
});

export interface ChatMessage {
  id: string;
  sender: "noa" | "user";
  text: string;
  time: string;
  tachographData?: NoahResponsePayload["tachographData"];
  crossReferenceData?: ClosedLoopAnalysis;
  suggestedActions?: { label: string; action: string }[];
}

function ChatScreen() {
  const {
    visits,
    discs,
    deliveryNotes,
    sites,
    anomalies,
    diagnosis,
    isLoading,
    isRefetching,
    refetch,
    saveDisc,
  } = useLogisticsData();

  const [input, setInput] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<VisitRecord | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<ClosedLoopAnalysis | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const nowTime = () =>
    new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });

  // Initial welcome message
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-init-1",
      sender: "noa",
      text: `היי ראמי והראל! נועה כאן 🫡
כל נתוני הגיליון, סריקות גליה ומדידות איתוראן מסונכרנים בזמן אמת. 

מנוע **ההצלבה הסגורה (Closed-Loop Engine)** פעיל:
1. חילוץ זמני מנוף בכתב יד מתעודות משלוח Comax.
2. הצלבת חלונות הגעה ועזיבה מלווייני איתוראן ו-PTO.
3. אימות חריטות מחט על גבי קנבס דיסקיות הטכוגרף.
4. איתור פערים, עיכובים וחתימות לקוח חסרות.

במה נתמקד עכשיו?`,
      time: "08:15",
      suggestedActions: [
        { label: "בצע הצלבה סגורה", action: "open_inspector" },
        { label: "דוח חכמת (משאית 615)", action: "query_hikmat" },
        { label: "דוח עלי (משאית 651)", action: "query_ali" },
        { label: "חריגות זמני שהייה", action: "check_anomalies" },
      ],
    },
  ]);

  // Set initial selected visit when data loads
  useEffect(() => {
    if (visits && visits.length > 0 && !selectedVisit) {
      const interestingVisit =
        visits.find((v) => v.hasReversedCraneWindow || (v.ptoMinutes || 0) > 0) || visits[0];
      setSelectedVisit(interestingVisit);
      const relDisc = discs[0];
      if (interestingVisit) {
        setActiveAnalysis(performClosedLoopCrossReference(interestingVisit, relDisc));
      }
    }
  }, [visits, discs, selectedVisit]);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAiThinking]);

  // Handle user sending message
  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || isAiThinking) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text,
      time: nowTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setIsAiThinking(true);

    try {
      // 1. Try server AI endpoint /api/ai/noah-chat if Gemini API key exists
      let aiResult: { reply: string } | null = null;
      try {
        const res = await fetch("/api/ai/noah-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: messages.slice(-5).map((m) => ({ sender: m.sender, text: m.text })),
            contextSummary: `סה״כ ${visits.length} ביקורים היום, ${discs.length} דיסקיות טכוגרף, ${anomalies.length} חריגות מזוהות. חכמת (615-41-002) ועלי (651-51-701).`,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.ok && json.reply) {
            aiResult = json;
          }
        }
      } catch {
        // Fallback to local intelligence
      }

      // 2. Compute rich deterministic response payload (with disc canvas, crossRef, suggested actions)
      const deterministic = generateNoahSmartResponse(text, {
        visits,
        discs,
        deliveryNotes,
        sites,
        anomalies,
      });

      const replyText = aiResult?.reply ? aiResult.reply : deterministic.replyText;

      const noahMsg: ChatMessage = {
        id: `noa-${Date.now()}`,
        sender: "noa",
        text: replyText,
        time: nowTime(),
        tachographData: deterministic.tachographData,
        crossReferenceData: deterministic.crossReferenceData,
        suggestedActions: deterministic.suggestedActions,
      };

      setMessages((prev) => [...prev, noahMsg]);

      // If crossReferenceData exists, update active analysis and open inspector
      if (deterministic.crossReferenceData) {
        setActiveAnalysis(deterministic.crossReferenceData);
        const matched = visits.find(
          (v) => v.visitKey === deterministic.crossReferenceData?.visitKey,
        );
        if (matched) setSelectedVisit(matched);
      }
    } catch (err) {
      toast.error("שגיאה במענה נועה AI");
    } finally {
      setIsAiThinking(false);
    }
  };

  // Handle Action Chip Click
  const handleActionClick = (action: string) => {
    switch (action) {
      case "open_inspector":
        setIsInspectorOpen(true);
        if (!activeAnalysis && visits[0]) {
          const analysis = performClosedLoopCrossReference(visits[0], discs[0]);
          setActiveAnalysis(analysis);
          setSelectedVisit(visits[0]);
        }
        break;
      case "query_hikmat":
        handleSend("מה הסטטוס של דיסקית הטכוגרף והפריקות של חכמת גאבר היום?");
        break;
      case "query_ali":
        handleSend("תציגי דוח פעילות ותעודות משלוח של עלי אבו עידה");
        break;
      case "check_anomalies":
        handleSend("האם יש חריגות זמני שהייה באתרים או פערים בין איתוראן לכתב יד?");
        break;
      case "check_unsigned":
      case "filter_unsigned":
        handleSend("איזה תעודות משלוח נקלטו ללא חתימת לקוח?");
        break;
      case "view_site_visits":
        handleSend("תציגי את כל היסטוריית הפריקות וזמני השהייה באתר הזה");
        break;
      case "zoom_disc":
        setIsInspectorOpen(true);
        break;
      case "open_tacho_canvas":
        setIsInspectorOpen(true);
        break;
      default:
        handleSend(action);
        break;
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: `msg-reset-${Date.now()}`,
        sender: "noa",
        text: "שיחה אופסה. אני מחוברת לגיליון סבן ולאיתוראן וממתינה להנחיותיך ראמי 🫡",
        time: nowTime(),
      },
    ]);
    toast.info("השיחה עם נועה אופסה");
  };

  return (
    <ErrorBoundary fallbackTitle="שגיאה בטעינת מסך הצ׳אט של נועה AI">
      <div className="min-h-screen bg-[#0b1118] text-slate-100 flex flex-col font-sans" dir="rtl">
        {/* Custom Header */}
        <PageHeader
          title="נועה AI — חמ״ל לוגיסטי והצלבה סגורה"
          subtitle="סדרנית אוטונומית לבקרת תעודות משלוח, שעון איתוראן וקנבס דיסקיות טכוגרף"
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsInspectorOpen((open) => !open)}
                className={`flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-bold transition shadow-sm ${
                  isInspectorOpen
                    ? "bg-emerald-600 text-white border-emerald-500"
                    : "bg-[#131c26] text-slate-200 border-[#223246] hover:bg-slate-800"
                }`}
              >
                <SlidersHorizontal className="h-4 w-4 text-[#10b981]" />
                <span>{isInspectorOpen ? "הסתר מפקח" : "פתח מפקח הצלבה"}</span>
                {activeAnalysis && (
                  <span className="font-mono text-[11px] bg-black/40 px-1.5 py-0.5 rounded text-emerald-400">
                    {activeAnalysis.score}%
                  </span>
                )}
              </button>

              <button
                onClick={refetch}
                disabled={isRefetching}
                className="flex items-center gap-1.5 rounded-2xl border border-[#223246] bg-[#131c26] px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-50 transition shadow-sm"
                title="סנכרן נתונים מ-Apps Script"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 text-primary ${isRefetching ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">
                  {isRefetching ? "מסנכרן..." : "רענן מגיליון"}
                </span>
              </button>
            </div>
          }
        />

        {/* Main Content Layout (Split Screen on Large Displays) */}
        <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 flex flex-col lg:flex-row gap-5 overflow-hidden">
          {/* LEFT / MAIN PANEL: WhatsApp-style Intelligent Chat Feed */}
          <div
            className={`flex flex-col rounded-3xl border border-[#223246] bg-[#131c26] shadow-xl overflow-hidden transition-all duration-300 ${
              isInspectorOpen ? "lg:w-7/12" : "w-full max-w-4xl mx-auto"
            }`}
            style={{ height: "calc(100vh - 180px)" }}
          >
            {/* WhatsApp Chat Header */}
            <div className="flex items-center justify-between border-b border-[#223246] bg-[#162230] px-4 py-3 text-white">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={noa}
                    alt="נועה AI"
                    className="h-10 w-10 rounded-full object-cover ring-2 ring-emerald-500/50 shadow-sm"
                  />
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-[#162230]" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-white">נועה AI</span>
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-300">
                    <span>סדרנית לוגיסטיקה חכמה</span>
                    <span>·</span>
                    <span className="text-emerald-400 font-medium">מחוברת לאיתוראן ולגיליון</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={clearChat}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="נקה שיחה"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0a0f16]/90">
              {messages.map((m) => {
                const isUser = m.sender === "user";
                return (
                  <div
                    key={m.id}
                    className={`flex ${isUser ? "justify-start" : "justify-end"} animate-in fade-in duration-150`}
                  >
                    <div
                      className={`max-w-[92%] sm:max-w-[85%] rounded-3xl p-4 text-xs sm:text-sm shadow-md leading-relaxed ${
                        isUser
                          ? "rounded-tr-xs bg-[#059669] text-white"
                          : "rounded-tl-xs bg-[#131c26] border border-[#223246] text-slate-200"
                      }`}
                    >
                      {/* Message Text with formatting */}
                      <div className="whitespace-pre-line leading-relaxed font-sans">{m.text}</div>

                      {/* Embedded Disc Canvas Viewer Component */}
                      {m.tachographData && (
                        <div className="mt-3.5 rounded-2xl border border-[#223246] bg-[#0b1118] p-3 space-y-2.5">
                          <div className="flex items-center justify-between text-xs font-bold text-emerald-400 border-b border-[#223246]/60 pb-2">
                            <div className="flex items-center gap-2">
                              <Gauge className="h-4 w-4" />
                              <span>סריקת דיסקית טכוגרף מקורית ({m.tachographData.driver})</span>
                            </div>
                            <span className="font-mono text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded text-emerald-400">
                              {m.tachographData.truck}
                            </span>
                          </div>

                          <InteractiveDiscCanvas
                            imageUrl={m.tachographData.imageUrl}
                            driver={m.tachographData.driver}
                            truck={m.tachographData.truck}
                            date={m.tachographData.date}
                            kmTotal={m.tachographData.kmTotal}
                            ptoHours={m.tachographData.ptoHours}
                            height={240}
                          />

                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                            <span>זיהוי חריטות מחט: נסיעה רציפה וזמני עבודה</span>
                            <button
                              onClick={() => {
                                setIsInspectorOpen(true);
                                if (m.crossReferenceData) {
                                  setActiveAnalysis(m.crossReferenceData);
                                }
                              }}
                              className="flex items-center gap-1 text-emerald-400 font-bold hover:underline"
                            >
                              <span>פתח מפקח מלא</span>
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Cross-Reference Summary Card */}
                      {m.crossReferenceData && (
                        <div className="mt-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-white">
                            <span className="flex items-center gap-1.5 text-emerald-400">
                              <ShieldCheck className="h-4 w-4" />
                              {m.crossReferenceData.statusText}
                            </span>
                            <span className="font-mono text-emerald-300 font-extrabold">
                              ציון: {m.crossReferenceData.score}%
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            {m.crossReferenceData.summaryText}
                          </p>
                          <div className="flex items-center justify-between pt-1">
                            <button
                              onClick={() => {
                                setIsInspectorOpen(true);
                                setActiveAnalysis(m.crossReferenceData);
                              }}
                              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline"
                            >
                              הצג פירוט 4 השלבים במפקח ➔
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Interactive Suggested Action Chips */}
                      {m.suggestedActions && m.suggestedActions.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-[#223246]/60 flex flex-wrap gap-1.5">
                          {m.suggestedActions.map((act, i) => (
                            <button
                              key={i}
                              onClick={() => handleActionClick(act.action)}
                              className="flex items-center gap-1 rounded-xl border border-[#223246] bg-[#0b1118] px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white hover:border-emerald-500 hover:bg-slate-800 transition shadow-2xs"
                            >
                              <span>{act.label}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Message Footer: Timestamp and Checks */}
                      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-slate-400">
                        <span>{m.time}</span>
                        {isUser && <CheckCheck className="h-3 w-3 text-emerald-200" />}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Thinking Indicator */}
              {isAiThinking && (
                <div className="flex justify-end">
                  <div className="flex items-center gap-2 rounded-2xl border border-[#223246] bg-[#131c26] px-4 py-3 text-xs text-slate-300 shadow-sm animate-pulse">
                    <Sparkles className="h-4 w-4 text-emerald-400 animate-spin" />
                    <span>נועה מעבדת נתוני איתוראן ומצליבה תעודות...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestions Carousel */}
            <div className="flex items-center gap-1.5 overflow-x-auto border-t border-[#223246] bg-[#101823] px-3 py-2 text-xs">
              <button
                onClick={() => handleActionClick("query_hikmat")}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#223246] bg-[#131c26] px-2.5 py-1.5 font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition shadow-2xs"
              >
                <Truck className="h-3 w-3 text-emerald-400" />
                <span>חכמת (615-41-002)</span>
              </button>
              <button
                onClick={() => handleActionClick("query_ali")}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#223246] bg-[#131c26] px-2.5 py-1.5 font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition shadow-2xs"
              >
                <Truck className="h-3 w-3 text-cyan-400" />
                <span>עלי (651-51-701)</span>
              </button>
              <button
                onClick={() => handleSend("בצע הצלבה סגורה מלאה על תחנת הפריקה הנבחרת")}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#223246] bg-[#131c26] px-2.5 py-1.5 font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition shadow-2xs"
              >
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                <span>בצע הצלבה סגורה</span>
              </button>
              <button
                onClick={() => handleSend("תבדקי את זמני הפריקה וההיסטוריה ברקפת 4 הוד השרון")}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#223246] bg-[#131c26] px-2.5 py-1.5 font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition shadow-2xs"
              >
                <MapPin className="h-3 w-3 text-purple-400" />
                <span>רקפת 4, הוד השרון</span>
              </button>
              <button
                onClick={() => handleActionClick("check_anomalies")}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#223246] bg-[#131c26] px-2.5 py-1.5 font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition shadow-2xs"
              >
                <AlertTriangle className="h-3 w-3 text-amber-400" />
                <span>חריגות זמני שהייה</span>
              </button>
              <button
                onClick={() => handleActionClick("check_unsigned")}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#223246] bg-[#131c26] px-2.5 py-1.5 font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition shadow-2xs"
              >
                <FileText className="h-3 w-3 text-red-400" />
                <span>תעודות ללא חתימה</span>
              </button>
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2 border-t border-[#223246] bg-[#131c26] p-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="כתוב הודעה לנועה (שאל על נהג, כתובת אתר, טכוגרף או הצלבת תעודה)..."
                className="flex-1 rounded-2xl border border-[#223246] bg-[#0b1118] px-4 py-3 text-xs sm:text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={!input.trim() || isAiThinking}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-40 shadow-md shrink-0"
                title="שלח הודעה"
              >
                <Send className="h-4 w-4 rotate-180" />
              </button>
            </form>
          </div>

          {/* RIGHT / DRAWER PANEL: The Cross-Reference Inspector */}
          {isInspectorOpen && (
            <div className="lg:w-5/12 flex-1 h-[calc(100vh-180px)] animate-in slide-in-from-left-4 duration-200">
              <CrossReferenceInspector
                analysis={activeAnalysis}
                selectedVisit={selectedVisit}
                visits={visits}
                discs={discs}
                onSelectVisit={(v) => {
                  setSelectedVisit(v);
                  const relDisc =
                    discs.find(
                      (d) =>
                        (d.נהג && d.נהג.includes(v.driverName)) ||
                        (d["רישוי / משאית"] &&
                          d["רישוי / משאית"].includes(v.truckPlate.replace(/\D/g, "").slice(-3))),
                    ) || discs[0];
                  setActiveAnalysis(performClosedLoopCrossReference(v, relDisc));
                }}
                onClose={() => setIsInspectorOpen(false)}
                onSaveCorrection={saveDisc}
              />
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default ChatScreen;
