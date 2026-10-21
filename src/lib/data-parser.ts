import {
  DeliveryNoteRow,
  TachographDiscRow,
  VisitRecord,
  SiteSummary,
  CitySummary,
  DeterministicAnomaly,
  DriverId,
  DayDashboard,
  DRIVERS,
} from "./types";

export function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === "\r") {
        if (nextChar === "\n") i++;
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else if (char === "\n") {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

export function parseDeliveryNotesFromCSV(csvText: string): DeliveryNoteRow[] {
  const table = parseCSV(csvText);
  if (table.length < 2) return [];

  const headers = table[0]!.map((h) => h.trim());
  const notes: DeliveryNoteRow[] = [];

  for (let r = 1; r < table.length; r++) {
    const row = table[r]!;
    if (!row || row.length === 0 || row.every((c) => !c.trim())) continue;

    const item: Record<string, string | number> = { _row: r + 1 };
    headers.forEach((h, colIdx) => {
      if (h) {
        item[h] = row[colIdx] ? row[colIdx]!.trim() : "";
      }
    });

    const note = item as unknown as DeliveryNoteRow;

    // Filter day marker rows (rows with only date and driver, no delivery note id)
    const noteId = (note["מס' תעודת משלוח"] || "").trim();
    const customer = (note["שם לקוח"] || "").trim();
    if (!noteId && !customer) {
      continue; // Day marker or empty row
    }

    notes.push(note);
  }

  return notes;
}

export function normalizeDate(raw?: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  // Match DD/MM/YYYY
  const mDmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mDmy) {
    const day = mDmy[1]!.padStart(2, "0");
    const month = mDmy[2]!.padStart(2, "0");
    const year = mDmy[3]!;
    return `${year}-${month}-${day}`;
  }
  // Match YYYY-MM-DD
  const mYmd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (mYmd) {
    return `${mYmd[1]}-${mYmd[2]!.padStart(2, "0")}-${mYmd[3]!.padStart(2, "0")}`;
  }
  return trimmed;
}

export function detectDriver(text?: string, plateText?: string): DriverId {
  const combined = `${text || ""} ${plateText || ""}`;
  if (combined.includes("651-51-701") || combined.includes("עלי")) {
    return "ali";
  }
  // Default to Hikmat for 615-41-002, "חכמת", or team with Rami
  return "hikmat";
}

export function checkReversedCraneWindow(text?: string): {
  isReversed: boolean;
  minutes?: number;
  rawWindow?: string;
} {
  if (!text) return { isReversed: false };
  // Matches "משעה HH:MM עד שעה HH:MM" or "HH:MM עד HH:MM"
  const m = text.match(/(\d{1,2}:\d{2})\s*(?:עד שעה|עד|-)\s*(\d{1,2}:\d{2})/);
  if (!m) return { isReversed: false };

  const start = m[1]!;
  const end = m[2]!;

  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (sh === undefined || sm === undefined || eh === undefined || em === undefined) {
    return { isReversed: false };
  }

  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const rawWindow = `${start}–${end}`;

  if (endMin < startMin) {
    return { isReversed: true, rawWindow };
  }

  const diff = endMin - startMin;
  return { isReversed: false, minutes: diff > 240 ? undefined : diff, rawWindow };
}

export function buildVisitsFromNotes(notes: DeliveryNoteRow[]): VisitRecord[] {
  const map = new Map<string, DeliveryNoteRow[]>();

  // Deduplicate and group into visits
  notes.forEach((n) => {
    const rawDate = n["תאריך תעודה"] || n["תאריך קליטה"] || "";
    const date = normalizeDate(rawDate);
    if (!date) return;

    const plate = n["רישוי / משאית"] || "";
    const driverId = detectDriver(n["נהג"], plate);
    const assignedPlate = DRIVERS[driverId].plate;

    const address = (n["כתובת אספקה"] || "כתובת לא צוינה").trim();
    const siteKey = (n["מפתח ביקור"] || n["מפתח אתר"] || address).trim();

    const visitKey = `${date}|${assignedPlate}|${siteKey}`;
    if (!map.has(visitKey)) {
      map.set(visitKey, []);
    }
    map.get(visitKey)!.push(n);
  });

  const visits: VisitRecord[] = [];

  map.forEach((groupedNotes, visitKey) => {
    const first = groupedNotes[0]!;
    const rawDate = first["תאריך תעודה"] || first["תאריך קליטה"] || "";
    const date = normalizeDate(rawDate);
    const driverId = detectDriver(first["נהג"], first["רישוי / משאית"]);
    const assignedPlate = DRIVERS[driverId].plate;
    const address = (first["כתובת אספקה"] || "אין נתון").trim();

    // Extract city from address "רחוב 12, עיר"
    let city = "אחר";
    const parts = address.split(",");
    if (parts.length > 1) {
      city = parts[parts.length - 1]!.trim();
    } else {
      city = parts[0]!.trim();
    }

    const customers = Array.from(
      new Set(groupedNotes.map((x) => x["שם לקוח"]).filter(Boolean)),
    ) as string[];
    const noteIds = Array.from(
      new Set(groupedNotes.map((x) => x["מס' תעודת משלוח"]).filter(Boolean)),
    ) as string[];
    const orderIds = Array.from(
      new Set(groupedNotes.map((x) => x["מס' הזמנה"]).filter(Boolean)),
    ) as string[];

    // Signature check per rule 4
    let signatureStatus: "קיימת" | "לא נמצאה" = "לא נמצאה";
    let signatureUrl: string | undefined = undefined;

    for (const item of groupedNotes) {
      const signedLink = item["קישור חתום"];
      const craneNotes = item["זמני מנוף / המתנה"] || "";
      if (signedLink && signedLink.trim().length > 5) {
        signatureStatus = "קיימת";
        signatureUrl = signedLink.trim();
        break;
      }
      if (craneNotes.includes("חתימה") || craneNotes.includes("נחתם")) {
        signatureStatus = "קיימת";
        break;
      }
    }

    // Crane window & reversals
    let hasReversedCraneWindow = false;
    let hwCraneWindow: string | undefined = undefined;
    let hwMinutes: number | undefined = undefined;

    for (const item of groupedNotes) {
      const craneNotes = item["זמני מנוף / המתנה"] || "";
      const rev = checkReversedCraneWindow(craneNotes);
      if (rev.isReversed) {
        hasReversedCraneWindow = true;
        hwCraneWindow = rev.rawWindow;
      } else if (rev.minutes !== undefined && hwMinutes === undefined) {
        hwMinutes = rev.minutes;
        hwCraneWindow = rev.rawWindow;
      }
    }

    // Ituran & PTO
    const ituranArr = first["הגעה (איתוראן)"] || undefined;
    const ituranDep = first["יציאה (איתוראן)"] || undefined;
    const ituranStopM = first["משך באתר (דק׳)"] ? parseFloat(first["משך באתר (דק׳)"]!) : undefined;

    const ptoStart = first["PTO פתיחה"] || undefined;
    const ptoEnd = first["PTO סגירה"] || undefined;
    const ptoM = first["PTO דק׳"] ? parseFloat(first["PTO דק׳"]!) : undefined;

    const kmFromPrev = first["ק״מ נסיעה"] ? parseFloat(first["ק״מ נסיעה"]!) : undefined;
    const driveM = first["נסיעה (דק׳)"] ? parseFloat(first["נסיעה (דק׳)"]!) : undefined;

    let measurementSource: "איתוראן" | "כתב יד" | "אין נתון" = "אין נתון";
    if (ptoM !== undefined || ituranStopM !== undefined) {
      measurementSource = "איתוראן";
    } else if (hwMinutes !== undefined) {
      measurementSource = "כתב יד";
    }

    const qualityFlags: string[] = [];
    if (hasReversedCraneWindow) qualityFlags.push("חלון מנוף הפוך בכתב יד");
    if (signatureStatus === "לא נמצאה") qualityFlags.push("חתימת לקוח חסרה");
    if (!ituranArr && !ituranDep) qualityFlags.push("ללא נתוני הגעה מאיתוראן");

    visits.push({
      visitKey,
      date,
      rawDate,
      truckPlate: assignedPlate,
      driverId,
      driverName: DRIVERS[driverId].name,
      city,
      address,
      siteKey: first["מפתח ביקור"] || `${city}|${address}`,
      customers,
      noteIds,
      orderIds,
      notesCount: groupedNotes.length,
      deliveryNotes: groupedNotes,
      handwrittenCraneWindow: hwCraneWindow,
      handwrittenUnloadMinutes: hwMinutes,
      ituranArrival: ituranArr,
      ituranDeparture: ituranDep,
      ituranStopMinutes: ituranStopM,
      ptoStart,
      ptoEnd,
      ptoMinutes: ptoM,
      kmFromPrev,
      driveMinutesFromPrev: driveM,
      siteDurationMinutes: ptoM ?? hwMinutes ?? ituranStopM,
      measurementSource,
      qualityFlags,
      customerSignature: signatureStatus,
      customerSignatureUrl: signatureUrl,
      hasReversedCraneWindow,
    });
  });

  return visits.sort((a, b) => b.date.localeCompare(a.date));
}

export function buildSitesSummary(visits: VisitRecord[]): SiteSummary[] {
  const map = new Map<string, VisitRecord[]>();

  visits.forEach((v) => {
    const key = v.siteKey || `${v.city}|${v.address}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(v);
  });

  const sites: SiteSummary[] = [];

  map.forEach((list, siteKey) => {
    const first = list[0]!;
    const customers = Array.from(new Set(list.flatMap((x) => x.customers)));

    const durations = list
      .map((x) => x.siteDurationMinutes)
      .filter((d): d is number => d !== undefined && !isNaN(d) && d > 0 && d <= 240)
      .sort((a, b) => a - b);

    const driveTimes = list
      .map((x) => x.driveMinutesFromPrev)
      .filter((d): d is number => d !== undefined && !isNaN(d) && d > 0)
      .sort((a, b) => a - b);

    const medianSite = durations.length > 0 ? durations[Math.floor(durations.length / 2)]! : 0;
    const p80Site = durations.length > 0 ? durations[Math.floor(durations.length * 0.8)]! : 0;
    const maxSite = durations.length > 0 ? durations[durations.length - 1]! : 0;
    const medianDrive = driveTimes.length > 0 ? driveTimes[Math.floor(driveTimes.length / 2)]! : 0;

    const count = list.length;
    const confidence = count >= 5 ? "גבוה" : count >= 2 ? "בינוני" : "נמוך";

    sites.push({
      siteKey,
      city: first.city,
      address: first.address,
      customers,
      visitCount: count,
      lastVisitDate: list[0]!.date,
      measurementCount: durations.length,
      medianSiteMinutes: medianSite,
      p80SiteMinutes: p80Site,
      maxSiteMinutes: maxSite,
      medianDriveMinutes: medianDrive,
      confidence,
    });
  });

  return sites.sort((a, b) => b.visitCount - a.visitCount);
}

export function buildCitiesSummary(sites: SiteSummary[]): CitySummary[] {
  const map = new Map<string, SiteSummary[]>();

  sites.forEach((s) => {
    const city = s.city || "אחר";
    if (!map.has(city)) map.set(city, []);
    map.get(city)!.push(s);
  });

  const cities: CitySummary[] = [];

  map.forEach((list, city) => {
    const totalVisits = list.reduce((acc, s) => acc + s.visitCount, 0);
    const totalMeasurements = list.reduce((acc, s) => acc + s.measurementCount, 0);

    const medians = list.map((s) => s.medianSiteMinutes).filter((m) => m > 0);
    const p80s = list.map((s) => s.p80SiteMinutes).filter((m) => m > 0);
    const drives = list.map((s) => s.medianDriveMinutes).filter((m) => m > 0);

    const medianSite = medians.length > 0 ? medians[Math.floor(medians.length / 2)]! : 0;
    const p80Site = p80s.length > 0 ? p80s[Math.floor(p80s.length / 2)]! : 0;
    const medianDrive = drives.length > 0 ? drives[Math.floor(drives.length / 2)]! : 0;

    cities.push({
      city,
      visitCount: totalVisits,
      measurementCount: totalMeasurements,
      medianSiteMinutes: medianSite,
      p80SiteMinutes: p80Site,
      medianDriveMinutes: medianDrive,
    });
  });

  return cities.sort((a, b) => b.visitCount - a.visitCount);
}

export function detectDeterministicAnomalies(
  visits: VisitRecord[],
  discs: TachographDiscRow[],
): DeterministicAnomaly[] {
  const anomalies: DeterministicAnomaly[] = [];

  // Check Tachograph OCR Suspects
  discs.forEach((disc) => {
    const rawDate = disc["תאריך מתוקן"] || disc["תאריך דיסקית"] || "";
    const isYear2020 = rawDate.includes("2020");
    const isYear2024 = rawDate.includes("2024");
    const plate = disc["משאית מתוקנת"] || disc["רישוי / משאית"] || "";
    const isPlateShort = plate.replace(/\D/g, "").length < 7;

    if (isYear2020 || isYear2024 || isPlateShort) {
      anomalies.push({
        id: `ocr-${disc._row}-${rawDate}`,
        type: "ocr_suspect_date",
        severity: "critical",
        title: "תאריך או רישוי OCR חשוד בדיסקית",
        evidence: `דיסקית שורה ${disc._row}: תאריך "${rawDate}", רישוי "${plate}"`,
        explanation:
          "פענוח ה-OCR של הדיסקית זיהה שנה שאינה 2026 (כגון 2020/2024) או לוחית רישוי חסרה. יש לתקן ידנית את התאריך/משאית לפני אישור.",
        date: normalizeDate(rawDate),
      });
    }
  });

  // Check visits
  visits.forEach((v) => {
    // 1. Reversed crane window
    if (v.hasReversedCraneWindow) {
      anomalies.push({
        id: `rev-${v.visitKey}`,
        type: "reversed_crane_window",
        severity: "critical",
        title: "חלון מנוף הפוך בכתב יד",
        evidence: `ביקור ${v.address}: נרשם "${v.handwrittenCraneWindow}"`,
        explanation:
          "שעת סיום העבודה קדמה לשעת ההתחלה (שגיאת רישום שטח). הנתון הוחרג מחישובי הזמנים.",
        date: v.date,
        driverId: v.driverId,
        visitKey: v.visitKey,
      });
    }

    // 2. Stop > 60 min with 0 PTO
    if (
      v.ituranStopMinutes !== undefined &&
      v.ituranStopMinutes > 60 &&
      (!v.ptoMinutes || v.ptoMinutes === 0)
    ) {
      anomalies.push({
        id: `stop-${v.visitKey}`,
        type: "long_stop_no_pto",
        severity: "warning",
        title: "עצירה ארוכה מעל 60 דק׳ ללא הפעלת מנוף",
        evidence: `משך עצירה באיתוראן: ${v.ituranStopMinutes} דק׳, PTO: 0 דק׳ בכתובת ${v.address}`,
        explanation:
          "המשאית שהתה באתר זמן רב ללא הפעלת מנוף הידראולי. נדרש בירור האם הייתה המתנה לפריקה ידנית או עיכוב לקוח.",
        date: v.date,
        driverId: v.driverId,
        visitKey: v.visitKey,
      });
    }

    // 3. PTO vs Handwriting mismatch > 10 min
    if (
      v.ptoMinutes !== undefined &&
      v.handwrittenUnloadMinutes !== undefined &&
      Math.abs(v.ptoMinutes - v.handwrittenUnloadMinutes) > 10
    ) {
      anomalies.push({
        id: `mismatch-${v.visitKey}`,
        type: "pto_handwriting_mismatch",
        severity: "warning",
        title: "פער של מעל 10 דק׳ בין איתוראן PTO לכתב יד",
        evidence: `PTO איתוראן: ${v.ptoMinutes} דק׳ מול כתב יד: ${v.handwrittenUnloadMinutes} דק׳ (${v.handwrittenCraneWindow})`,
        explanation:
          "קיים פער מובהק בין שעות הפעלת המנוף שנרשמו בכתב יד לבין זמני העבודה האמיתיים שנמדדו בחיישני המשאית.",
        date: v.date,
        driverId: v.driverId,
        visitKey: v.visitKey,
      });
    }

    // 4. Missing customer signature
    if (v.customerSignature === "לא נמצאה") {
      anomalies.push({
        id: `sig-${v.visitKey}`,
        type: "missing_signature",
        severity: "info",
        title: "חתימת לקוח חסרה בתעודות הביקור",
        evidence: `תעודות: ${v.noteIds.join(", ")} בכתובת ${v.address}`,
        explanation: "לא זוהתה חתימת לקוח דיגיטלית או הערת חתימה בכתב יד עבור תעודות משלוח אלו.",
        date: v.date,
        driverId: v.driverId,
        visitKey: v.visitKey,
      });
    }
  });

  return anomalies;
}

export function buildDayDashboard(
  date: string,
  driverId: DriverId,
  visits: VisitRecord[],
  discs: TachographDiscRow[],
  anomalies: DeterministicAnomaly[],
): DayDashboard {
  const driverVisits = visits.filter((v) => v.date === date && v.driverId === driverId);

  const driver = DRIVERS[driverId];
  const disc = discs.find((d) => {
    const discDate = normalizeDate(d["תאריך מתוקן"] || d["תאריך דיסקית"] || "");
    const discDriver = detectDriver(d["נהג"], d["רישוי / משאית"]);
    return discDate === date && discDriver === driverId;
  });

  const totalKm = disc?.['סה"כ ק"מ'] ? parseFloat(disc['סה"כ ק"מ']) : undefined;

  const ptoMinutesTotal = driverVisits.reduce((acc, v) => acc + (v.ptoMinutes || 0), 0);
  const ptoHours = Math.round((ptoMinutesTotal / 60) * 10) / 10;

  const notesCount = driverVisits.reduce((acc, v) => acc + v.notesCount, 0);

  const validDurations = driverVisits
    .map((v) => v.siteDurationMinutes)
    .filter((d): d is number => d !== undefined && d > 0);
  const medianSiteDuration =
    validDurations.length > 0
      ? validDurations.sort((a, b) => a - b)[Math.floor(validDurations.length / 2)]!
      : 0;

  const dayAnomalies = anomalies.filter(
    (a) => a.date === date && (a.driverId === driverId || !a.driverId),
  );

  const status = dayAnomalies.some((a) => a.severity === "critical")
    ? "suspect"
    : dayAnomalies.some((a) => a.severity === "warning")
      ? "warn"
      : "ok";

  return {
    date,
    rawDate: driverVisits[0]?.rawDate || date,
    driverId,
    driver,
    disc,
    visits: driverVisits,
    totalKm,
    ptoHours,
    totalVisits: driverVisits.length,
    notesCount,
    medianSiteDuration,
    anomalies: dayAnomalies,
    status,
  };
}
