/**
 * Renders a CheckResult[] as a CLI report and computes the process exit
 * code. Exit code is 0 only if every check PASSed - a SKIP (not FAIL) is
 * still treated as "not verified" by default, because silently exiting 0
 * on a partially-run audit would be worse than an honest nonzero exit.
 * --allow-skip relaxes that for callers who understand exactly which
 * checks were skipped and why (see each check's `detail`).
 */

import { CheckResult, CheckStatus } from './checks/types';

const COLOR = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
};

const STATUS_LABEL: Record<CheckStatus, string> = {
  PASS: `${COLOR.green}${COLOR.bold} PASS ${COLOR.reset}`,
  FAIL: `${COLOR.red}${COLOR.bold} FAIL ${COLOR.reset}`,
  WARN: `${COLOR.yellow}${COLOR.bold} WARN ${COLOR.reset}`,
  SKIP: `${COLOR.gray}${COLOR.bold} SKIP ${COLOR.reset}`,
};

export function renderReport(subject: string, results: CheckResult[], useColor = true): string {
  const c = useColor ? COLOR : Object.fromEntries(Object.keys(COLOR).map(k => [k, ''])) as typeof COLOR;
  const label = (status: CheckStatus) => (useColor ? STATUS_LABEL[status] : `[${status}]`.padEnd(6));

  const lines: string[] = [];
  lines.push(`${c.bold}Independent Election Integrity Verifier${c.reset}`);
  lines.push(`${c.dim}subject: ${subject}${c.reset}`);
  lines.push(`${c.dim}this tool trusts only cryptography, never the server - see verifier/README.md${c.reset}`);
  lines.push('');

  for (const result of results) {
    lines.push(`${label(result.status)} ${c.bold}${result.title}${c.reset}`);
    lines.push(`       ${result.detail}`);
    for (const issue of result.issues ?? []) {
      lines.push(`       ${c.red}- ${issue}${c.reset}`);
    }
    lines.push('');
  }

  const counts = tally(results);
  lines.push(
    `${c.bold}Summary:${c.reset} ${c.green}${counts.PASS} passed${c.reset}, ` +
      `${c.red}${counts.FAIL} failed${c.reset}, ${c.yellow}${counts.WARN} warned${c.reset}, ${c.gray}${counts.SKIP} skipped${c.reset}`
  );
  if (counts.WARN > 0) {
    lines.push(`${c.yellow}${counts.WARN} check(s) passed with caveats that weaken the trust result - read the WARN details above.${c.reset}`);
  }
  if (counts.SKIP > 0) {
    lines.push(`${c.gray}${counts.SKIP} check(s) did not run - this is not a complete verification. Read the SKIP details above.${c.reset}`);
  }

  return lines.join('\n');
}

export function tally(results: CheckResult[]): Record<CheckStatus, number> {
  const counts: Record<CheckStatus, number> = { PASS: 0, FAIL: 0, WARN: 0, SKIP: 0 };
  for (const result of results) counts[result.status]++;
  return counts;
}

/** 0 only if there are no FAILs and (unless allowSkip) no SKIPs. */
export function exitCode(results: CheckResult[], allowSkip: boolean): number {
  const counts = tally(results);
  if (counts.FAIL > 0) return 1;
  if (counts.SKIP > 0 && !allowSkip) return 2;
  return 0;
}
