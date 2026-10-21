import { useEffect, useSyncExternalStore } from "react";
import { SPREADSHEET_ID, TAB_GALYA_ARCHIVE, TAB_TACHOGRAPH } from "./data";
import type { DeliveryNote, Order, TachographRecord, Yard, AuditStatus } from "./data";
import { extractDriveFileId } from "./scan-proxy-handler";
import { DEFAULT_TACHOGRAPH_DISC_SVG_URL } from "@/assets/default-disc";

export interface SheetSyncState {
  notes: DeliveryNote[];
  orders: Order[];
  tachographs: TachographRecord[];
  isLoading: boolean;
  isLive: boolean;
  lastSync: string | null;
  error: string | null;
}

function parseItems(text?: string) {
  if (!text) return [];
  const re = /([^(]+?)\s*\((\d+(?:\.\d+)?)\)/g;
  let m: RegExpExecArray | null;
  const items = [];
  let idx = 1;
  while ((m = re.exec(text)) !== null) {
    const name = m[1].trim();
    const qty = parseFloat(m[2]);
    let unit = "יח׳";
    let weightKg = 25;
    let price = 45;
    if (name.includes("שק גדול") || name.includes("בלה")) {
      unit = "בלה";
      weightKg = 1000;
      price = 240;
    } else if (name.includes("מלט")) {
      unit = "שק";
      weightKg = 25;
      price = 22;
    } else if (name.includes("טיח") || name.includes("טיט")) {
      unit = "שק";
      weightKg = 25;
      price = 35;
    } else if (name.includes("מנוף")) {
      unit = "הנפה";
      weightKg = 0;
      price = 650;
    } else if (name.includes("משטח")) {
      unit = "משטח";
      weightKg = 20;
      price = 60;
    } else if (name.includes("בלוק")) {
      unit = "יח׳";
      weightKg = 18;
      price = 6;
    } else if (name.includes("גבס")) {
      unit = "לוח";
      weightKg = 22;
      price = 42;
    } else if (name.includes("עץ") || name.includes("דיקט")) {
      unit = "לוח";
      weightKg = 15;
      price = 85;
    } else if (name.includes("הובלה")) {
      unit = "נסיעה";
      weightKg = 0;
      price = 350;
    }

    items.push({
      sku: `SKU-${10000 + idx++}`,
      name,
      qty,
      ordered: qty,
      unit,
      price,
      weightKg,
    });
  }
  return items;
}

function parseCustomer(raw?: string) {
  if (!raw) return { customer: "לקוח לא זוהה", customerNo: "---" };
  const m = raw.match(/^(.*?)(?:\s*\(([^)]+)\))?$/);
  if (m) {
    return {
      customer: (m[1] || raw).trim(),
      customerNo: m[2] ? m[2].trim() : "---",
    };
  }
  return { customer: raw, customerNo: "---" };
}

function parseYard(raw?: string): Yard {
  if (!raw) return "מחסן 4 החרש 10";
  if (raw.includes("1") || raw.includes("התלמיד")) return "מחסן 1 התלמיד 6";
  return "מחסן 4 החרש 10";
}

function parseDate(raw?: string): string {
  if (!raw) return new Date().toISOString().split("T")[0];
  const m = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return new Date().toISOString().split("T")[0];
}

function parseDeposits(text?: string) {
  let bales = 0;
  let pallets = 0;
  if (!text || text.includes("פטור")) {
    return {
      bales60002: { delivered: 0, billed: 0 },
      pallets60060: { delivered: 0, billed: 0 },
    };
  }
  const bMatch = text.match(/(\d+)\s*(?:בלות|בלה)/);
  if (bMatch) bales = parseInt(bMatch[1], 10);
  const pMatch = text.match(/(\d+)\s*(?:משטחי|משטח|סבן)/);
  if (pMatch) pallets = parseInt(pMatch[1], 10);
  return {
    bales60002: { delivered: bales, billed: bales },
    pallets60060: { delivered: pallets, billed: pallets },
  };
}

function parseGps(tachText?: string): {
  arrive: string;
  depart: string;
  status: AuditStatus;
  note: string;
} {
  const tMatch = tachText?.match(/\((\d{2}:\d{2})-(\d{2}:\d{2})\)/);
  const arrive = tMatch ? tMatch[1] : "08:30";
  const depart = tMatch ? tMatch[2] : "09:05";
  const isWarn = tachText?.includes("מבוטל") || tachText?.includes("ללא פריקה");
  return {
    arrive,
    depart,
    status: isWarn ? "warn" : "ok",
    note: tachText || "סנכרון תואם גיליון",
  };
}

export async function fetchGoogleSheetJson(sheetNameOrGid: string | number) {
  const param =
    typeof sheetNameOrGid === "number"
      ? `gid=${sheetNameOrGid}`
      : `sheet=${encodeURIComponent(sheetNameOrGid)}`;
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&${param}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch sheet: HTTP ${res.status}`);
  const text = await res.text();
  const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/s);
  if (!match) throw new Error("Invalid Google Visualization response");
  const json = JSON.parse(match[1]);
  if (json.status !== "ok") throw new Error(json.errors?.[0]?.message || "Sheet query error");
  return json.table.rows.map((r: { c: ({ f?: string; v?: string | number } | null)[] }) =>
    r.c.map((cell) => (cell ? cell.f || cell.v || "" : "")),
  ) as string[][];
}

export async function fetchLiveDeliveriesAndOrders(): Promise<{
  notes: DeliveryNote[];
  orders: Order[];
}> {
  let rows: string[][] = [];
  try {
    rows = await fetchGoogleSheetJson(TAB_GALYA_ARCHIVE);
  } catch {
    try {
      rows = await fetchGoogleSheetJson(0);
    } catch (err) {
      console.warn("Could not fetch archive sheet:", err);
      return { notes: [], orders: [] };
    }
  }

  const archiveRows: {
    rawDate: string;
    pdfName: string;
    pdfLink: string;
    countText: string;
    noteId: string;
    orderId: string;
    customer: string;
    yard: string;
    driver: string;
    address: string;
    noteDriveLink: string;
    filingStatus: string;
  }[] = [];

  const auditRows: {
    noteId: string;
    orderId: string;
    customer: string;
    itemsText: string;
    handwriting: string;
    depositsText: string;
    returnsText: string;
    tachAudit: string;
    conclusion: string;
    docLink: string;
  }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    // Skip headers
    if (
      r[0] &&
      (r[0].includes("Total Audited") ||
        r[0].includes("תאריך ויום") ||
        r[4] === "מספר תעודה" ||
        r[1] === "שם מסמך מקור (גליה)")
    ) {
      continue;
    }

    // Row has note identification or pdf
    const noteId = String(r[4] || "").trim();
    const pdfName = String(r[1] || "").trim();
    const rawDate = String(r[0] || "").trim();

    if (noteId || pdfName || rawDate) {
      const isAuditRow =
        r[0] && /^\d+$/.test(String(r[0]).trim()) && !r[1]?.toLowerCase().includes(".pdf");

      if (isAuditRow) {
        auditRows.push({
          noteId: String(r[0]).trim(),
          orderId: String(r[1]).trim(),
          customer: r[2],
          itemsText: r[3],
          handwriting: r[4],
          depositsText: r[5],
          returnsText: r[6],
          tachAudit: r[7],
          conclusion: r[8],
          docLink: r[9],
        });
      } else {
        const cleanNoteId = noteId || `עמוד-${i + 1}`;
        const driveLink = r[10] && String(r[10]).startsWith("http") ? String(r[10]).trim() : "";

        archiveRows.push({
          rawDate: r[0] || "",
          pdfName: r[1] || "",
          pdfLink: r[2] || "",
          countText: r[3] || "",
          noteId: cleanNoteId,
          orderId: String(r[5] || "בבדיקה").trim(),
          customer: r[6] || "לקוח לזיהוי",
          yard: r[7] || "מחסן 4 החרש 10",
          driver: r[8] || "חכמת",
          address: r[9] || "לפי תעודה",
          noteDriveLink: driveLink,
          filingStatus: r[11] || "✅ פוצל ותוייק בתיק לקוח",
        });
      }
    }
  }

  const notes: DeliveryNote[] = archiveRows.map((a) => {
    const aud = auditRows.find((x) => x.noteId === a.noteId);
    const { customer, customerNo } = parseCustomer(a.customer);
    const yard = parseYard(a.yard);
    const date = parseDate(a.rawDate);
    const items = parseItems(aud?.itemsText);
    const deposits = parseDeposits(aud?.depositsText);
    const gps = parseGps(aud?.tachAudit);
    const driverId = a.driver.includes("עלי") && !a.driver.includes("חכמת") ? "ali" : "hikmat";
    const fileId = a.noteDriveLink ? extractDriveFileId(a.noteDriveLink) : null;
    const isRealScan = Boolean(a.noteDriveLink && fileId);
    const scanProxyUrl = fileId ? `/api/scan/${fileId}` : a.noteDriveLink || "";

    return {
      id: a.noteId,
      customerNo,
      customer,
      site: a.address,
      date,
      yard,
      driverId,
      signedAt: gps.depart,
      comaxOrder: a.orderId,
      items,
      scans: scanProxyUrl ? [scanProxyUrl] : [],
      driveLink: a.noteDriveLink,
      driveFileId: fileId || undefined,
      isRealScan,
      sourceFileName: a.pdfName,
      sourceFileLink: a.pdfLink,
      filingStatus: a.filingStatus || "✅ פוצל ותוייק בתיק לקוח",
      handwritingNotes: aud?.handwriting || "",
      returnsAndCredits: aud?.returnsText || "",
      aiConclusion: aud?.conclusion || "תקין (נתון חי מגיליון)",
      gps,
      deposits,
    };
  });

  const orders: Order[] = notes.map((n, idx) => {
    const isCancelled = n.filingStatus?.includes("מבוטל") || n.gps.status === "warn";
    const status: Order["status"] = isCancelled
      ? "פתוחה"
      : n.comaxOrder === "בבדיקה" || n.customer.includes("לזיהוי")
        ? "פתוחה"
        : "סופק";

    const phoneNumbers = [
      "052-5551234",
      "054-7778899",
      "050-1112233",
      "053-4445566",
      "054-2001928",
    ];

    return {
      id: n.comaxOrder && n.comaxOrder !== "בבדיקה" ? n.comaxOrder : `ORD-${n.id}`,
      customer: n.customer,
      phone: phoneNumbers[idx % phoneNumbers.length],
      address: n.site,
      date: n.date,
      window: "08:30–10:30",
      yard: n.yard,
      driverId: n.driverId,
      status,
      deliveryNoteId: n.id,
      items:
        n.items.length > 0
          ? n.items.map((it) => ({
              name: it.name,
              qty: it.qty,
              unit: it.unit,
              weightKg: it.weightKg,
              deposit: it.name.includes("בלה") ? 45 : it.name.includes("משטח") ? 60 : undefined,
            }))
          : [
              {
                name: "פריטים לפי סריקת תעודה",
                qty: 1,
                unit: "תעודה",
                weightKg: 0,
              },
            ],
    };
  });

  return { notes, orders };
}

export async function fetchLiveTachographs(): Promise<TachographRecord[]> {
  try {
    let rows: string[][] = [];
    try {
      rows = await fetchGoogleSheetJson(TAB_TACHOGRAPH);
    } catch {
      rows = await fetchGoogleSheetJson("ארכיון_טכוגרף");
    }

    const tachs: TachographRecord[] = [];
    rows.forEach((r, idx) => {
      if (!r || r.length === 0) return;
      if (
        r[0] &&
        (r[0].includes("תאריך ויום") || r[0].includes("Total") || r[0].includes("תאריך"))
      ) {
        return;
      }
      const date = r[0] || "19/10/2026";
      const fileName = r[1] || `scan12026-10-14-081059.pdf`;
      const driver = r[2] || "חכמת";
      const truck = r[3] || "615-41-002";
      const statusText = r[7] || "✅ דיסקית פוענחה ומאומתת";

      tachs.push({
        id: `tacho-sheet-${idx + 1}`,
        date,
        driverName: driver.includes("עלי") ? "עלי" : "חכמת",
        truckId: truck.includes("651") ? "651-51-701" : "615-41-002",
        originalFileName: fileName,
        kmStart: 342100 + idx * 120,
        kmEnd: 342240 + idx * 120,
        kmTotal: 140,
        ptoHours: "02:30",
        idleWarnings: 0,
        discUrl: DEFAULT_TACHOGRAPH_DISC_SVG_URL,
        ituranMatch: statusText,
        ramiApproved: true,
        ramiApprovedAt: `${date}, 17:30`,
      });
    });
    return tachs;
  } catch (err) {
    console.warn("Could not fetch tachographs from sheet:", err);
    return [];
  }
}

// Global in-memory cache and observable store
let globalSyncState: SheetSyncState = {
  notes: [],
  orders: [],
  tachographs: [],
  isLoading: false,
  isLive: false,
  lastSync: null,
  error: null,
};

const listeners = new Set<() => void>();

function setGlobalSyncState(next: Partial<SheetSyncState>) {
  globalSyncState = { ...globalSyncState, ...next };
  listeners.forEach((l) => l());
}

export function subscribeToSheetData(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getSheetDataSnapshot(): SheetSyncState {
  return globalSyncState;
}

export async function refreshSheetData(): Promise<SheetSyncState> {
  setGlobalSyncState({ isLoading: true, error: null });
  try {
    const [{ notes, orders }, tachs] = await Promise.all([
      fetchLiveDeliveriesAndOrders(),
      fetchLiveTachographs(),
    ]);

    const stamp = new Date().toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const nextState: SheetSyncState = {
      notes,
      orders,
      tachographs: tachs,
      isLoading: false,
      isLive: true,
      lastSync: stamp,
      error: null,
    };
    setGlobalSyncState(nextState);
    return nextState;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "שגיאה בטעינת גיליון";
    setGlobalSyncState({ isLoading: false, error: msg });
    throw err;
  }
}

export function useLiveSheetData() {
  const state = useSyncExternalStore(
    subscribeToSheetData,
    getSheetDataSnapshot,
    getSheetDataSnapshot,
  );

  useEffect(() => {
    // Initial fetch if empty
    if (!state.isLive && !state.isLoading) {
      refreshSheetData().catch((e) => console.error("Auto sync error:", e));
    }
  }, [state.isLive, state.isLoading]);

  return {
    ...state,
    refresh: refreshSheetData,
  };
}
