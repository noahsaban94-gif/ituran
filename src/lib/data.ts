export type Yard = "מחסן 4 החרש 10" | "מחסן 1 התלמיד 6";
export type Driver = {
  id: string;
  name: string;
  truck: string;
  plate: string;
  kind: "crane" | "flatbed";
};

export const DRIVERS: Driver[] = [
  { id: "hikmat", name: "חכמת", truck: "משאית מנוף", plate: "615-41-002", kind: "crane" },
  { id: "ali", name: "עלי", truck: "משאית פלטה", plate: "651-51-701", kind: "flatbed" },
];

export const YARD_MANAGERS: Record<Yard, string> = {
  "מחסן 4 החרש 10": "אורן",
  "מחסן 1 התלמיד 6": "תמיר",
};

export type Item = {
  sku: string;
  name: string;
  qty: number;
  ordered: number;
  unit: string;
  price: number;
  weightKg: number;
};

export type AuditStatus = "ok" | "warn" | "fail";

export type DeliveryNote = {
  id: string;
  customerNo: string;
  customer: string;
  site: string;
  date: string; // YYYY-MM-DD
  yard: Yard;
  driverId: string;
  signedAt: string; // HH:MM
  comaxOrder: string;
  items: Item[];
  scans?: string[];
  driveLink?: string;
  driveFileId?: string;
  isRealScan?: boolean;
  sourceFileName?: string;
  sourceFileLink?: string;
  filingStatus?: string;
  handwritingNotes?: string;
  returnsAndCredits?: string;
  aiConclusion?: string;
  gps: { arrive: string; depart: string; status: AuditStatus; note: string };
  deposits: {
    bales60002: { delivered: number; billed: number };
    pallets60060: { delivered: number; billed: number };
  };
};

import p13 from "@/assets/scans/p13.jpg.asset.json";

export const SPREADSHEET_ID = "1FsLseQrKbIj_AvlE6-dW4J12Gr88P3uaoFVBjEcUjsw";
export const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;
export const TAB_GALYA_ARCHIVE = "ארכיון_תעודות_גליה";
export const TAB_TACHOGRAPH = "ארכיון_טכוגרף";

export const TACHOGRAPH_1310 = p13.url;

export type TachographRecord = {
  id: string;
  date: string;
  driverName: string;
  truckId: string;
  originalFileName: string;
  kmStart: number;
  kmEnd: number;
  kmTotal: number;
  ptoHours: string;
  idleWarnings: number;
  discUrl: string;
  ituranMatch: string;
  ramiApproved: boolean;
  ramiApprovedAt?: string;
};

// Real live data is fetched directly from Google Sheets via sheet-data.ts
// Mock data has been completely removed per user request
export const INITIAL_TACHOGRAPHS: TachographRecord[] = [];

export const NOTES: DeliveryNote[] = [];

export const noteTotal = (n: DeliveryNote) => n.items.reduce((s, i) => s + i.qty * i.price, 0);

export const noteWeightTons = (n: DeliveryNote) =>
  n.items.reduce((s, i) => s + i.qty * i.weightKg, 0) / 1000;

export const driverOf = (id: string | null) => DRIVERS.find((d) => d.id === id) || DRIVERS[0];

export function auditNote(n: DeliveryNote): {
  status: AuditStatus;
  findings: { status: AuditStatus; text: string }[];
} {
  const findings: { status: AuditStatus; text: string }[] = [];

  if (n.aiConclusion) {
    const isOk = n.aiConclusion.includes("✅") || n.aiConclusion.includes("תקין");
    const isWarn = n.aiConclusion.includes("⚠️") || n.aiConclusion.includes("לזיהוי");
    findings.push({
      status: isOk ? "ok" : isWarn ? "warn" : "ok",
      text: `נועה AI: ${n.aiConclusion}`,
    });
  }

  if (n.handwritingNotes) {
    findings.push({
      status: "ok",
      text: `כתב יד והערת שטח: ${n.handwritingNotes}`,
    });
  }

  if (n.returnsAndCredits && !n.returnsAndCredits.includes("ללא")) {
    findings.push({
      status: "warn",
      text: `זיכוי שטח / החזרות: ${n.returnsAndCredits}`,
    });
  }

  n.items.forEach((i) => {
    if (i.qty !== i.ordered) {
      findings.push({
        status: "warn",
        text: `${i.name}: סופק ${i.qty} מול ${i.ordered} בהזמנת קומקס`,
      });
    }
  });

  const b = n.deposits?.bales60002;
  const p = n.deposits?.pallets60060;

  if (b && b.delivered !== b.billed) {
    findings.push({
      status: "fail",
      text: `בלות פקדון 60002: ${b.delivered} סופקו, ${b.billed} חויבו`,
    });
  } else if (b?.delivered) {
    findings.push({ status: "ok", text: `בלות 60002 תואמות 1:1 (${b.delivered})` });
  }

  if (p && p.delivered !== p.billed) {
    findings.push({
      status: "fail",
      text: `משטחי עץ 60060: ${p.delivered} סופקו, ${p.billed} חויבו`,
    });
  } else if (p?.delivered) {
    findings.push({ status: "ok", text: `משטחי 60060 תואמים 1:1 (${p.delivered})` });
  }

  if (n.gps) {
    findings.push({ status: n.gps.status, text: `איתוראן: ${n.gps.note}` });
  }

  const status: AuditStatus = findings.some((f) => f.status === "fail")
    ? "fail"
    : findings.some((f) => f.status === "warn")
      ? "warn"
      : "ok";
  return { status, findings };
}

export type Order = {
  id: string;
  customer: string;
  phone: string;
  address: string;
  date: string;
  window: string;
  yard: Yard;
  driverId: string | null;
  status: "פתוחה" | "בהעמסה" | "בדרך" | "סופק";
  deliveryNoteId?: string;
  items: { name: string; qty: number; unit: string; weightKg: number; deposit?: number }[];
};

export const ORDERS: Order[] = [];

export const ils = (n: number) => "₪" + n.toLocaleString("he-IL", { maximumFractionDigits: 0 });

export const fmtDate = (d: string) => d.split("-").reverse().join("/");
