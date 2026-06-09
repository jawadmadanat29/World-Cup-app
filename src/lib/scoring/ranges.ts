// Range labels (e.g. "2-3", "6+", "<140", "0") are stored as strings so they
// survive a SQLite -> Postgres migration. This parses + tests them.

export function parseRange(label: string): { min: number; max: number } | null {
  const l = label.trim();
  if (!l) return null;
  if (l.startsWith("<")) {
    const n = Number(l.slice(1));
    return Number.isFinite(n) ? { min: -Infinity, max: n - 1 } : null;
  }
  if (l.startsWith(">=")) {
    const n = Number(l.slice(2));
    return Number.isFinite(n) ? { min: n, max: Infinity } : null;
  }
  if (l.endsWith("+")) {
    const n = Number(l.slice(0, -1));
    return Number.isFinite(n) ? { min: n, max: Infinity } : null;
  }
  if (l.includes("-")) {
    const [a, b] = l.split("-").map(Number);
    return Number.isFinite(a) && Number.isFinite(b) ? { min: a, max: b } : null;
  }
  const n = Number(l);
  return Number.isFinite(n) ? { min: n, max: n } : null;
}

export function rangeContains(label: string | null | undefined, value: number): boolean {
  if (label == null) return false;
  const r = parseRange(label);
  if (!r) return false;
  return value >= r.min && value <= r.max;
}
