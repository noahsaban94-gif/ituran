import type { AuditStatus, DeliveryNote } from "./data";

export type GpsStop = { plate: string; address: string; arrive: string; depart: string };

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export const DWELL_RULES = { crane: [25, 45], flatbed: [15, 25] } as const;

/** Cross-match one delivery note against GPS stops. */
export function crossMatch(
  note: Pick<DeliveryNote, "site" | "signedAt">,
  kind: "crane" | "flatbed",
  plate: string,
  stops: GpsStop[],
): { status: AuditStatus; dwell: number | null; label: string; stop?: GpsStop } {
  const street =
    (note.site.split(",")[0] ?? "")
      .replace(/רח׳|שד׳/g, "")
      .trim()
      .split(" ")[0] ?? "";
  const stop = stops.find(
    (s) => s.plate.replace(/\D/g, "") === plate.replace(/\D/g, "") && s.address.includes(street),
  );
  if (!stop) return { status: "fail", dwell: null, label: "🔴 רכב לא שהה בכתובת" };
  const dwell = toMin(stop.depart) - toMin(stop.arrive);
  const [min, max] = DWELL_RULES[kind];
  const sign = toMin(note.signedAt);
  const signInside = sign >= toMin(stop.arrive) - 5 && sign <= toMin(stop.depart) + 5;
  if (dwell >= min && dwell <= max + 10 && signInside)
    return { status: "ok", dwell, stop, label: "🟢 אומת ב-100% באיתוראן" };
  return { status: "warn", dwell, stop, label: "⚠️ סטיית זמן חריגה" };
}

/** Parse rows from an Ituran export — tolerant to Hebrew/English headers. */
export function rowsToStops(rows: Record<string, unknown>[]): GpsStop[] {
  const pick = (r: Record<string, unknown>, keys: string[]) => {
    const k = Object.keys(r).find((h) => keys.some((x) => h.includes(x)));
    return k ? String(r[k] ?? "").trim() : "";
  };
  const time = (v: string) => (v.match(/\d{1,2}:\d{2}/)?.[0] ?? "").padStart(5, "0");
  return rows
    .map((r) => ({
      plate: pick(r, ["רכב", "רישוי", "plate", "Plate"]),
      address: pick(r, ["כתובת", "מיקום", "address", "Address"]),
      arrive: time(pick(r, ["כניסה", "הגעה", "arrive", "Arrival"])),
      depart: time(pick(r, ["יציאה", "עזיבה", "depart", "Departure"])),
    }))
    .filter((s) => s.plate && s.arrive && s.depart);
}

export const SAMPLE_STOPS: GpsStop[] = [
  { plate: "615-41-002", address: "החרש 5 רמת גן", arrive: "08:05", depart: "08:47" },
  { plate: "651-51-701", address: "שדרות ירושלים 112 יפו", arrive: "09:58", depart: "10:06" },
  { plate: "615-41-002", address: "הנרקיס 3 הוד השרון", arrive: "11:30", depart: "12:12" },
];
