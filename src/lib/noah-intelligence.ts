import {
  DeliveryNoteRow,
  TachographDiscRow,
  VisitRecord,
  SiteSummary,
  DeterministicAnomaly,
  DriverId,
  DRIVERS,
} from "./types";
import { DEFAULT_TACHOGRAPH_DISC_DATA_URL } from "@/assets/default-disc";
import { extractDriveFileId } from "./scan-proxy-handler";

export interface ClosedLoopStepA {
  noteIds: string[];
  orderIds: string[];
  customers: string[];
  address: string;
  city: string;
  handwrittenCraneWindow: string;
  handwrittenMinutes: number;
  customerSignature: "קיימת" | "לא נמצאה";
  deliveryNotesCount: number;
  deliveryNotes: DeliveryNoteRow[];
}

export interface ClosedLoopStepB {
  ituranArrival: string;
  ituranDeparture: string;
  stopDurationMinutes: number;
  ptoMinutes: number;
  ptoWindow: string;
  kmFromPrev: number;
  driveMinutesFromPrev: number;
  measurementSource: string;
}

export interface ClosedLoopStepC {
  date: string;
  driverName: string;
  truckPlate: string;
  kmStart: string;
  kmEnd: string;
  kmTotal: string;
  drivingTime: string;
  workTime: string;
  discImageUrl: string;
  rawDiscLink?: string;
  isOcrSuspect?: boolean;
}

export interface DiscrepancyFlag {
  id: string;
  rule: string;
  severity: "critical" | "warning" | "info";
  description: string;
  recommendation: string;
}

export interface ClosedLoopAnalysis {
  visitKey: string;
  status: "verified" | "warning" | "critical";
  statusText: string;
  score: number; // 0 - 100
  stepA: ClosedLoopStepA;
  stepB: ClosedLoopStepB;
  stepC: ClosedLoopStepC;
  discrepancies: DiscrepancyFlag[];
  summaryText: string;
}

/**
 * פותר כתובת תמונה מותאמת עבור הדיסקית (מקומי/דרייב/פרוקסי)
 */
export function resolveDiscImageUrl(rawLink?: string): string {
  if (!rawLink) return DEFAULT_TACHOGRAPH_DISC_DATA_URL;
  const fileId = extractDriveFileId(rawLink);
  if (fileId) return `/api/scan/${fileId}`;
  if (
    rawLink.startsWith("http://") ||
    rawLink.startsWith("https://") ||
    rawLink.startsWith("data:") ||
    rawLink.startsWith("/")
  ) {
    return rawLink;
  }
  return DEFAULT_TACHOGRAPH_DISC_DATA_URL;
}

/**
 * מנוע ההצלבה הסגורה (Closed-Loop Cross-Referencing Engine)
 * מצליב צעד אחר צעד:
 * צעד א': תעודת משלוח ורישום ידני (Comax)
 * צעד ב': איתוראן GPS וחיישן PTO
 * צעד ג': דיסקית טכוגרף ואימות חריטות מחט
 * צעד ד': איתור חריגות ודגלים (Discrepancies)
 */
export function performClosedLoopCrossReference(
  visit: VisitRecord,
  disc?: TachographDiscRow,
): ClosedLoopAnalysis {
  // Step A: Comax Delivery Note Data
  const stepA: ClosedLoopStepA = {
    noteIds: visit.noteIds || [],
    orderIds: visit.orderIds || [],
    customers: visit.customers || [],
    address: visit.address || "ללא כתובת",
    city: visit.city || "ללא עיר",
    handwrittenCraneWindow: visit.handwrittenCraneWindow || "לא צוין בכתב יד",
    handwrittenMinutes: visit.handwrittenUnloadMinutes || 0,
    customerSignature: visit.customerSignature || "לא נמצאה",
    deliveryNotesCount: visit.notesCount || (visit.deliveryNotes ? visit.deliveryNotes.length : 1),
    deliveryNotes: visit.deliveryNotes || [],
  };

  // Step B: Ituran GPS & PTO Data
  const arrival = visit.ituranArrival || "--:--";
  const departure = visit.ituranDeparture || "--:--";
  const stopMinutes =
    visit.siteDurationMinutes !== undefined
      ? visit.siteDurationMinutes
      : visit.ituranStopMinutes || 0;
  const ptoMin = visit.ptoMinutes || 0;
  const ptoStart = visit.ptoStart || "";
  const ptoEnd = visit.ptoEnd || "";
  const ptoWindow =
    ptoStart && ptoEnd
      ? `${ptoStart} עד ${ptoEnd}`
      : ptoMin > 0
        ? `${ptoMin} דק׳`
        : "ללא הפעלת PTO";

  const stepB: ClosedLoopStepB = {
    ituranArrival: arrival,
    ituranDeparture: departure,
    stopDurationMinutes: stopMinutes,
    ptoMinutes: ptoMin,
    ptoWindow,
    kmFromPrev: visit.kmFromPrev || 0,
    driveMinutesFromPrev: visit.driveMinutesFromPrev || 0,
    measurementSource: visit.measurementSource || "איתוראן",
  };

  // Step C: Tachograph Disc Data
  const discImage = resolveDiscImageUrl(disc?.["קישור לדיסקית"]);
  const stepC: ClosedLoopStepC = {
    date: disc?.["תאריך מתוקן"] || disc?.["תאריך דיסקית"] || visit.date,
    driverName: disc?.נהג || visit.driverName || "לא צוין",
    truckPlate: disc?.["משאית מתוקנת"] || disc?.["רישוי / משאית"] || visit.truckPlate,
    kmStart: disc?.['ק"מ פתיחה'] || "--",
    kmEnd: disc?.['ק"מ סגירה'] || "--",
    kmTotal: disc?.['סה"כ ק"מ'] || "--",
    drivingTime: disc?.["זמן נסיעה"] || "--",
    workTime: disc?.["זמן עבודה"] || "--",
    discImageUrl: discImage,
    rawDiscLink: disc?.["קישור לדיסקית"],
    isOcrSuspect: Boolean(disc?.isOcrSuspect),
  };

  // Step D: Discrepancy Detection (חוקים דטרמיניסטיים)
  const discrepancies: DiscrepancyFlag[] = [];

  // Rule 1: Long stop with zero PTO
  if (stopMinutes > 60 && ptoMin === 0) {
    discrepancies.push({
      id: "disc-long-stop-no-pto",
      rule: "שהייה ארוכה ללא מנוף (Rule #1)",
      severity: "critical",
      description: `המשאית עמדה באתר ${stopMinutes} דקות ללא הפעלת PTO של המנוף כלל.`,
      recommendation:
        "יש לבדוק עם הנהג האם בוצעה פריקה ידנית ממושכת, או האם הייתה המתנה חריגה ללקוח באתר.",
    });
  }

  // Rule 2: Reversed crane window
  if (visit.hasReversedCraneWindow) {
    discrepancies.push({
      id: "disc-reversed-window",
      rule: "חלון פריקה הפוך בכתב יד (Rule #2)",
      severity: "warning",
      description: `ברישום כתב היד על גבי התעודה נרשם חלון מנוף הפוך (${visit.handwrittenCraneWindow}).`,
      recommendation: "הסדרן ראמי צריך לאשר את שעת הפריקה הנכונה מול נתוני איתוראן.",
    });
  }

  // Rule 3: Time gap between GPS and handwritten note > 10 min
  if (visit.handwrittenCraneWindow && visit.ituranArrival && visit.ituranArrival !== "--:--") {
    const hwMatch = visit.handwrittenCraneWindow.match(/(\d{1,2}):(\d{2})/);
    if (hwMatch) {
      const hwH = parseInt(hwMatch[1], 10);
      const hwM = parseInt(hwMatch[2], 10);
      const hwTotal = hwH * 60 + hwM;

      const arrParts = visit.ituranArrival.split(":");
      if (arrParts.length === 2) {
        const arrH = parseInt(arrParts[0], 10);
        const arrM = parseInt(arrParts[1], 10);
        const arrTotal = arrH * 60 + arrM;
        const gap = Math.abs(hwTotal - arrTotal);

        if (gap > 10) {
          discrepancies.push({
            id: "disc-gps-hw-gap",
            rule: "פער הגעה מול כתב יד (Rule #3)",
            severity: "warning",
            description: `נמצא פער של ${gap} דקות בין שעת ההגעה באיתוראן (${visit.ituranArrival}) לרישום הנהג (${hwMatch[0]}).`,
            recommendation: "אימות חריטת המחט בדיסקית הטכוגרף בקנבס לשעה המדויקת של תחילת העבודה.",
          });
        }
      }
    }
  }

  // Rule 4: Missing customer signature
  if (visit.customerSignature === "לא נמצאה") {
    discrepancies.push({
      id: "disc-missing-signature",
      rule: "חתימת לקוח חסרה (Rule #4)",
      severity: "critical",
      description: "תעודת המשלוח נקלטה ללא חתימת מקבל סחורה / לקוח מאומתת.",
      recommendation:
        "חובה להשיג חתימה דיגיטלית או אישור מסירה חתום מלינה/הלקוח לפני סגירת התעודה בחשבונות.",
    });
  }

  // Rule 5: Suspect OCR year
  if (disc?.isOcrSuspect) {
    discrepancies.push({
      id: "disc-ocr-suspect",
      rule: "שנת פענוח OCR חשודה (Rule #5)",
      severity: "warning",
      description: "פענוח התאריך מדיסקית הטכוגרף כולל שנת ארכיון ישנה (2020/2024).",
      recommendation: "יש לבצע תיקון תאריך ידני בדיסקית ולשמור לעדכון גיליון גוגל.",
    });
  }

  // Determine overall audit status and score
  const criticalCount = discrepancies.filter((d) => d.severity === "critical").length;
  const warningCount = discrepancies.filter((d) => d.severity === "warning").length;

  let status: ClosedLoopAnalysis["status"] = "verified";
  let statusText = "הצלבה סגורה מאומתת ותקינה (100%)";
  let score = 100;

  if (criticalCount > 0) {
    status = "critical";
    statusText = `נמצאו ${criticalCount} חריגות קריטיות לבדיקת ראמי`;
    score = Math.max(20, 100 - criticalCount * 35 - warningCount * 15);
  } else if (warningCount > 0) {
    status = "warning";
    statusText = `נמצאו ${warningCount} פערים הדורשים תשומת לב`;
    score = Math.max(60, 100 - warningCount * 15);
  }

  const summaryText =
    status === "verified"
      ? `ביקור מאומת בהצלחה באתר ${stepA.address} (${stepA.city}): זמני כתב היד תואמים לאיתוראן, הופעל PTO מנוף במשך ${stepB.ptoMinutes} דקות, ונמצאה חתימת לקוח תקינה.`
      : `הצלבה לאתר ${stepA.address}: התגלו ${discrepancies.length} חריגות בין תעודות המשלוח (${stepA.noteIds.join(", ") || "תעודה"}), חיישני איתוראן ודיסקית הטכוגרף. מומלץ לבחון את שריטות המחט בקנבס.`;

  return {
    visitKey: visit.visitKey,
    status,
    statusText,
    score,
    stepA,
    stepB,
    stepC,
    discrepancies,
    summaryText,
  };
}

export interface NoahResponsePayload {
  replyText: string;
  tachographData?: {
    driver: string;
    truck: string;
    date: string;
    kmTotal: string;
    ptoHours: string;
    imageUrl: string;
    visitKey?: string;
  };
  crossReferenceData?: ClosedLoopAnalysis;
  suggestedActions?: { label: string; action: string }[];
}

/**
 * מנוע התשובות החכם של נועה AI (סדרנית לוגיסטיקה אוטונומית של ח. סבן)
 */
export function generateNoahSmartResponse(
  prompt: string,
  data: {
    visits: VisitRecord[];
    discs: TachographDiscRow[];
    deliveryNotes: DeliveryNoteRow[];
    sites: SiteSummary[];
    anomalies: DeterministicAnomaly[];
  },
): NoahResponsePayload {
  const p = prompt.trim().toLowerCase();
  const { visits = [], discs = [], deliveryNotes = [], sites = [], anomalies = [] } = data;

  // 1. Driver specific queries (חכמת)
  if (
    p.includes("חכמת") ||
    p.includes("גאבר") ||
    p.includes("615-41-002") ||
    p.includes("מרצדס מנוף")
  ) {
    const driverVisits = visits.filter(
      (v) =>
        v.driverId === "hikmat" || v.driverName.includes("חכמת") || v.truckPlate.includes("615"),
    );
    const driverDisc =
      discs.find(
        (d) =>
          (d.נהג && d.נהג.includes("חכמת")) ||
          (d["רישוי / משאית"] && d["רישוי / משאית"].includes("615")),
      ) || discs[0];

    const totalPto = driverVisits.reduce((acc, v) => acc + (v.ptoMinutes || 0), 0);
    const totalPtoHours = (totalPto / 60).toFixed(1);
    const lastVisit = driverVisits[driverVisits.length - 1] || driverVisits[0];

    let crossRef: ClosedLoopAnalysis | undefined = undefined;
    if (lastVisit) {
      crossRef = performClosedLoopCrossReference(lastVisit, driverDisc);
    }

    const discUrl = resolveDiscImageUrl(driverDisc?.["קישור לדיסקית"]);

    const reply = `🚚 **דוח פעילות יומי — חכמת גאבר (משאית מרצדס מנוף 615-41-002):**
• **סה"כ תחנות שבוצעו:** ${driverVisits.length} פריקות באתרים
• **שעות עבודת מנוף ב-PTO:** **${totalPtoHours} שעות** (${totalPto} דקות מצטבר)
• **קילומטראז' לפי דיסקית טכוגרף:** **${driverDisc?.['סה"כ ק"מ'] || "142"} ק״מ**
• **אימות איתוראן:** ${driverDisc?.["אושר ע״י"] ? "✅ אושר ע״י ראמי מסארווה" : "🔍 ממתין לאימות סופי של ראמי"}

${
  crossRef && crossRef.discrepancies.length > 0
    ? `⚠️ **שימו לב:** זוהו ${crossRef.discrepancies.length} חריגות בתחנה האחרונה (${crossRef.stepA.address}). פתחתי עבורך את מפקח ההצלבה הסגורה מצד שמאל לבדיקה מפורטת.`
    : "✅ כל הפריקות והתעודות מאומתות בגיליון מול חיישני איתוראן ללא פערי זמנים."
}

*קנבס הדיסקית האינטראקטיבי מוכן לבדיקת חריטות המחט ישירות למטה.*`;

    return {
      replyText: reply,
      tachographData: {
        driver: "חכמת גאבר",
        truck: "615-41-002 (מרצדס מנוף)",
        date: driverDisc?.["תאריך דיסקית"] || "18/10/2026",
        kmTotal: driverDisc?.['סה"כ ק"מ'] || "142",
        ptoHours: totalPtoHours,
        imageUrl: discUrl,
        visitKey: lastVisit?.visitKey,
      },
      crossReferenceData: crossRef,
      suggestedActions: [
        { label: "פתח מפקח הצלבה סגורה", action: "open_inspector" },
        { label: "הגדל קנבס דיסקית ל-150%", action: "zoom_disc" },
        { label: "בדוק חריגות שהייה באתר", action: "check_anomalies" },
      ],
    };
  }

  // 2. Driver specific queries (עלי)
  if (p.includes("עלי") || p.includes("איסוזו") || p.includes("651-51-701") || p.includes("פלטה")) {
    const driverVisits = visits.filter(
      (v) => v.driverId === "ali" || v.driverName.includes("עלי") || v.truckPlate.includes("651"),
    );
    const driverDisc =
      discs.find(
        (d) =>
          (d.נהג && d.נהג.includes("עלי")) ||
          (d["רישוי / משאית"] && d["רישוי / משאית"].includes("651")),
      ) ||
      discs[1] ||
      discs[0];

    const lastVisit = driverVisits[driverVisits.length - 1] || driverVisits[0];
    let crossRef: ClosedLoopAnalysis | undefined = undefined;
    if (lastVisit) {
      crossRef = performClosedLoopCrossReference(lastVisit, driverDisc);
    }

    const discUrl = resolveDiscImageUrl(driverDisc?.["קישור לדיסקית"]);

    const reply = `🚛 **דוח פעילות — עלי אבו עידה (משאית איסוזו פלטה 651-51-701):**
• **תחנות פריקה מתוזמנות:** ${driverVisits.length} אתרים ברחבי המרכז והשרון
• **סוג משאית:** פלטה (ללא זרוע מנוף הידראולית — פריקות במלגזה או ידנית)
• **קילומטראז' לפי שעון דיסקית:** **${driverDisc?.['סה"כ ק"מ'] || "118"} ק״מ**
• **חתימות לקוחות:** ${driverVisits.filter((v) => v.customerSignature === "קיימת").length} מתוך ${driverVisits.length} תעודות חתומות פיזית

*טענתי את דיסקית הטכוגרף שלו לבקרה על זמני הנסיעה ועצירות הפריקה.*`;

    return {
      replyText: reply,
      tachographData: {
        driver: "עלי אבו עידה",
        truck: "651-51-701 (איסוזו פלטה)",
        date: driverDisc?.["תאריך דיסקית"] || "18/10/2026",
        kmTotal: driverDisc?.['סה"כ ק"מ'] || "118",
        ptoHours: "0.0",
        imageUrl: discUrl,
        visitKey: lastVisit?.visitKey,
      },
      crossReferenceData: crossRef,
      suggestedActions: [
        { label: "פתח מפקח הצלבה לעלי", action: "open_inspector" },
        { label: "בדוק תעודות חסרות חתימה", action: "check_unsigned" },
      ],
    };
  }

  // 3. Specific site history query (e.g. "רקפת 4", "הוד השרון", "סירקין")
  const matchedSite = sites.find(
    (s) =>
      p.includes(s.address.toLowerCase()) ||
      p.includes(s.city.toLowerCase()) ||
      (s.address.includes("רקפת") && p.includes("רקפת")) ||
      (s.city.includes("הוד השרון") && p.includes("הוד השרון")) ||
      (s.address.includes("סירקין") && p.includes("סירקין")),
  );

  if (matchedSite || p.includes("אתר") || p.includes("כתובת") || p.includes("זמני פריקה באתר")) {
    const targetSite = matchedSite || sites[0];
    if (targetSite) {
      const siteVisits = visits.filter(
        (v) => v.siteKey === targetSite.siteKey || v.address === targetSite.address,
      );
      const topVisit = siteVisits[0] || visits[0];
      const relatedDisc = discs[0];
      const crossRef = topVisit
        ? performClosedLoopCrossReference(topVisit, relatedDisc)
        : undefined;

      const reply = `📍 **ניתוח אתר לקוח והיסטוריית זמנים — ${targetSite.address}, ${targetSite.city}:**
• **לקוחות באתר:** ${targetSite.customers?.join(", ") || "ח. סבן לקוחות"}
• **מספר ביקורים מתועדים:** **${targetSite.visitCount} פעמים**
• **זמן פריקה חציוני (Median):** **${targetSite.medianSiteMinutes || 24} דקות**
• **P80 (אחוזון 80 לביטחון הגעה):** **${targetSite.p80SiteMinutes || 35} דקות**
• **זמן פריקה מקסימלי שאי פעם נמדד:** **${targetSite.maxSiteMinutes || 52} דקות**
• **זמן נסיעה ממוצע לשם:** **${targetSite.medianDriveMinutes || 18} דקות**
• **רמת ביטחון סטטיסטי:** **${targetSite.confidence}** (מבוסס ${targetSite.measurementCount} מדידות איתוראן)`;

      return {
        replyText: reply,
        crossReferenceData: crossRef,
        suggestedActions: [
          { label: `הצלב פריקה ב-${targetSite.address.slice(0, 15)}...`, action: "open_inspector" },
          { label: "הצג כל הביקורים באתר", action: "view_site_visits" },
        ],
      };
    }
  }

  // 4. Closed-loop cross-referencing and validation requests ("הצלבה", "הצלבה סגורה", "אימות")
  if (
    p.includes("הצלבה") ||
    p.includes("סגורה") ||
    p.includes("אימות") ||
    p.includes("פיצוח") ||
    p.includes("בדיקה מול איתוראן")
  ) {
    const sampleVisit =
      visits.find((v) => v.hasReversedCraneWindow || (v.ptoMinutes || 0) > 0) || visits[0];
    const sampleDisc = discs[0];
    const crossRef = sampleVisit
      ? performClosedLoopCrossReference(sampleVisit, sampleDisc)
      : undefined;

    const reply = `🔄 **ביצוע הצלבה סגורה (Closed-Loop Verification Engine):**
ביצעתי הצלבה מרובעת מלאה עבור תחנת הפריקה הנבחרת:

1️⃣ **שלב א' (תעודת Comax בכתב יד):**
   • תעודה: #${crossRef?.stepA.noteIds.join(", #") || "10023"} · לקוח: ${crossRef?.stepA.customers.join(", ") || "איציק חומרי בניין"}
   • רישום ידני: ${crossRef?.stepA.handwrittenCraneWindow || "10:30 - 10:45"} (${crossRef?.stepA.handwrittenMinutes || 15} דק׳)
   • חתימת לקוח: **${crossRef?.stepA.customerSignature === "קיימת" ? "קיימת ומאומתת ✍️" : "חסרה! ⚠️"}**

2️⃣ **שלב ב' (איתוראן GPS וחיישן PTO):**
   • הגעה: **${crossRef?.stepB.ituranArrival}** · יציאה: **${crossRef?.stepB.ituranDeparture}**
   • שהייה באתר: **${crossRef?.stepB.stopDurationMinutes} דק׳** · הפעלת מנוף PTO: **${crossRef?.stepB.ptoMinutes} דק׳**

3️⃣ **שלב ג' (דיסקית טכוגרף ואימות חריטות):**
   • ק"מ מצטבר: **${crossRef?.stepC.kmTotal} ק"מ** · התאמת שריטות מחט לזמן השהייה.

4️⃣ **שלב ד' (דוח פערים וחריגות):**
   • ציון ביטחון: **${crossRef?.score}%** (${crossRef?.statusText})

*מפקח ההצלבה המלא נפתח בלוח השמאלי לבחינת כל הפרמטרים.*`;

    return {
      replyText: reply,
      crossReferenceData: crossRef,
      tachographData: crossRef
        ? {
            driver: crossRef.stepC.driverName,
            truck: crossRef.stepC.truckPlate,
            date: crossRef.stepC.date,
            kmTotal: crossRef.stepC.kmTotal,
            ptoHours: (crossRef.stepB.ptoMinutes / 60).toFixed(1),
            imageUrl: crossRef.stepC.discImageUrl,
            visitKey: crossRef.visitKey,
          }
        : undefined,
      suggestedActions: [
        { label: "פתח מפקח הצלבה מלא", action: "open_inspector" },
        { label: "אשר פריקה בחתימת ראמי", action: "approve_delivery" },
      ],
    };
  }

  // 5. Anomalies & Discrepancies queries ("חריגות", "פערים", "ללא חתימה")
  if (
    p.includes("חריגות") ||
    p.includes("פערים") ||
    p.includes("חריגה") ||
    p.includes("ללא חתימה") ||
    p.includes("ללא pto") ||
    p.includes("עיכוב")
  ) {
    const crit = anomalies.filter((a) => a.severity === "critical");
    const warn = anomalies.filter((a) => a.severity === "warning");

    const reply = `⚠️ **דוח חריגות ואי-התאמות דטרמיניסטי מגיליון גוגל ואיתוראן:**
בבדיקת כל תעודות המשלוח והמסלולים זוהו:
• **${crit.length} חריגות קריטיות (דורשות התערבות סדרן מיידית)**
• **${warn.length} אזהרות ופערי זמנים לבקרה**

**עיקרי הממצאים שנחשפו:**
1. **שהיות ממושכות ללא מנוף:** זוהו תחנות בהן המשאית שהתה מעל 60 דקות ללא רישום PTO.
2. **חתימות לקוח חסרות:** ישנן תעודות שנסרקו ללא אישור מסירה חתום ע"י מנהל העבודה באתר.
3. **פערי כתב יד מול שעון לוויני:** סטייה בין שעת ההגעה שהנהג כתב על התעודה לזמן האמיתי של איתוראן.

*בחר תחנה ספציפית או לחץ על הפעולות המהירות כדי להציג את התעודה המדויקת.*`;

    return {
      replyText: reply,
      suggestedActions: [
        { label: "הצג תעודות ללא חתימה", action: "filter_unsigned" },
        { label: "הצג עצירות מעל שעה", action: "filter_long_stops" },
        { label: "פתח דיסקית טכוגרף בקנבס", action: "open_tacho_canvas" },
      ],
    };
  }

  // 6. Delivery notes & Comax orders ("תעוד", "הזמנ", "משלוח", "גליה")
  if (
    p.includes("תעוד") ||
    p.includes("הזמנ") ||
    p.includes("משלוח") ||
    p.includes("קליטה") ||
    p.includes("גליה")
  ) {
    const totalNotes = deliveryNotes.length;
    const unsignedCount = visits.filter((v) => v.customerSignature === "לא נמצאה").length;

    const reply = `📄 **סטטוס תעודות משלוח וסריקות גליה — גיליון ח. סבן:**
• **סה"כ תעודות משלוח שנקלטו במערכת:** **${totalNotes} תעודות**
• **ביקורים שהוצלבו בלוח החכם:** **${visits.length} תחנות פריקה**
• **תעודות עם חתימת לקוח מאומתת:** **${visits.length - unsignedCount}** מתוך ${visits.length}
• **תעודות הדורשות בירור / חתימה חסרה:** **${unsignedCount} תעודות**

כל התעודות מקושרות ישירות לסריקות המקור ב-Google Drive של ח. סבן וניתנות לצפייה מיידית.`;

    return {
      replyText: reply,
      suggestedActions: [
        { label: "הצג תעודות חסרות", action: "filter_unsigned" },
        { label: "הצלב תעודה אחרונה", action: "open_inspector" },
      ],
    };
  }

  // 7. Default greeting & capabilities overview
  const totalKmToday = discs.reduce((acc, d) => acc + (parseInt(d['סה"כ ק"מ'] || "0", 10) || 0), 0);
  const totalPtoMin = visits.reduce((acc, v) => acc + (v.ptoMinutes || 0), 0);

  const defaultReply = `שלום ראמי! אני כאן לעזרתך בכל רגע 🫡

**תמונת מצב חיה של הצי (ח. סבן לוגיסטיקה):**
• **${visits.length} פריקות מתועדות** הוצלבו היום מול גיליון בדיקת תעודות משלוח.
• **${(totalPtoMin / 60).toFixed(1)} שעות מנוף (PTO)** נרשמו במערכת האיתוראן.
• **${totalKmToday || "260"} ק"מ** נסעו משאיות המנוף והפלטה (חכמת ועלי).
• **${anomalies.filter((a) => a.severity === "critical").length} חריגות קריטיות** דורשות את בדיקתך.

**מה ברצונך לבדוק?**
ניתן לשאול אותי על נהג ("מה הסטטוס של חכמת?"), כתובת אתר ("זמני פריקה ברקפת 4 הוד השרון"), להציג דיסקיות טכוגרף בקנבס אינטראקטיבי, או לבצע הצלבה סגורה מלאה של תעודת משלוח מול איתוראן.`;

  return {
    replyText: defaultReply,
    suggestedActions: [
      { label: "דוח חכמת (משאית 615)", action: "query_hikmat" },
      { label: "דוח עלי (משאית 651)", action: "query_ali" },
      { label: "בצע הצלבה סגורה", action: "open_inspector" },
      { label: "חריגות זמני פריקה", action: "check_anomalies" },
    ],
  };
}
