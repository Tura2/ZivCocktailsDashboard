import { normalizeIncomingLead } from '../normalize/clickup';
import { computeMarketingMetrics } from '../metrics/marketing';
import type { ClickUpCustomField, ClickUpTask } from '../clickup/types';
import type { YYYYMM } from '../dashboard/types';
import { getMonthRange } from '../time/month';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function main(): void {
  // Minimal synthetic ClickUp task that matches production behavior:
  // - drop_down custom fields return a numeric index into type_config.options
  const options = [
    { id: 'o0', name: 'Option 0' },
    { id: 'o1', name: 'Option 1' },
    { id: 'o2', name: 'Not Relevant' },
    { id: 'o3', name: 'Word of Mouth' },
    { id: 'o4', name: 'Option 4' },
    { id: 'o5', name: 'Landing Page' },
  ];

  const month: YYYYMM = '2025-12' as YYYYMM;
  const range = getMonthRange(month);

  const makeTask = (overrides: Partial<ClickUpTask>, custom_fields: ClickUpCustomField[]): ClickUpTask => ({
    id: overrides.id ?? 't1',
    status: overrides.status ?? { status: 'New Lead' },
    date_created: overrides.date_created ?? String(range.startMs + 1000),
    date_updated: overrides.date_updated ?? String(range.startMs + 2000),
    date_closed: overrides.date_closed ?? null,
    custom_fields,
  });

  const sourceFieldId = 'c49330f0-35a0-4177-92ff-854655a7fc55';
  const lossReasonFieldId = 'c4c93671-a537-471b-80ae-0790d1fc2e84';

  const leadLanding = normalizeIncomingLead(
    makeTask(
      { id: 'landing', status: { status: 'New Lead' } },
      [
        {
          id: sourceFieldId,
          type: 'drop_down',
          value: 5,
          type_config: { options },
        },
      ],
    ),
  );

  assert(leadLanding.source === 'Landing Page', `Expected source to normalize to 'Landing Page', got: ${String(leadLanding.source)}`);

  const leadWom = normalizeIncomingLead(
    makeTask(
      { id: 'wom', status: { status: 'New Lead' } },
      [
        {
          id: sourceFieldId,
          type: 'drop_down',
          value: 3,
          type_config: { options },
        },
      ],
    ),
  );

  assert(leadWom.source === 'Word of Mouth', `Expected source to normalize to 'Word of Mouth', got: ${String(leadWom.source)}`);

  const leadNotRelevantLoss = normalizeIncomingLead(
    makeTask(
      { id: 'nr', status: { status: 'Closed Lost' } },
      [
        {
          id: lossReasonFieldId,
          type: 'drop_down',
          value: 2,
          type_config: { options },
        },
      ],
    ),
  );

  assert(
    leadNotRelevantLoss.lossReason === 'Not Relevant',
    `Expected lossReason to normalize to 'Not Relevant', got: ${String(leadNotRelevantLoss.lossReason)}`,
  );

  const metrics = computeMarketingMetrics({
    month,
    range,
    leads: [leadLanding, leadWom, leadNotRelevantLoss],
  });

  assert(metrics.totalLeads.value === 3, `Expected totalLeads=3, got ${String(metrics.totalLeads.value)}`);
  assert(metrics.landingVisits.value === 1, `Expected landingVisits=1, got ${String(metrics.landingVisits.value)}`);
  assert(metrics.relevantLeads.value === 2, `Expected relevantLeads=2, got ${String(metrics.relevantLeads.value)}`);

  process.stdout.write('OK: dropdown normalization + relevant lead filtering behave as expected.\n');
}

main();
