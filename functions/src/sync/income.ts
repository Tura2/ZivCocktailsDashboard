import { clickupRequest, DAYS_BACK, ICOUNT_PAGE_SIZE, icountRequest, normalizeText, parseAmount, parseDateToTsMs, safeInt, sleep } from './clients';

const CLICKUP_API_URL = 'https://api.clickup.com/api/v2';

const CLICKUP_INCOME_LIST_ID = '901214544871';

const FIELD_IDS = {
  amount: '94a9e4c2-0170-43c7-908a-1a3321f4869d',
  issueDate: '7e750ecb-e7b5-468c-9745-86207650a71b',
  docType: '0b9dcd3f-113e-4dbe-a1fd-8d7eaa8a402f',
  pdfLink: '88191910-f007-48d7-9210-6e8e37eddcce',
  clientName: '189f2964-7e1c-4d16-8657-d6c944ea2db2',
  icountIdNumber: '46aa14b0-ae48-4b5a-a2e0-56cf80ab015b',
  icountIdText: 'f70d0f36-55a6-4d2b-a1b3-ebee431a2f8c',
} as const;

const ALLOWED_DOCTYPES = new Set([
  'invoice',
  'receipt',
  'invoice_receipt',
  'credit_note',
  'inv',
  'rec',
  'invrec',
  'return',
]);

const DOCTYPE_NAME_MAP: Record<string, string> = {
  invoice: 'Invoice',
  inv: 'Invoice',
  receipt: 'Receipt',
  rec: 'Receipt',
  invoice_receipt: 'Invoice Receipt',
  invrec: 'Invoice Receipt',
  credit_note: 'Credit Note',
  return: 'Credit Note',
};

type ClickupField = any;

type IcountResponse = any;

class IcountPermissionError extends Error {
  readonly attempts: string[];

  constructor(message: string, attempts: string[]) {
    super(message);
    this.name = 'IcountPermissionError';
    this.attempts = attempts;
  }
}

async function icountDocSearch(params: Record<string, any>): Promise<IcountResponse> {
  // iCount modules for documents differ between accounts / API revisions.
  // Expenses works via module=expense, action=search, but income docs may require a different module name.
  // We try a small set of known variants and only fail hard if none are permitted.
  const candidates: Array<{ module: string; action: string }> = [
    { module: 'doc', action: 'search' },
    { module: 'docs', action: 'search' },
    { module: 'document', action: 'search' },
    { module: 'documents', action: 'search' },
  ];

  const attemptNotes: string[] = [];
  let lastResp: any = null;

  for (const c of candidates) {
    const resp: IcountResponse = await icountRequest(c.module, c.action, params);
    lastResp = resp;

    if (!resp) return resp;

    if ((resp as any)?.status === false) {
      const reason = String((resp as any)?.reason ?? 'Unknown');
      const reasonNorm = reason.trim().toLowerCase();
      attemptNotes.push(`${c.module}/${c.action}: ${reason}`);

      // Only fall back to alternate module names when the module itself is not recognized.
      // IMPORTANT: `not_allowed` can be a valid response for a specific query/parameter
      // even when the module works (and we *do* see doc/search working via too_many_results).
      if (/(^|\b)(bad_module|unknown_module|unknown_method)(\b|$)/.test(reasonNorm)) {
        continue;
      }

      // Some other document-specific error (e.g. too_many_results / no_results_found) should be handled upstream.
      return resp;
    }

    // Success
    return resp;
  }

  const tail = attemptNotes.length ? ` Attempts: ${attemptNotes.join(' | ')}` : '';
  const lastReason = String(lastResp?.reason ?? 'not_allowed');
  throw new IcountPermissionError(
    `Failed to fetch income docs: ${lastReason}. iCount rejected document search for all known document modules. ` +
      `This is usually either (1) token/account lacks document API access or (2) the account uses a different document module than expected.` +
      `${tail}`,
    attemptNotes,
  );
}
class IcountTooManyResultsError extends Error {
  readonly startDate: string;
  readonly endDate: string;

  constructor(startDate: string, endDate: string, reason: string) {
    super(`Failed to fetch income docs: ${reason}`);
    this.name = 'IcountTooManyResultsError';
    this.startDate = startDate;
    this.endDate = endDate;
  }
}

type NormalizedIncomeDoc = {
  doctype: string;
  docnum: string;
  icountId: number;
  clientName: string;
  dateIssued: string;
  amount: number;
  pdfLink: string | null;
  status: 'Paid' | 'Cancelled';
};

function parseIcountResponseAsList(response: any): any[] {
  if (!response) return [];

  for (const key of ['docs', 'documents', 'results_list', 'data']) {
    if (key in response) {
      const data = response[key];
      if (Array.isArray(data)) return data;
      if (data && typeof data === 'object') return Object.values(data);
    }
  }

  if (Array.isArray(response)) return response;

  if (response && typeof response === 'object') {
    for (const v of Object.values(response)) {
      if (Array.isArray(v)) return v;
      if (v && typeof v === 'object') {
        const first = Object.values(v as any)[0];
        if (first && typeof first === 'object' && !Array.isArray(first)) return Object.values(v as any);
      }
    }
  }

  return [];
}

async function fetchDocTypeDropdownOptions(): Promise<Record<string, string | number>> {
  const url = `${CLICKUP_API_URL}/list/${CLICKUP_INCOME_LIST_ID}/field`;
  const data = await clickupRequest<{ fields: ClickupField[] }>('GET', url, {});

  const fields = Array.isArray(data?.fields) ? data.fields : [];
  const f = fields.find((x) => x?.id === FIELD_IDS.docType);
  if (!f) throw new Error('Doc Type field not found on Income list');

  const options: any[] = Array.isArray(f?.type_config?.options) ? f.type_config.options : [];
  const mapping: Record<string, string | number> = {};
  for (const opt of options) {
    const name = opt?.name;
    if (!name) continue;
    const key = normalizeText(String(name));
    if (opt?.id) mapping[key] = String(opt.id);
    if (opt?.orderindex != null) mapping[key] ??= Number(opt.orderindex);
  }

  return mapping;
}

function mapDoctypeToClickupValue(icountDoctype: string, optionMap: Record<string, string | number>): { display: string; value: string | number | null } {
  const display = DOCTYPE_NAME_MAP[normalizeText(icountDoctype)] ?? 'Invoice';
  const key = normalizeText(display);

  if (key in optionMap) return { display, value: optionMap[key] };

  for (const [optName, optVal] of Object.entries(optionMap)) {
    if (key.includes(optName) || optName.includes(key)) {
      return { display: optName, value: optVal };
    }
  }

  return { display, value: null };
}

function buildTaskName(docTypeDisplay: string, docNumber: string, clientName: string): string {
  const n = String(docNumber || '').trim();
  const c = String(clientName || '').trim() || 'Unknown Client';
  const prefix = String(docTypeDisplay || 'Invoice').trim().toLowerCase();
  return n ? `${prefix} #${n} - ${c}` : `${prefix} - ${c}`;
}

function normalizeDoc(doc: Record<string, any>): NormalizedIncomeDoc | null {
  const doctypeRaw = doc.doctype ?? doc.doc_type ?? doc.Type;
  const doctype = normalizeText(String(doctypeRaw ?? ''));

  const docnum = doc.docnum ?? doc.doc_num ?? doc.docnumber ?? doc.ID;
  const docId = doc.doc_id ?? doc.id ?? doc.document_id;

  let icountId = safeInt(docnum);
  if (icountId == null) icountId = safeInt(docId);
  if (icountId == null) return null;

  const clientName = String(doc.client_name ?? doc.Client ?? doc.client ?? '').trim();
  const dateIssued = String(doc.dateissued ?? doc.date ?? doc.Date ?? '').trim();

  const amountRaw = doc.total ?? doc.totalwithvat ?? doc.totalpaid ?? doc.sum ?? doc.Amount;
  const amount = parseAmount(amountRaw);

  const pdfLinkRaw = doc.public_link ?? doc.doc_url ?? doc.Link;
  const pdfLink = String(pdfLinkRaw ?? '').trim() || null;

  const statusRaw = doc.status ?? doc.Status;
  let status: 'Paid' | 'Cancelled' = 'Paid';
  if (['cancelled', 'canceled', 'void', '-1', '3'].includes(normalizeText(String(statusRaw ?? '')))) {
    status = 'Cancelled';
  }

  return {
    doctype,
    docnum: String(docnum ?? '').trim(),
    icountId,
    clientName,
    dateIssued,
    amount,
    pdfLink,
    status,
  };
}

async function findExistingTask(norm: NormalizedIncomeDoc, issueDateTs: number | null): Promise<any | null> {
  const url = `${CLICKUP_API_URL}/list/${CLICKUP_INCOME_LIST_ID}/task`;

  // 1) iCount ID (number + text)
  for (const [fieldId, value] of [
    [FIELD_IDS.icountIdNumber, norm.icountId],
    [FIELD_IDS.icountIdText, String(norm.icountId)],
  ] as const) {
    try {
      const tasksData = await clickupRequest<{ tasks: any[] }>('GET', url, {
        query: {
          include_closed: 'true',
          archived: 'false',
          custom_fields: JSON.stringify([{ field_id: fieldId, operator: '=', value }]),
        },
      });
      const tasks = Array.isArray(tasksData?.tasks) ? tasksData.tasks : [];
      if (tasks.length) return tasks[0];
    } catch {
      // ignore
    }
  }

  // 2) PDF link
  if (norm.pdfLink) {
    try {
      const tasksData = await clickupRequest<{ tasks: any[] }>('GET', url, {
        query: {
          include_closed: 'true',
          archived: 'false',
          custom_fields: JSON.stringify([{ field_id: FIELD_IDS.pdfLink, operator: '=', value: norm.pdfLink }]),
        },
      });
      const tasks = Array.isArray(tasksData?.tasks) ? tasksData.tasks : [];
      if (tasks.length) return tasks[0];
    } catch {
      // ignore
    }
  }

  // 3) Amount + date tolerance
  try {
    const tasksData = await clickupRequest<{ tasks: any[] }>('GET', url, {
      query: {
        include_closed: 'true',
        archived: 'false',
        custom_fields: JSON.stringify([{ field_id: FIELD_IDS.amount, operator: '=', value: norm.amount }]),
      },
    });

    const tasks = Array.isArray(tasksData?.tasks) ? tasksData.tasks : [];
    for (const task of tasks) {
      const fields: any[] = Array.isArray(task?.custom_fields) ? task.custom_fields : [];
      const issueField = fields.find((f) => f?.id === FIELD_IDS.issueDate);
      const taskTs = issueField?.value != null ? Number(issueField.value) : null;
      if (taskTs != null && issueDateTs != null) {
        const diff = Math.abs(taskTs - issueDateTs);
        if (diff < 86_400_000) return task;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

function buildIncomeCustomFields(norm: NormalizedIncomeDoc, issueDateTs: number | null, docTypeValue: string | number | null): any[] {
  const fields: any[] = [
    { id: FIELD_IDS.amount, value: norm.amount },
    { id: FIELD_IDS.clientName, value: norm.clientName },
    { id: FIELD_IDS.icountIdNumber, value: norm.icountId },
    { id: FIELD_IDS.icountIdText, value: String(norm.icountId) },
  ];

  if (issueDateTs != null) fields.push({ id: FIELD_IDS.issueDate, value: issueDateTs });
  if (docTypeValue != null) fields.push({ id: FIELD_IDS.docType, value: docTypeValue });
  if (norm.pdfLink) fields.push({ id: FIELD_IDS.pdfLink, value: norm.pdfLink });

  return fields;
}

async function fetchIcountIncomeDocs(startDate: string, endDate: string, pageSize: number): Promise<any[]> {
  const queryDoctypes = ['invoice', 'receipt', 'invrec'];














  function parseIsoDate(s: string): Date {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) throw new Error(`Invalid date format (expected YYYY-MM-DD): ${s}`);
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }

  function toIsoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  function addDays(d: Date, days: number): Date {
    return new Date(d.getTime() + days * 86_400_000);
  }

  async function fetchPaged(rangeStart: string, rangeEnd: string, extraParams: Record<string, any> = {}): Promise<any[]> {
    const out: any[] = [];
    let offset = 0;
    let page = 1;

    while (true) {
      const params: Record<string, any> = {
        start_date: rangeStart,
        end_date: rangeEnd,
        // iCount caps searches and may return too_many_results unless max_results is raised.
        // Spec: max_results [0-1000]
        max_results: 1000,
        limit: pageSize,
        sort_field: 'dateissued',
        sort_order: 'ASC',
        detail_level: 10,
        offset,
        page,
        ...extraParams,
      };

      const resp: IcountResponse = await icountDocSearch(params);

      if (!resp) break;
      if (resp?.status === false) {
        const reason = String(resp?.reason ?? 'Unknown');
        const reasonNorm = reason.trim().toLowerCase();
        // iCount uses a few variants: "no results", "no_results_found", etc.
        if (/no[ _-]?results/.test(reasonNorm)) break;
        if (reasonNorm.includes('too_many_results') || reasonNorm.includes('too many results')) {
          throw new IcountTooManyResultsError(rangeStart, rangeEnd, reason);
        }
        throw new Error(`Failed to fetch income docs: ${reason}`);
      }

      const docs = parseIcountResponseAsList(resp);
      if (!docs.length) break;

      out.push(...docs);

      if (docs.length < pageSize) break;
      offset += pageSize;
      page += 1;
    }

    return out;
  }

  async function fetchPagedTs(rangeStartTs: string, rangeEndTs: string, extraParams: Record<string, any> = {}): Promise<any[]> {
    const out: any[] = [];
    let offset = 0;
    let page = 1;

    while (true) {
      const params: Record<string, any> = {
        start_ts: rangeStartTs,
        end_ts: rangeEndTs,
        max_results: 1000,
        limit: pageSize,
        sort_field: 'dateissued',
        sort_order: 'ASC',
        detail_level: 10,
        offset,
        page,
        ...extraParams,
      };

      const resp: IcountResponse = await icountDocSearch(params);

      if (!resp) break;
      if (resp?.status === false) {
        const reason = String(resp?.reason ?? 'Unknown');
        const reasonNorm = reason.trim().toLowerCase();
        if (/no[ _-]?results/.test(reasonNorm)) break;
        if (reasonNorm.includes('too_many_results') || reasonNorm.includes('too many results')) {
          throw new IcountTooManyResultsError(rangeStartTs, rangeEndTs, reason);
        }
        throw new Error(`Failed to fetch income docs: ${reason}`);
      }

      const docs = parseIcountResponseAsList(resp);
      if (!docs.length) break;

      out.push(...docs);

      if (docs.length < pageSize) break;
      offset += pageSize;
      page += 1;
    }

    return out;
  }

  async function fetchRange(rangeStart: string, rangeEnd: string, extraParams: Record<string, any> = {}): Promise<any[]> {
    try {
      return await fetchPaged(rangeStart, rangeEnd, extraParams);
    } catch (e) {
      // Permission/module errors won't be fixed by splitting the date range.
      if (e instanceof IcountPermissionError) throw e;
      if (!(e instanceof IcountTooManyResultsError)) throw e;

      const startD = parseIsoDate(rangeStart);
      const endD = parseIsoDate(rangeEnd);
      const days = Math.floor((endD.getTime() - startD.getTime()) / 86_400_000);

      if (days >= 1) {
        const midD = addDays(startD, Math.floor(days / 2));
        const leftStart = rangeStart;
        const leftEnd = toIsoDate(midD);
        const rightStart = toIsoDate(addDays(midD, 1));
        const rightEnd = rangeEnd;

        const left = await fetchRange(leftStart, leftEnd, extraParams);
        const right = rightStart > rightEnd ? [] : await fetchRange(rightStart, rightEnd, extraParams);
        return [...left, ...right];
      }

      // Single day still too many results: split by timestamp (start_ts/end_ts) so we can
      // reduce within the day.
      const dayStart = new Date(`${rangeStart}T00:00:00.000Z`);
      const dayEnd = new Date(`${rangeStart}T23:59:59.999Z`);
      if (Number.isNaN(dayStart.getTime()) || Number.isNaN(dayEnd.getTime())) {
        throw new Error(`Invalid date while splitting by timestamp: ${rangeStart}`);
      }

      const minWindowMs = 15 * 60 * 1000; // 15 minutes

      async function fetchRangeTs(startTs: Date, endTs: Date): Promise<any[]> {
        const startIso = startTs.toISOString();
        const endIso = endTs.toISOString();

        try {
          return await fetchPagedTs(startIso, endIso, extraParams);
        } catch (inner) {
          if (!(inner instanceof IcountTooManyResultsError)) throw inner;
          const span = endTs.getTime() - startTs.getTime();
          if (span <= minWindowMs) {
            throw new Error(
              `Failed to fetch income docs: too_many_results (even for ${Math.round(span / 60000)} minutes window on ${rangeStart}). ` +
                `Try reducing DAYS_BACK or ask iCount to increase limits for doc/search.`,
            );
          }

          const midMs = startTs.getTime() + Math.floor(span / 2);
          const leftEnd = new Date(midMs);
          const rightStart = new Date(midMs + 1);
          const left = await fetchRangeTs(startTs, leftEnd);
          const right = rightStart > endTs ? [] : await fetchRangeTs(rightStart, endTs);
          return [...left, ...right];
        }
      }

      return await fetchRangeTs(dayStart, dayEnd);
    }
  }

  // Query per-doctype to keep doc/search result-set small and avoid too_many_results.
  // De-duplicate across doctypes by iCount numeric id.
  const byId = new Map<number, any>();
  const withoutIds: any[] = [];

  for (const doctype of queryDoctypes) {
    const docs = await fetchRange(startDate, endDate, { doctype });
    for (const d of docs) {
      const id = safeInt((d as any)?.id ?? (d as any)?.ID ?? (d as any)?.doc_id ?? (d as any)?.DocID);
      if (id == null) {
        withoutIds.push(d);
      } else {
        byId.set(id, d);
      }
    }
  }

  return [...byId.values(), ...withoutIds];
}

export async function runIncomeSync(): Promise<{ synced: number; skippedDoctype: number }> {
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = new Date(end.getTime() - DAYS_BACK * 24 * 60 * 60 * 1000);

  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const optionMap = await fetchDocTypeDropdownOptions();

  const rawDocs = await fetchIcountIncomeDocs(startStr, endStr, ICOUNT_PAGE_SIZE);
  if (!rawDocs.length) return { synced: 0, skippedDoctype: 0 };

  let synced = 0;
  let skippedDoctype = 0;

  for (const d of rawDocs) {
    const norm = normalizeDoc(d);
    if (!norm) continue;

    if (norm.doctype && !ALLOWED_DOCTYPES.has(norm.doctype)) {
      skippedDoctype += 1;
      continue;
    }

    const issueDateTs = parseDateToTsMs(norm.dateIssued);
    const { display: docTypeDisplay, value: docTypeValue } = mapDoctypeToClickupValue(norm.doctype, optionMap);

    const taskName = buildTaskName(docTypeDisplay, norm.docnum || String(norm.icountId), norm.clientName);
    const description =
      `iCount ID: ${norm.icountId}\n` +
      `Doc Type: ${norm.doctype}\n` +
      `Doc Num: ${norm.docnum}\n` +
      `Client: ${norm.clientName}\n` +
      `Date: ${norm.dateIssued}\n` +
      `PDF: ${norm.pdfLink ?? ''}`;

    const customFields = buildIncomeCustomFields(norm, issueDateTs, docTypeValue);

    const payload = {
      name: taskName,
      description,
      status: norm.status,
      custom_fields: customFields,
    };

    const existing = await findExistingTask(norm, issueDateTs);

    if (existing) {
      await clickupRequest('PUT', `${CLICKUP_API_URL}/task/${existing.id}`, { body: payload });
    } else {
      await clickupRequest('POST', `${CLICKUP_API_URL}/list/${CLICKUP_INCOME_LIST_ID}/task`, { body: payload });
    }

    synced += 1;
    await sleep(200);
  }

  return { synced, skippedDoctype };
}
