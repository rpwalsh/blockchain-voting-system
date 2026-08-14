export type CheckStatus = 'PASS' | 'FAIL' | 'WARN' | 'SKIP';

export interface CheckResult {
  id: string;
  title: string;
  status: CheckStatus;
  detail: string;
  issues?: string[];
  data?: Record<string, unknown>;
}

export function pass(id: string, title: string, detail: string, data?: Record<string, unknown>): CheckResult {
  return { id, title, status: 'PASS', detail, data };
}

export function fail(id: string, title: string, detail: string, issues?: string[], data?: Record<string, unknown>): CheckResult {
  return { id, title, status: 'FAIL', detail, issues, data };
}

export function warn(id: string, title: string, detail: string, data?: Record<string, unknown>): CheckResult {
  return { id, title, status: 'WARN', detail, data };
}

export function skip(id: string, title: string, detail: string): CheckResult {
  return { id, title, status: 'SKIP', detail };
}
