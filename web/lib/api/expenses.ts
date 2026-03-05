import {
  pathExpensesDeleteImported,
  pathCalendarGoogleStatus,
  pathCalendarGoogleConnect,
  pathCalendarGoogleCalendars,
  pathCalendarGoogleCalendarSelection,
  pathCalendarGoogleSync,
  pathCalendarGoogleDisconnect,
  pathCalendarEvents,
  pathCalendarEventById,
  type CalendarEvent as SharedCalendarEvent,
  type CalendarGoogleCalendar as SharedCalendarGoogleCalendar,
  type CalendarGoogleStatus as SharedCalendarGoogleStatus,
  type CreateCalendarEventInput,
  type UpdateCalendarEventInput,
} from "@ideahome/shared-config";
import { pathExpenseById, pathExpenses } from "@ideahome/shared";
import type {
  CreateExpenseInput,
  Expense as SharedExpense,
  UpdateExpenseInput,
} from "@ideahome/shared";
import { requestBlob, requestJson, requestVoid } from "./http";

export type Expense = SharedExpense;
export type CalendarEvent = SharedCalendarEvent;
export type CalendarGoogleStatus = SharedCalendarGoogleStatus;
export type CalendarGoogleCalendar = SharedCalendarGoogleCalendar;

export type TaxDocument = {
  id: string;
  fileUrl: string;
  fileName: string;
  sizeBytes: number;
  kind: string;
  taxYear: number | null;
  notes: string | null;
  textPreview: string | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
};

export type PlaidLinkedAccount = {
  id: string;
  itemId: string;
  institutionName: string | null;
  createdAt: string;
};

export async function fetchExpenses(projectId: string): Promise<Expense[]> {
  return requestJson<Expense[]>(pathExpenses(projectId), {
    errorMessage: "Failed to fetch expenses",
  });
}

export async function createExpense(
  body: CreateExpenseInput
): Promise<Expense> {
  return requestJson<Expense>(pathExpenses(), {
    method: "POST",
    body,
    errorMessage: "Failed to create expense",
  });
}

export async function updateExpense(
  id: string,
  data: UpdateExpenseInput
): Promise<Expense> {
  return requestJson<Expense>(pathExpenseById(id), {
    method: "PATCH",
    body: data,
    errorMessage: "Failed to update expense",
  });
}

export async function deleteExpense(id: string): Promise<void> {
  return requestVoid(pathExpenseById(id), {
    method: "DELETE",
    errorMessage: "Failed to delete expense",
  });
}

export async function fetchTaxDocuments(
  projectId: string
): Promise<TaxDocument[]> {
  return requestJson<TaxDocument[]>(
    `/tax-documents?projectId=${encodeURIComponent(projectId)}`,
    {
      errorMessage: "Failed to fetch tax documents",
    }
  );
}

export async function createTaxDocument(input: {
  projectId: string;
  fileName: string;
  fileBase64: string;
  kind?: string;
  taxYear?: number | null;
  notes?: string | null;
  textPreview?: string | null;
}): Promise<TaxDocument> {
  return requestJson<TaxDocument>("/tax-documents", {
    method: "POST",
    body: input,
    errorMessage: "Failed to upload tax document",
  });
}

export async function updateTaxDocument(
  id: string,
  input: {
    kind?: string;
    taxYear?: number | null;
    notes?: string | null;
    textPreview?: string | null;
  }
): Promise<TaxDocument> {
  return requestJson<TaxDocument>(`/tax-documents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
    errorMessage: "Failed to update tax document",
  });
}

export async function deleteTaxDocument(id: string): Promise<void> {
  return requestVoid(`/tax-documents/${encodeURIComponent(id)}`, {
    method: "DELETE",
    errorMessage: "Failed to delete tax document",
  });
}

export async function downloadTaxDocument(id: string): Promise<Blob> {
  return requestBlob(`/tax-documents/${encodeURIComponent(id)}/download`, {
    errorMessage: "Failed to download tax document",
  });
}

export async function deleteAllImportedExpenses(
  projectId: string
): Promise<{ deleted: number }> {
  return requestJson<{ deleted: number }>(
    pathExpensesDeleteImported(projectId),
    {
      method: "DELETE",
      errorMessage: "Failed to delete imported expenses",
    }
  );
}

export async function getPlaidLinkToken(): Promise<{ linkToken: string }> {
  return requestJson<{ linkToken: string }>("/plaid/link-token", {
    method: "POST",
    errorMessage: "Failed to get Plaid link",
  });
}

export async function exchangePlaidToken(publicToken: string): Promise<{
  itemId: string;
  institutionName?: string;
}> {
  return requestJson<{ itemId: string; institutionName?: string }>(
    "/plaid/exchange",
    {
      method: "POST",
      body: { public_token: publicToken },
      errorMessage: "Failed to connect account",
    }
  );
}

export async function fetchPlaidLinkedAccounts(): Promise<
  PlaidLinkedAccount[]
> {
  return requestJson<PlaidLinkedAccount[]>("/plaid/linked-accounts", {
    errorMessage: "Failed to load linked accounts",
  });
}

export async function renamePlaidLinkedAccount(
  plaidItemId: string,
  institutionName: string | null
): Promise<PlaidLinkedAccount> {
  return requestJson<PlaidLinkedAccount>(
    `/plaid/linked-accounts/${encodeURIComponent(plaidItemId)}`,
    {
      method: "PATCH",
      body: { institutionName },
      errorMessage: "Failed to rename account",
    }
  );
}

export async function syncPlaidTransactions(projectId: string): Promise<{
  added: number;
  lastSyncedAt: string | null;
}> {
  return requestJson<{ added: number; lastSyncedAt: string | null }>(
    `/plaid/sync?projectId=${encodeURIComponent(projectId)}`,
    {
      method: "POST",
      errorMessage: "Failed to sync transactions",
    }
  );
}

export async function getPlaidLastSync(projectId: string): Promise<{
  lastSyncedAt: string | null;
}> {
  return requestJson<{ lastSyncedAt: string | null }>(
    `/plaid/last-sync?projectId=${encodeURIComponent(projectId)}`,
    { errorMessage: "Failed to load last sync" }
  );
}

export async function disconnectPlaidLinkedAccount(
  plaidItemId: string
): Promise<void> {
  return requestVoid(`/plaid/linked-accounts/${encodeURIComponent(plaidItemId)}`, {
    method: "DELETE",
    errorMessage: "Failed to disconnect account",
  });
}

export async function fetchCalendarGoogleStatus(
  projectId: string
): Promise<CalendarGoogleStatus> {
  return requestJson<CalendarGoogleStatus>(pathCalendarGoogleStatus(projectId), {
    errorMessage: "Failed to load Google Calendar status",
  });
}

export async function startGoogleCalendarConnect(
  projectId: string
): Promise<{ url: string }> {
  return requestJson<{ url: string }>(pathCalendarGoogleConnect(projectId), {
    method: "POST",
    errorMessage: "Failed to start Google Calendar connect",
  });
}

export async function fetchGoogleCalendars(
  projectId: string
): Promise<CalendarGoogleCalendar[]> {
  return requestJson<CalendarGoogleCalendar[]>(
    pathCalendarGoogleCalendars(projectId),
    { errorMessage: "Failed to load Google calendars" }
  );
}

export async function setGoogleCalendarSelection(
  projectId: string,
  googleCalendarId: string
): Promise<{ selectedCalendarId: string }> {
  return requestJson<{ selectedCalendarId: string }>(
    pathCalendarGoogleCalendarSelection(projectId),
    {
      method: "PATCH",
      body: { googleCalendarId },
      errorMessage: "Failed to update selected Google calendar",
    }
  );
}

export async function syncGoogleCalendar(
  projectId: string
): Promise<{
  upserted: number;
  deleted: number;
  lastSyncedAt: string;
  fullResync?: boolean;
}> {
  return requestJson<{
    upserted: number;
    deleted: number;
    lastSyncedAt: string;
    fullResync?: boolean;
  }>(pathCalendarGoogleSync(projectId), {
    method: "POST",
    errorMessage: "Failed to sync Google Calendar",
  });
}

export async function disconnectGoogleCalendar(
  projectId: string
): Promise<{ disconnected: boolean }> {
  return requestJson<{ disconnected: boolean }>(
    pathCalendarGoogleDisconnect(projectId),
    {
      method: "DELETE",
      errorMessage: "Failed to disconnect Google Calendar",
    }
  );
}

export async function fetchCalendarEvents(
  projectId: string,
  start: string,
  end: string
): Promise<CalendarEvent[]> {
  return requestJson<CalendarEvent[]>(pathCalendarEvents(projectId, start, end), {
    errorMessage: "Failed to load calendar events",
  });
}

export async function createCalendarEvent(
  projectId: string,
  body: CreateCalendarEventInput
): Promise<CalendarEvent> {
  return requestJson<CalendarEvent>(pathCalendarEvents(projectId), {
    method: "POST",
    body,
    errorMessage: "Failed to create calendar event",
  });
}

export async function updateCalendarEvent(
  projectId: string,
  eventId: string,
  body: UpdateCalendarEventInput
): Promise<CalendarEvent> {
  return requestJson<CalendarEvent>(pathCalendarEventById(eventId, projectId), {
    method: "PATCH",
    body,
    errorMessage: "Failed to update calendar event",
  });
}

export async function deleteCalendarEvent(
  projectId: string,
  eventId: string
): Promise<{ deleted: boolean }> {
  return requestJson<{ deleted: boolean }>(
    pathCalendarEventById(eventId, projectId),
    {
      method: "DELETE",
      errorMessage: "Failed to delete calendar event",
    }
  );
}
