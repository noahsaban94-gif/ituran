// src/lib/api.ts
import { DeliveryNoteRow } from "./types";

export const CUSTOMERS: Record<string, string> = {};

export async function fetchLiveNotes(): Promise<DeliveryNoteRow[]> {
  try {
    const res = await fetch("/api/backend?action=bootstrap");
    const json = await res.json();
    if (json.ok && json.data && json.data.deliveryNotes) {
      return json.data.deliveryNotes;
    }
    return [];
  } catch (err) {
    console.error("Failed to fetch live notes:", err);
    return [];
  }
}

export async function listNotesFn() {
  return await fetchLiveNotes();
}

export async function approvalFn(rowId: number, status: string, approver: string) {
  try {
    const res = await fetch("/api/backend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "saveDisc",
        row: rowId,
        fix: { approve: true, approver }
      }),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function saveSignedNoteFn(data: unknown) {
  return { ok: true, data };
}
