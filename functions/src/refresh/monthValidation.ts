const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function assertMonth(value: unknown, fieldName = 'month'): string {
  if (typeof value !== 'string' || !MONTH_RE.test(value)) {
    throw new Error(`Invalid ${fieldName}: "${String(value)}". Expected YYYY-MM where MM is 01-12.`);
  }
  return value;
}
