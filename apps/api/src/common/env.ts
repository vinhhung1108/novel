// apps/api/src/common/env.ts
export function envInt(
  name: string,
  def: number,
  opts?: { min?: number; max?: number }
) {
  const raw = process.env[name];
  const n = raw && raw.trim() !== "" ? Number(raw) : NaN;
  const ok = Number.isFinite(n);
  const v = ok ? Number(n) : def;
  const min = opts?.min ?? -Infinity;
  const max = opts?.max ?? +Infinity;
  return v >= min && v <= max ? v : def;
}

export function envStr(name: string, def: string) {
  const raw = process.env[name];
  return raw && raw.trim() !== "" ? raw : def;
}
