export type DriverId = "ali" | "hikmat";

export interface DriverProfile {
  id: DriverId;
  name: string;
  fullName: string;
  truck: string;
  plate: string;
  truckType: "flatbed" | "crane";
  avatarUrl: string;
  initials: string;
  color: string;
}

export const DRIVERS: Record<DriverId, DriverProfile> = {
  ali: {
    id: "ali",
    name: "עלי",
    fullName: "עלי אבו עידה",
    truck: "משאית איסוזו פלטה",
    plate: "651-51-701",
    truckType: "flatbed",
    avatarUrl: "https://i.postimg.cc/tCNbgXK3/Screenshot-20250623-200744-Tik-Tok.jpg",
    initials: "עא",
    color: "#0e7490", // turquoise
  },
  hikmat: {
    id: "hikmat",
    name: "חכמת",
    fullName: "חכמת גאבר",
    truck: "משאית מרצדס מנוף",
    plate: "615-41-002",
    truckType: "crane",
    avatarUrl: "https://i.postimg.cc/d3S0NJJZ/Screenshot-20250623-200646-Facebook.jpg",
    initials: "חג",
    color: "#14532d", // Saban green
  },
};

export interface DeliveryNoteRow {
  _row: number;
  _link?: string;
  "תאריך קליטה"?: string;
  "תאריך תעודה"?: string;
  "שעת תעודה"?: string;
  "מס' תעודת משלוח"?: string;
  "מס' הזמנה"?: string;
  "מס' לקוח"?: string;
  "שם לקוח"?: string;
  "כתובת אספקה"?: string;
  נהג?: string;
  "רישוי / משאית"?: string;
  "קישור לתעודה"?: string;
  פריטים?: string;
  פיקדונות?: string;
  "זמני מנוף / המתנה"?: string;
  "קובץ מקור"?: string;
  עמוד?: string;
  "סטטוס חילוץ"?: string;
  "מפתח ייחודי"?: string;
  "סטטוס אישור"?: string;
  "קישור חתום"?: string;
  "אישור ראמי"?: string;
  "אישור הראל"?: string;
  "הערת אישור"?: string;
  "משך באתר (דק׳)"?: string;
  "נסיעה (דק׳)"?: string;
  "ק״מ נסיעה"?: string;
  "הגעה (איתוראן)"?: string;
  "יציאה (איתוראן)"?: string;
  "PTO פתיחה"?: string;
  "PTO סגירה"?: string;
  "PTO דק׳"?: string;
  "מקור מדידה"?: string;
  "מפתח ביקור"?: string;
}

export interface TachographDiscRow {
  _row: number;
  _link?: string;
  "תאריך קליטה"?: string;
  "תאריך דיסקית"?: string;
  'ק"מ פתיחה'?: string;
  'ק"מ סגירה'?: string;
  'סה"כ ק"מ'?: string;
  "קישור לדיסקית"?: string;
  "זמן נסיעה"?: string;
  "זמן עבודה"?: string;
  "זמן סרק"?: string;
  "זמן מנוף"?: string;
  נהג?: string;
  "רישוי / משאית"?: string;
  "קובץ מקור"?: string;
  עמוד?: string;
  "סטטוס חילוץ"?: string;
  "מפתח ייחודי"?: string;
  "תאריך מתוקן"?: string;
  "משאית מתוקנת"?: string;
  "אושר ע״י"?: string;
  "אושר בתאריך"?: string;
  isOcrSuspect?: boolean;
}

export interface VisitRecord {
  visitKey: string;
  date: string; // YYYY-MM-DD
  rawDate: string;
  truckPlate: string;
  driverId: DriverId;
  driverName: string;
  city: string;
  address: string;
  siteKey: string;
  customers: string[];
  noteIds: string[];
  orderIds: string[];
  notesCount: number;
  deliveryNotes: DeliveryNoteRow[];
  handwrittenCraneWindow?: string;
  handwrittenUnloadMinutes?: number;
  handwrittenWaitMinutes?: number;
  ituranArrival?: string;
  ituranDeparture?: string;
  ituranStopMinutes?: number;
  ptoStart?: string;
  ptoEnd?: string;
  ptoMinutes?: number;
  kmFromPrev?: number;
  driveMinutesFromPrev?: number;
  siteDurationMinutes?: number;
  measurementSource: "איתוראן" | "כתב יד" | "אין נתון";
  qualityFlags: string[];
  customerSignature: "קיימת" | "לא נמצאה";
  customerSignatureUrl?: string;
  hasReversedCraneWindow: boolean;
}

export interface SiteSummary {
  siteKey: string;
  city: string;
  address: string;
  customers: string[];
  visitCount: number;
  lastVisitDate: string;
  measurementCount: number;
  medianSiteMinutes: number;
  p80SiteMinutes: number;
  maxSiteMinutes: number;
  medianDriveMinutes: number;
  confidence: "גבוה" | "בינוני" | "נמוך";
}

export interface CitySummary {
  city: string;
  visitCount: number;
  measurementCount: number;
  medianSiteMinutes: number;
  p80SiteMinutes: number;
  medianDriveMinutes: number;
}

export type AnomalySeverity = "critical" | "warning" | "info";

export interface DeterministicAnomaly {
  id: string;
  type:
    | "long_stop_no_pto"
    | "pto_handwriting_mismatch"
    | "km_mismatch"
    | "speed_violation"
    | "note_without_stop"
    | "orphan_pto"
    | "reversed_crane_window"
    | "ocr_suspect_date"
    | "missing_signature";
  severity: AnomalySeverity;
  title: string;
  evidence: string;
  explanation: string;
  date: string;
  driverId?: DriverId;
  noteId?: string;
  visitKey?: string;
}

export interface DayDashboard {
  date: string; // YYYY-MM-DD
  rawDate: string;
  driverId: DriverId;
  driver: DriverProfile;
  disc?: TachographDiscRow;
  visits: VisitRecord[];
  totalKm?: number;
  ptoHours: number;
  totalVisits: number;
  notesCount: number;
  medianSiteDuration: number;
  anomalies: DeterministicAnomaly[];
  status: "ok" | "warn" | "suspect";
}

export interface GeminiAnalysisResult {
  title: string;
  summary: string; // 3 sentences
  priorities: string[];
  driverQuestions: string[];
  createdAt: string;
  basedOnRows: number;
  isVisualEstimate?: boolean;
}

export interface ConnectionDiagnosis {
  ok: boolean;
  appsScriptHost?: string;
  httpStatus?: number;
  contentType?: string;
  first200Chars?: string;
  causes: string[];
  responseTimeMs?: number;
  lastSyncTime?: string;
  rowsCount?: {
    deliveryNotes: number;
    discs: number;
    visits: number;
    sites: number;
    cities: number;
  };
  lastDataDate?: string;
  isUsingFallback?: boolean;
  error?: string;
}
