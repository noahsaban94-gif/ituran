import { describe, it, expect } from "vitest";
import {
  detectDriver,
  checkReversedCraneWindow,
  buildVisitsFromNotes,
  detectDeterministicAnomalies,
  normalizeDate,
} from "../lib/data-parser";
import { DeliveryNoteRow, TachographDiscRow } from "../lib/types";

describe("Data Parser & Rules Engine", () => {
  it("correctly identifies drivers based on plate or name", () => {
    expect(detectDriver("עלי אבו עידה", "651-51-701")).toBe("ali");
    expect(detectDriver("חכמת", "615-41-002")).toBe("hikmat");
    expect(detectDriver("חכמת / מסארוה ראמי", "615-41-002")).toBe("hikmat");
  });

  it("detects reversed crane windows", () => {
    // Normal window: 11:15 to 11:25
    const normal = checkReversedCraneWindow("פריקת מנוף משעה 11:15 עד שעה 11:25");
    expect(normal.isReversed).toBe(false);
    expect(normal.minutes).toBe(10);

    // Reversed window: 09:15 to 09:00 (as in note 6715559)
    const reversed = checkReversedCraneWindow("פריקת מנוף משעה 09:15 עד שעה 09:00");
    expect(reversed.isReversed).toBe(true);
  });

  it("normalizes Hebrew dates to YYYY-MM-DD", () => {
    expect(normalizeDate("18/10/2026")).toBe("2026-10-18");
    expect(normalizeDate("05/10/2026")).toBe("2026-10-05");
  });

  it("groups delivery notes into single visit per address and day", () => {
    const notes: DeliveryNoteRow[] = [
      {
        _row: 2,
        "תאריך תעודה": "18/10/2026",
        "מס' תעודת משלוח": "6715845",
        "כתובת אספקה": "מגדל 30, רעננה",
        "שם לקוח": "דני פלדשר",
        נהג: "חכמת",
        "רישוי / משאית": "615-41-002",
      },
      {
        _row: 3,
        "תאריך תעודה": "18/10/2026",
        "מס' תעודת משלוח": "6715846",
        "כתובת אספקה": "מגדל 30, רעננה",
        "שם לקוח": "אלכס פלדשר",
        נהג: "חכמת",
        "רישוי / משאית": "615-41-002",
      },
    ];

    const visits = buildVisitsFromNotes(notes);
    expect(visits.length).toBe(1);
    expect(visits[0]!.notesCount).toBe(2);
    expect(visits[0]!.customers).toContain("דני פלדשר");
    expect(visits[0]!.customers).toContain("אלכס פלדשר");
  });

  it("identifies OCR suspect dates (e.g. 2020/2024)", () => {
    const discs: TachographDiscRow[] = [
      {
        _row: 5,
        "תאריך דיסקית": "13/10/2024",
        "רישוי / משאית": "615-41-002",
      },
    ];

    const anomalies = detectDeterministicAnomalies([], discs);
    const suspect = anomalies.find((a) => a.type === "ocr_suspect_date");
    expect(suspect).toBeDefined();
    expect(suspect?.severity).toBe("critical");
  });
});
