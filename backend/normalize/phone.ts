export function normalizePhone(raw: unknown): string | null {
  if (raw == null) return null;

  const s = String(raw).trim();
  if (!s) return null;

  // Keep digits only
  const digits = s.replace(/[^0-9]/g, '');
  if (!digits) return null;

  // Israel-focused normalization (per spec): +972 / leading 0
  // Convert 972XXXXXXXXX -> 0XXXXXXXXX
  if (digits.startsWith('972')) {
    const local = digits.slice(3);
    return local.startsWith('0') ? local : `0${local}`;
  }

  // If it already looks like local (0XXXXXXXXX), keep
  if (digits.startsWith('0')) return digits;

  // Fallback: treat as local missing leading 0
  if (digits.length === 9) return `0${digits}`;

  return digits;
}
