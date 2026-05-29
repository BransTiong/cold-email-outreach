/**
 * Runtime config, read lazily from process.env (Next loads .env.local for us).
 * Lazy + cached so importing this module during `next build` doesn't throw
 * when env isn't present. Google/crypto helpers read their own vars directly,
 * so only the handful below are centralised here.
 */
export interface Env {
  PUBLIC_BASE_URL: string;
  DAILY_LIMIT_PER_ACCOUNT: number;
}

let _env: Env | undefined;

export function getEnv(): Env {
  if (_env) return _env;
  const base = process.env.PUBLIC_BASE_URL;
  if (!base) throw new Error('PUBLIC_BASE_URL not set');
  const limit = Number(process.env.DAILY_LIMIT_PER_ACCOUNT ?? 40);
  _env = {
    PUBLIC_BASE_URL: base.replace(/\/$/, ''),
    DAILY_LIMIT_PER_ACCOUNT: Number.isFinite(limit) ? limit : 40,
  };
  return _env;
}
