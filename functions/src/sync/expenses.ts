import { clickupRequest, DAYS_BACK, icountRequest, normalizeText, parseDateToTsMs, sleep } from './clients';

const CLICKUP_API_URL = 'https://api.clickup.com/api/v2';

const CLICKUP_EXPENSES_LIST_ID = '901214544874';

const FIELD_IDS = {
  amount: '0d357de4-bb80-4a61-a83d-3b373e102904',
  date: '278accbb-c4a3-430f-ae3b-6076f96222b3',
  supplier: 'ad3de6e9-c4a6-433a-ac9d-84ef0ad3e80d',
  image: '3c4b314c-3fb2-4892-b889-7cc8c2e701d0',
  category: 'f2d2746b-ed1a-4ef9-9321-80a9c8544e0a',
  icountId: '46aa14b0-ae48-4b5a-a2e0-56cf80ab015b',
} as const;

// Hebrew category -> ClickUp dropdown UUID
const CATEGORY_MAP: Record<string, string> = {
  // Alcohol & Groceries
  'אלכוהול': '5e86c359-a285-460d-84d9-aab372eed1f3',
  'פירות': '5e86c359-a285-460d-84d9-aab372eed1f3',
  'קרח': '5e86c359-a285-460d-84d9-aab372eed1f3',
  'שתיה קלה': '5e86c359-a285-460d-84d9-aab372eed1f3',
  'כיבוד ואירוח': '5e86c359-a285-460d-84d9-aab372eed1f3',
  'סופר/כיבוד ואירוח': '5e86c359-a285-460d-84d9-aab372eed1f3',
  'קניות': '5e86c359-a285-460d-84d9-aab372eed1f3',
  'קניות שונות': '5e86c359-a285-460d-84d9-aab372eed1f3',

  // Equipment
  'ציוד': 'f5a204a9-0036-4fd1-8f5c-166cf3041ccc',
  'השכרת ציוד': 'f5a204a9-0036-4fd1-8f5c-166cf3041ccc',
  'בגדי עבודה': 'f5a204a9-0036-4fd1-8f5c-166cf3041ccc',
  'כלי עבודה': 'f5a204a9-0036-4fd1-8f5c-166cf3041ccc',
  'ציוד בר ((ללא מעמ))': 'f5a204a9-0036-4fd1-8f5c-166cf3041ccc',
  'ציוד בר(ללא מע"מ)': 'f5a204a9-0036-4fd1-8f5c-166cf3041ccc',
  'ציוד מזיגה/ברמן (שותף)': 'f5a204a9-0036-4fd1-8f5c-166cf3041ccc',
  'צמחים ודיקורציה/תפאורה': 'f5a204a9-0036-4fd1-8f5c-166cf3041ccc',

  // Marketing
  'שיווק': '281b1cfc-6928-4181-9255-a4a24d733c42',
  'פרסום': '281b1cfc-6928-4181-9255-a4a24d733c42',
  'פרסום  (ללא מעמ)': '281b1cfc-6928-4181-9255-a4a24d733c42',
  'קידום': '281b1cfc-6928-4181-9255-a4a24d733c42',
  'דפוס והדפסות': '281b1cfc-6928-4181-9255-a4a24d733c42',
  'עריכת וידאו ללא מעמ': '281b1cfc-6928-4181-9255-a4a24d733c42',

  // Office/Admin
  'משרדיות': 'abd67551-8d12-4140-b1d2-04b1ae3ebf13',
  'אחזקה': 'abd67551-8d12-4140-b1d2-04b1ae3ebf13',
  'אחזקת מחשב': 'abd67551-8d12-4140-b1d2-04b1ae3ebf13',
  'אחזקת מחשב/משרד (ללא מעמ)': 'abd67551-8d12-4140-b1d2-04b1ae3ebf13',
  'דואר': 'abd67551-8d12-4140-b1d2-04b1ae3ebf13',
  'תקשורת': 'abd67551-8d12-4140-b1d2-04b1ae3ebf13',
  'חשמל ביתי': 'abd67551-8d12-4140-b1d2-04b1ae3ebf13',
  'טלפון סלולרי': 'abd67551-8d12-4140-b1d2-04b1ae3ebf13',
  'מיסי עירייה ומים - ביתי': 'abd67551-8d12-4140-b1d2-04b1ae3ebf13',
  'שכר דירה': 'abd67551-8d12-4140-b1d2-04b1ae3ebf13',
  'שליחויות והובלות': 'abd67551-8d12-4140-b1d2-04b1ae3ebf13',
  'מתווך שכירות': 'abd67551-8d12-4140-b1d2-04b1ae3ebf13',

  // Staff/Salaries
  'משכורות': '8fd31075-8467-4910-9786-f99a9289b0aa',
  'קבלני משנה': '8fd31075-8467-4910-9786-f99a9289b0aa',
  'קבלני משנה/עבודות חוץ (ללא מעמ)': '8fd31075-8467-4910-9786-f99a9289b0aa',
  'עבודות חוץ': '8fd31075-8467-4910-9786-f99a9289b0aa',

  // Tax/Legal
  'מיסים': 'cd76b414-ae5f-48ce-837e-f4ce97f2bb44',
  'הנהלת חשבונות': 'cd76b414-ae5f-48ce-837e-f4ce97f2bb44',
  'ייעוץ מס': 'cd76b414-ae5f-48ce-837e-f4ce97f2bb44',
  'ייעוץ מס והנהלת חשבונות': 'cd76b414-ae5f-48ce-837e-f4ce97f2bb44',
  'עורך דין': 'cd76b414-ae5f-48ce-837e-f4ce97f2bb44',

  // Vehicle
  'אחזקת רכב': 'c6b51380-e19e-4dba-b0f2-1f13a34b4b09',
  'דלק': 'c6b51380-e19e-4dba-b0f2-1f13a34b4b09',
  'חניונים': 'c6b51380-e19e-4dba-b0f2-1f13a34b4b09',
  'ליסינג תפעולי רכב/השכרת רכב': 'c6b51380-e19e-4dba-b0f2-1f13a34b4b09',

  // Personal Development
  'השתלמויות': '8af94825-fd00-4cf0-aa0c-ed32d6dab395',
  'השתלמויות (ללא מעמ)': '8af94825-fd00-4cf0-aa0c-ed32d6dab395',
  'ייעוץ מקצועי (ללא מעמ)': '8af94825-fd00-4cf0-aa0c-ed32d6dab395',

  // Other
  'שונות': '2b9988ae-ec55-4cb4-8508-3359c0155f45',
  'הוצאה אוטומטית': '2b9988ae-ec55-4cb4-8508-3359c0155f45',
};

const UNKNOWN_CATEGORY_FALLBACK = '2b9988ae-ec55-4cb4-8508-3359c0155f45';

function mapCategory(categoryName: string | null | undefined, unknown: Set<string>): string {
  const raw = String(categoryName ?? '').trim();
  if (!raw) {
    unknown.add('');
    return UNKNOWN_CATEGORY_FALLBACK;
  }

  const norm = normalizeText(raw);

  for (const [k, uuid] of Object.entries(CATEGORY_MAP)) {
    if (normalizeText(k) === norm) return uuid;
  }

  for (const [k, uuid] of Object.entries(CATEGORY_MAP)) {
    const kn = normalizeText(k);
    if (kn.includes(norm) || norm.includes(kn)) return uuid;
  }

  unknown.add(raw);
  return UNKNOWN_CATEGORY_FALLBACK;
}

function parseIcountResponse(response: any): any[] {
  if (!response) return [];

  if ('results_list' in response) {
    const v = response.results_list;
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') return Object.values(v);
  }

  if ('data' in response) {
    const v = response.data;
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') return Object.values(v);
  }

  if ('expenses' in response) {
    const v = response.expenses;
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') return Object.values(v);
  }

  if (Array.isArray(response)) return response;

  if (response && typeof response === 'object') {
    const potential: any[] = [];
    for (const [k, v] of Object.entries(response)) {
      if (
        [
          'status',
          'reason',
          'messages',
          'version',
          'tz',
          'ts',
          'lang',
          'rid',
          'module',
          'method',
          'error_description',
          'total_count',
          'results_count',
          'offset',
          'limit',
          'sort_field',
          'sort_order',
          'api',
        ].includes(k)
      ) {
        continue;
      }
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const first = Object.values(v as any)[0];
        if (first && typeof first === 'object') {
          potential.push(...Object.values(v as any));
        }
      }
    }
    if (potential.length) return potential;
  }

  return [];
}

async function fetchSuppliersMap(): Promise<Record<string, string>> {
  const supplierMap: Record<string, string> = {};

  // 1) client/get_list
  try {
    const resp = await icountRequest<any>('client', 'get_list', { limit: 500 });
    const clients = parseIcountResponse(resp);
    for (const c of clients) {
      const id = c?.id ?? c?.client_id;
      const name = c?.company_name ?? c?.client_name;
      if (id && name) supplierMap[String(id)] = String(name);
    }
  } catch {
    // ignore
  }

  // 2) supplier/get_list
  try {
    const resp = await icountRequest<any>('supplier', 'get_list', {});
    const suppliersData = resp?.suppliers;
    if (suppliersData && typeof suppliersData === 'object' && !Array.isArray(suppliersData)) {
      for (const [sid, s] of Object.entries(suppliersData)) {
        const sname = (s as any)?.supplier_name ?? (s as any)?.company_name ?? (s as any)?.name;
        if (sname) supplierMap[String(sid)] = String(sname);
      }
    } else if (Array.isArray(suppliersData)) {
      for (const s of suppliersData) {
        const sid = (s as any)?.id ?? (s as any)?.supplier_id;
        const sname = (s as any)?.supplier_name ?? (s as any)?.company_name;
        if (sid && sname) supplierMap[String(sid)] = String(sname);
      }
    }
  } catch {
    // ignore
  }

  return supplierMap;
}

async function fetchIcountExpensesLast45Days(): Promise<any[]> {
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = new Date(end.getTime() - DAYS_BACK * 24 * 60 * 60 * 1000);

  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const params = {
    start_date: startStr,
    end_date: endStr,
    limit: 1000,
    sort_field: 'expense_date',
    sort_order: 'ASC',
  };

  const resp = await icountRequest<any>('expense', 'search', params);
  if (!resp) return [];
  if (resp?.status === false) {
    const reason = String(resp?.reason ?? 'Unknown');
    if (reason.toLowerCase().includes('no results')) return [];
    throw new Error(`Failed to fetch expenses: ${reason}`);
  }

  return parseIcountResponse(resp);
}

async function findExistingTask(icountId: number, taskName: string, amount: number, dateTsMs: number, imageUrl: string | null): Promise<any | null> {
  const url = `${CLICKUP_API_URL}/list/${CLICKUP_EXPENSES_LIST_ID}/task`;

  // 1) iCount ID
  try {
    const byId = await clickupRequest<{ tasks: any[] }>('GET', url, {
      query: {
        include_closed: 'true',
        custom_fields: JSON.stringify([{ field_id: FIELD_IDS.icountId, operator: '=', value: icountId }]),
      },
    });
    if (byId?.tasks?.length) return byId.tasks[0];
  } catch {
    // ignore
  }

  // 2) Image URL
  if (imageUrl) {
    try {
      const byImg = await clickupRequest<{ tasks: any[] }>('GET', url, {
        query: {
          include_closed: 'true',
          custom_fields: JSON.stringify([{ field_id: FIELD_IDS.image, operator: '=', value: imageUrl }]),
        },
      });
      if (byImg?.tasks?.length) return byImg.tasks[0];
    } catch {
      // ignore
    }
  }

  // 3) Amount + in-memory check name+date tolerance
  try {
    const byAmount = await clickupRequest<{ tasks: any[] }>('GET', url, {
      query: {
        include_closed: 'true',
        custom_fields: JSON.stringify([{ field_id: FIELD_IDS.amount, operator: '=', value: amount }]),
      },
    });

    const tasks = Array.isArray(byAmount?.tasks) ? byAmount.tasks : [];
    for (const task of tasks) {
      if (task?.name !== taskName) continue;

      const fields: any[] = Array.isArray(task?.custom_fields) ? task.custom_fields : [];
      const dateField = fields.find((f) => f?.id === FIELD_IDS.date);
      const taskDate = dateField?.value != null ? Number(dateField.value) : null;
      if (taskDate != null) {
        const diff = Math.abs(taskDate - dateTsMs);
        if (diff < 86_400_000) return task;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export async function runExpensesSync(): Promise<{ synced: number; unknownCategories: string[] }> {
  const supplierMap = await fetchSuppliersMap();
  const expenses = await fetchIcountExpensesLast45Days();
  if (!expenses.length) return { synced: 0, unknownCategories: [] };

  const unknownCategories = new Set<string>();
  let synced = 0;

  for (const exp of expenses) {
    const expenseId = Number(exp?.expense_id);
    if (!Number.isFinite(expenseId)) continue;

    const supplierId = String(exp?.supplier_id ?? '');
    const supplierName = supplierMap[supplierId] ?? `Unknown (${supplierId})`;

    const amount = Number(exp?.expense_sum ?? 0) || 0;
    const dateStr = String(exp?.expense_date ?? '');
    const imageUrl = String(exp?.s3storage_link ?? '').trim() || null;
    const categoryName = String(exp?.expense_type_name ?? '').trim();

    const mappedCategory = mapCategory(categoryName, unknownCategories);

    const dateTs = parseDateToTsMs(dateStr) ?? Date.now();

    const description = `iCount ID: ${expenseId}\nCategory: ${categoryName}\nDesc: ${String(exp?.description ?? '')}`;

    const existing = await findExistingTask(expenseId, supplierName, amount, dateTs, imageUrl);

    if (existing) {
      const payload: any = {
        description,
        custom_fields: [{ id: FIELD_IDS.icountId, value: expenseId }],
      };
      if (mappedCategory) payload.custom_fields.push({ id: FIELD_IDS.category, value: mappedCategory });

      await clickupRequest('PUT', `${CLICKUP_API_URL}/task/${existing.id}`, { body: payload });
      synced += 1;
      await sleep(200);
      continue;
    }

    const customFields: any[] = [
      { id: FIELD_IDS.amount, value: amount },
      { id: FIELD_IDS.date, value: dateTs },
      { id: FIELD_IDS.supplier, value: supplierName },
      { id: FIELD_IDS.icountId, value: expenseId },
    ];

    if (imageUrl) customFields.push({ id: FIELD_IDS.image, value: imageUrl });
    if (mappedCategory) customFields.push({ id: FIELD_IDS.category, value: mappedCategory });

    const payload = {
      name: supplierName,
      description,
      status: 'Closed',
      custom_fields: customFields,
    };

    await clickupRequest('POST', `${CLICKUP_API_URL}/list/${CLICKUP_EXPENSES_LIST_ID}/task`, { body: payload });
    synced += 1;
    await sleep(200);
  }

  return { synced, unknownCategories: Array.from(unknownCategories).filter((x) => x) };
}
