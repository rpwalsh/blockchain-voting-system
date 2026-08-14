#!/usr/bin/env node
/**
 * election-verifier CLI. See README.md for the full command reference and,
 * critically, what this tool does and does not verify.
 */

import { Command } from 'commander';
import { loadBundle } from './bundle';
import { ElectionApiClient } from './client';
import { auditBundle, auditApi, verifyReceiptBundle, verifyReceiptApi, AuditOptions } from './audit';
import { renderReport, exitCode, tally } from './report';
import { CheckResult } from './checks/types';

const program = new Command();

program
  .name('election-verifier')
  .description('Independently verifies an election\'s cryptographic integrity without trusting the election server.')
  .version('0.1.0');

interface SourceOptions {
  bundle?: string;
  api?: string;
  election?: string;
}

function resolveApiClientOrBundle(opts: SourceOptions): { mode: 'bundle'; bundle: ReturnType<typeof loadBundle> } | { mode: 'api'; client: ElectionApiClient; electionId: string } {
  if (opts.bundle && opts.api) {
    console.error('Error: pass either --bundle or --api, not both.');
    process.exit(2);
  }
  if (opts.bundle) {
    return { mode: 'bundle', bundle: loadBundle(opts.bundle) };
  }
  if (opts.api) {
    if (!opts.election) {
      console.error('Error: --election <id> is required with --api.');
      process.exit(2);
    }
    return { mode: 'api', client: new ElectionApiClient(opts.api), electionId: opts.election };
  }
  console.error('Error: pass one of --bundle <path> or --api <url> --election <id>.');
  process.exit(2);
}

function finish(subject: string, results: CheckResult[], opts: { json?: boolean; allowSkip?: boolean; noColor?: boolean }) {
  if (opts.json) {
    console.log(JSON.stringify({ subject, results, summary: tally(results) }, null, 2));
  } else {
    console.log(renderReport(subject, results, !opts.noColor));
  }
  process.exit(exitCode(results, !!opts.allowSkip));
}

program
  .command('check')
  .description('Run the full election integrity audit (finalization manifest, Merkle root, ledger chain, timestamp anchor, and optionally one receipt).')
  .option('-b, --bundle <path>', 'path to a locally exported JSON audit bundle')
  .option('-a, --api <url>', 'base URL of a running election backend (public endpoints only)')
  .option('-e, --election <id>', 'election ID (required with --api)')
  .option('-s, --signing-key <base64>', 'the election\'s Ed25519 signing public key, obtained out-of-band - required to trust the finalization signature, not just check its internal consistency')
  .option('-r, --receipt <hash>', 'also verify one voter receipt by its receiptHash')
  .option('-c, --ciphertext <value>', 'the exact ballot ciphertext for --receipt, to confirm the receipt is for your own vote')
  .option('--skip-timestamp', 'skip the network round-trip to OpenTimestamps calendar servers')
  .option('--allow-skip', 'exit 0 even if some checks were skipped (e.g. --api mode without --bundle)')
  .option('--json', 'machine-readable JSON output')
  .option('--no-color', 'disable ANSI colors')
  .action(async opts => {
    const source = resolveApiClientOrBundle(opts);
    const auditOptions: AuditOptions = {
      expectedSigningKey: opts.signingKey,
      receiptHash: opts.receipt,
      ciphertext: opts.ciphertext,
      skipTimestamp: opts.skipTimestamp,
    };

    try {
      const results =
        source.mode === 'bundle'
          ? await auditBundle(source.bundle, auditOptions)
          : await auditApi(source.client, source.electionId, auditOptions);

      const subject = source.mode === 'bundle' ? `bundle ${opts.bundle} (election ${source.bundle.election.id})` : `${opts.api} (election ${source.electionId})`;
      finish(subject, results, opts);
    } catch (error: any) {
      console.error(`Fatal: ${error.message}`);
      process.exit(2);
    }
  });

program
  .command('verify-receipt')
  .description('Voter-facing check: was my specific ballot counted? Only needs the receipt hash - no election-wide access required.')
  .option('-b, --bundle <path>', 'path to a locally exported JSON audit bundle')
  .option('-a, --api <url>', 'base URL of a running election backend (public endpoints only)')
  .option('-e, --election <id>', 'election ID (required with --api)')
  .requiredOption('-r, --receipt <hash>', 'your receiptHash')
  .option('-c, --ciphertext <value>', 'the exact ballot ciphertext you submitted, to confirm this receipt is for your own vote')
  .option('-s, --signing-key <base64>', 'the election\'s Ed25519 signing public key, obtained out-of-band')
  .option('--allow-skip', 'exit 0 even if some checks were skipped')
  .option('--json', 'machine-readable JSON output')
  .option('--no-color', 'disable ANSI colors')
  .action(async opts => {
    const source = resolveApiClientOrBundle(opts);
    const auditOptions: AuditOptions = {
      expectedSigningKey: opts.signingKey,
      ciphertext: opts.ciphertext,
    };

    try {
      const results =
        source.mode === 'bundle'
          ? await verifyReceiptBundle(source.bundle, opts.receipt, auditOptions)
          : await verifyReceiptApi(source.client, source.electionId, opts.receipt, auditOptions);

      const subject = source.mode === 'bundle' ? `receipt ${opts.receipt} in bundle ${opts.bundle}` : `receipt ${opts.receipt} via ${opts.api}`;
      finish(subject, results, opts);
    } catch (error: any) {
      console.error(`Fatal: ${error.message}`);
      process.exit(2);
    }
  });

program.parseAsync(process.argv);
