import { createServerFn } from "@tanstack/react-start";

type Msg = { role: "user" | "assistant"; content: string };

async function callGateway(instructions: string, input: Msg[]): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI לא מוגדר");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      Authorization: `Bearer ${key}`,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      instructions,
      input: input.map((m) => ({ role: m.role, content: m.content })),
      reasoning: { effort: "low" },
      store: false,
      stream: true,
    }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text();
    if (res.status === 402) throw new Error("נגמרו קרדיטי ה-AI בסביבת העבודה");
    if (res.status === 429) throw new Error("יותר מדי בקשות, נסו שוב בעוד רגע");
    throw new Error(`שגיאת AI (${res.status}): ${t.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "",
    out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim();
      if (!d || d === "[DONE]") continue;
      try {
        const ev = JSON.parse(d);
        if (ev.type === "response.output_text.delta") out += ev.delta;
      } catch {
        /* partial */
      }
    }
  }
  return out.trim();
}

export const askNoa = createServerFn({ method: "POST" })
  .inputValidator((d: { messages: Msg[]; context: string }) => {
    if (!Array.isArray(d.messages) || d.messages.length > 40) throw new Error("bad input");
    return {
      messages: d.messages
        .slice(-20)
        .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) })),
      context: String(d.context).slice(0, 12000),
    };
  })
  .handler(async ({ data }) => {
    const instructions = `את נועה ❤️, סדרנית ויד ימינו של ראמי מסארווה בח. סבן חומרי בניין (1994) בע״מ.
עני בעברית, קצר, חם ומקצועי, בסגנון וואטסאפ. השתמשי ב-**הדגשה** לנתונים חשובים ובאימוג'י סטטוס (🟢 ⚠️ 🔴 🚚).
נהגים: חכמת (מנוף 615-41-002), עלי (פלטה 651-51-701). מחסנים: 4 החרש 10 (אורן), 1 התלמיד 6 (תמיר).
נתוני מערכת עדכניים:
${data.context}`;
    return { text: await callGateway(instructions, data.messages) };
  });

export const polishNote = createServerFn({ method: "POST" })
  .inputValidator((d: { text: string; who: string }) => ({
    text: String(d.text).slice(0, 2000),
    who: String(d.who).slice(0, 40),
  }))
  .handler(async ({ data }) => {
    const instructions = `נסח מחדש את ההערה הבאה של ${data.who} בעברית משפטית-חשבונאית מלוטשת, תמציתית (עד 2 משפטים), לצורך רישום על תעודת משלוח לפני חתימה. החזר רק את הנוסח.`;
    return { text: await callGateway(instructions, [{ role: "user", content: data.text }]) };
  });
