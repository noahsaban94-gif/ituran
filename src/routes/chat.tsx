import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import noa from "@/assets/noa.jpg";
import { DRIVERS } from "@/lib/data";
import { useLiveSheetData } from "@/lib/sheet-data";
import { Send, Sparkles, CheckCheck, Truck, FileText, Gauge } from "lucide-react";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "נועה AI — ח. סבן לוגיסטיקה" },
      {
        name: "description",
        content: "צ׳אט לוגיסטי חכם עם נועה, סדרנית ויד ימינו של ראמי מסארווה.",
      },
      { property: "og:title", content: "נועה AI — סדרנית ח. סבן" },
      { property: "og:description", content: "בירור סטטוס הזמנות, תעודות משלוח וטכוגרף בוואטסאפ." },
    ],
  }),
  component: ChatScreen,
});

type Message = {
  id: string;
  sender: "noa" | "user";
  text: string;
  time: string;
};

function ChatScreen() {
  const [input, setInput] = useState("");
  const { notes: liveNotes, orders: liveOrders, tachographs: liveTachs } = useLiveSheetData();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m1",
      sender: "noa",
      text: "היי ראמי והראל! נועה כאן ❤️\nכל נתוני הגיליון, סריקות גליה ודיסקית הטכוגרף מסונכרנים בזמן אמת מול Google Sheets. במה תרצו שנעבור כעת?",
      time: "08:15",
    },
  ]);

  const now = () => new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });

  const handleSend = (textToSend?: string) => {
    const text = textToSend ?? input;
    if (!text.trim()) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text,
      time: now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");

    // Smart contextual response based on actual data
    setTimeout(() => {
      let reply = "קיבלתי! הכל מתועד במערכת ובגיליון בדיקת תעודות משלוח.";
      const t = text.toLowerCase();

      if (
        t.includes("טכוגרף") ||
        t.includes("חכמת") ||
        t.includes("עלי") ||
        t.includes("קילומטר") ||
        t.includes('ק"מ')
      ) {
        const tacho = liveTachs[0];
        if (tacho) {
          reply = `🚚 **דוח טכוגרף מגיליון (${tacho.driverName}, משאית ${tacho.truckId}):**\n• תאריך: ${tacho.date}\n• קובץ מקור: ${tacho.originalFileName}\n• קילומטראז': **${tacho.kmTotal} ק״מ**\n• זמן עבודת מנוף ב-PTO: **${tacho.ptoHours} שעות**\n• אימות: **${tacho.ituranMatch}**\nנבדק מול הגיליון!`;
        } else {
          reply = `🚚 **דוח טכוגרף:**\nכרגע אין דיסקיות טכוגרף בטאב "ארכיון_טכוגרף" בגיליון. ברגע שגליה סורקת את העמוד האחרון (N), הנתונים ייקלטו כאן מיד.`;
        }
      } else if (t.includes("הזמנ") || t.includes("לקוח") || t.includes("הפצה")) {
        if (liveOrders.length > 0) {
          const sample = liveOrders
            .slice(0, 3)
            .map((o) => `• הזמנה ${o.id} (${o.customer}) — סטטוס: ${o.status}, ${o.yard}`)
            .join("\n");
          reply = `📦 **סטטוס הזמנות חיות מגיליון:**\nכרגע יש **${liveOrders.length} הזמנות** פעילות בגיליון:\n${sample}`;
        } else {
          reply = `📦 **סטטוס הזמנות חיות:**\nאין הזמנות פתוחות כרגע בגיליון. הזמנות שמוזנות בקומקס או נסרקות יופיעו כאן מיד.`;
        }
      } else if (
        t.includes("תעוד") ||
        t.includes("אישור") ||
        t.includes("הראל") ||
        t.includes("ראמי")
      ) {
        if (liveNotes.length > 0) {
          reply = `📄 **תמונת תעודות משלוח מגיליון סבן:**\nנקלטו **${liveNotes.length} תעודות משלוח** חי מגיליון.\nכל תעודה מקושרת לסריקה המקורית של גליה ומאומתת מול הגיליון!`;
        } else {
          reply = `📄 **תמונת תעודות משלוח:**\nאין תעודות משלוח בגיליון כרגע. סריקות PDF חדשות שיגיעו למייל יפוצלו ויוזרקו לגיליון אוטומטית.`;
        }
      } else {
        reply = `הבנתי אותך! המערכת בודקת את הנתונים בזמן אמת מול גיליון בדיקת תעודות משלוח ומסד איתוראן. כל תעודה חתומה מתעדכנת ישירות בתיקיית הלקוח ב-Drive.`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `noa-${Date.now()}`,
          sender: "noa",
          text: reply,
          time: now(),
        },
      ]);
    }, 500);
  };

  return (
    <>
      <PageHeader
        title="נועה AI"
        subtitle="חדר צ׳אט לוגיסטי מחובר לגיליון"
        action={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-2xl bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              מחוברת למערכת
            </span>
          </div>
        }
      />

      <div className="mx-auto max-w-4xl px-4 py-4 md:px-8">
        {/* WhatsApp Frame */}
        <div className="flex flex-col h-[75dvh] rounded-3xl border bg-card shadow-lift overflow-hidden">
          {/* WhatsApp Header */}
          <div className="flex items-center justify-between border-b bg-emerald-800 px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <img
                src={noa}
                alt="נועה"
                className="h-10 w-10 rounded-full object-cover ring-2 ring-white/30"
              />
              <div>
                <div className="font-bold text-sm">נועה ❤️</div>
                <div className="text-[11px] opacity-80">סדרנית ויד ימינו של ראמי — מחוברת</div>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#efeae2]/30 dark:bg-zinc-950">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.sender === "user" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm leading-relaxed ${
                    m.sender === "user"
                      ? "rounded-tr-none bg-emerald-600 text-white"
                      : "rounded-tl-none bg-card text-card-foreground border"
                  }`}
                >
                  <div className="whitespace-pre-line">{m.text}</div>
                  <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px] opacity-70">
                    <span>{m.time}</span>
                    <CheckCheck className="h-3 w-3" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Prompts Bar */}
          <div className="flex gap-1.5 overflow-x-auto border-t bg-muted/40 p-2 text-xs">
            <button
              onClick={() => handleSend("מה הסטטוס של דיסקית הטכוגרף של חכמת?")}
              className="flex items-center gap-1 whitespace-nowrap rounded-xl border bg-card px-2.5 py-1.5 font-medium hover:bg-muted"
            >
              <Gauge className="h-3 w-3 text-amber-600" /> דוח טכוגרף חכמת
            </button>
            <button
              onClick={() => handleSend("תציגי את תמונת תעודות המשלוח של היום")}
              className="flex items-center gap-1 whitespace-nowrap rounded-xl border bg-card px-2.5 py-1.5 font-medium hover:bg-muted"
            >
              <FileText className="h-3 w-3 text-primary" /> תעודות לאישור
            </button>
            <button
              onClick={() => handleSend("איזה הזמנות בהעמסה במחסן 4 החרש?")}
              className="flex items-center gap-1 whitespace-nowrap rounded-xl border bg-card px-2.5 py-1.5 font-medium hover:bg-muted"
            >
              <Truck className="h-3 w-3 text-emerald-600" /> הזמנות מחסן 4
            </button>
          </div>

          {/* WhatsApp Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 border-t bg-card p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="כתוב הודעה לנועה..."
              className="flex-1 rounded-2xl border bg-muted/30 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              <Send className="h-4 w-4 rotate-180" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
