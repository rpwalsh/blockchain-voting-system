/**
 * Thin client for the backend's read-only, unauthenticated HTTP endpoints
 * (backend/src/routes/finalization.ts, election-player.ts,
 * crypto-audit.ts). This never touches Prisma or the backend's database -
 * only what these endpoints choose to expose over HTTP, same as any
 * outside caller would see. Responses are treated as untrusted input: the
 * checks in src/checks/ independently recompute everything they can
 * rather than reading a server-asserted "verified": true field.
 */

import type { BundleFinalization } from './bundle';

export interface RemoteMerkleProof {
  root: string;
  leaf: string;
  index: number;
  siblings: { left: boolean; hash: string; empty?: boolean }[];
}

async function getJson(url: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (error: any) {
    throw new Error(`Request to ${url} failed: ${error.message}`);
  }
  const body: any = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`GET ${url} -> HTTP ${res.status}: ${body?.error || res.statusText}`);
  }
  return body;
}

async function postJson(url: string, payload: unknown): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error: any) {
    throw new Error(`Request to ${url} failed: ${error.message}`);
  }
  const body: any = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`POST ${url} -> HTTP ${res.status}: ${body?.error || res.statusText}`);
  }
  return body;
}

export class ElectionApiClient {
  constructor(private readonly baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /** GET /api/elections/:id/finalization - signed manifest for this election. */
  async getFinalization(electionId: string): Promise<BundleFinalization> {
    const body = await getJson(`${this.baseUrl}/api/elections/${encodeURIComponent(electionId)}/finalization`);
    if (!body?.finalization) {
      throw new Error(`No finalization manifest returned for election ${electionId} - has it been finalized?`);
    }
    return body.finalization as BundleFinalization;
  }

  /**
   * POST /api/election-player/:id/verify-vote - recomputes a live Merkle
   * proof for one vote by receipt hash. The server's own `verified` field
   * is not trusted; only `vote.merkleProof` is used, and it's checked
   * independently by the caller.
   */
  async verifyVote(electionId: string, receiptHash: string): Promise<{ proof: RemoteMerkleProof; candidateName?: string; timestamp?: string }> {
    const body = await postJson(`${this.baseUrl}/api/election-player/${encodeURIComponent(electionId)}/verify-vote`, {
      receiptHash,
    });
    if (!body?.vote?.merkleProof) {
      throw new Error(body?.error || `No vote found for receipt hash ${receiptHash}`);
    }
    return {
      proof: body.vote.merkleProof,
      candidateName: body.vote.candidateName,
      timestamp: body.vote.timestamp,
    };
  }

  /** GET /api/crypto-audit/election/:id/merkle-tree - root only, informational cross-reference. */
  async getMerkleTreeSummary(electionId: string): Promise<{ root: string; totalLeaves: number } | null> {
    const body = await getJson(`${this.baseUrl}/api/crypto-audit/election/${encodeURIComponent(electionId)}/merkle-tree`);
    return body?.merkleTree ?? null;
  }
}
