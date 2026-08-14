/**
 * Multi-party administration - see docs/threat-model.md, "malicious
 * administrator" (a single ORG_ADMIN session can otherwise perform any
 * administrative action unilaterally). Critical election actions
 * (certifying configuration, opening voting, finalizing, tallying,
 * cancelling) go through a propose/approve flow: >= threshold distinct
 * authenticated admins must each submit a real Ed25519 signature over the
 * same proposal hash before the action executes. One compromised or
 * malicious admin account cannot act alone.
 */

import { Router, Response } from 'express';
import { prisma } from '../db';
import crypto from '../crypto/engine';
import { domainHash, DOMAIN } from '../crypto/canonical';
import { requireAuth, requireOrgRole, AuthedRequest } from '../middleware/auth';
import { createLedgerEntry } from '../utils/audit';
import { finalizeElection } from './finalization';
import { computeTally } from './tally';

const router = Router();

// Each action implies its own target status (or none, for TALLY) - see
// ElectionApproval.action in schema.prisma.
const ACTION_PRECONDITIONS: Record<string, { fromStatus: string[]; toStatus?: string }> = {
  CERTIFY: { fromStatus: ['DRAFT'], toStatus: 'REGISTRATION' },
  OPEN_VOTING: { fromStatus: ['REGISTRATION'], toStatus: 'VOTING' },
  FINALIZE: { fromStatus: ['VOTING'] }, // finalizeElection() sets status to COMPLETED itself
  TALLY: { fromStatus: ['VOTING', 'TALLYING', 'COMPLETED'] },
  CANCEL: { fromStatus: ['DRAFT', 'REGISTRATION', 'VOTING', 'TALLYING'], toStatus: 'CANCELLED' },
};

/**
 * POST /:electionId/admin-actions/propose
 * Body: { action, reason?, threshold? }
 */
router.post('/:electionId/admin-actions/propose', requireAuth, requireOrgRole(['ORG_ADMIN', 'ELECTION_OFFICER']), async (req: AuthedRequest, res: Response) => {
  try {
    const { electionId } = req.params;
    const { action, reason, threshold } = req.body || {};

    const precondition = ACTION_PRECONDITIONS[action];
    if (!precondition) {
      return res.status(400).json({ success: false, error: `action must be one of ${Object.keys(ACTION_PRECONDITIONS).join(', ')}` });
    }
    const election = await prisma.election.findUnique({ where: { id: electionId } });
    if (!election || election.organizationId !== req.auth!.orgId) {
      return res.status(404).json({ success: false, error: 'Election not found' });
    }
    if (!precondition.fromStatus.includes(election.status)) {
      return res.status(400).json({ success: false, error: `${action} requires election status in [${precondition.fromStatus.join(', ')}], current: ${election.status}` });
    }

    const requiredApprovals = Number.isInteger(threshold) && threshold >= 2 ? threshold : 2;
    const nonce = crypto.generateChallenge();
    const proposalHash = domainHash(DOMAIN.ELECTION_ADMIN_ACTION, { electionId, action, reason: reason || null, nonce });

    const approval = await prisma.electionApproval.create({
      data: {
        electionId,
        action,
        threshold: requiredApprovals,
        reason: reason || null,
        nonce,
        proposalHash,
        proposedBy: req.auth!.userId!,
        proposedByRole: req.auth!.role || 'UNKNOWN',
      },
    });

    return res.status(201).json({
      success: true,
      approval: { id: approval.id, action: approval.action, status: approval.status, threshold: approval.threshold, proposalHash: approval.proposalHash },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /:electionId/admin-actions/:approvalId/approve
 * Body: { signature, publicKey }
 * signature must be a real Ed25519 signature over the proposal's
 * proposalHash. First approval from a user establishes their signing key
 * (User.publicKey) if not already set; subsequent approvals must match it -
 * an admin can't sign with a throwaway key different from their
 * established identity.
 */
router.post('/:electionId/admin-actions/:approvalId/approve', requireAuth, requireOrgRole(['ORG_ADMIN', 'ELECTION_OFFICER']), async (req: AuthedRequest, res: Response) => {
  try {
    const { electionId, approvalId } = req.params;
    const { signature, publicKey } = req.body || {};
    if (!signature || !publicKey) {
      return res.status(400).json({ success: false, error: 'signature and publicKey are required' });
    }

    const approval = await prisma.electionApproval.findUnique({ where: { id: approvalId }, include: { signatures: true } });
    if (!approval || approval.electionId !== electionId) {
      return res.status(404).json({ success: false, error: 'Approval proposal not found' });
    }
    if (approval.status !== 'PENDING') {
      return res.status(409).json({ success: false, error: `Proposal is already ${approval.status}` });
    }

    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId! } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.publicKey && user.publicKey !== publicKey) {
      return res.status(403).json({ success: false, error: "Signature key does not match this admin's established signing key" });
    }

    if (!crypto.verifySignature(approval.proposalHash, signature, publicKey)) {
      return res.status(403).json({ success: false, error: 'Signature does not verify against the proposal hash' });
    }

    if (!user.publicKey) {
      await prisma.user.update({ where: { id: user.id }, data: { publicKey } });
    }

    try {
      await prisma.electionApprovalSignature.create({
        data: { approvalId, approverId: user.id, approverRole: req.auth!.role || 'UNKNOWN', signerPublicKey: publicKey, signature },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return res.status(409).json({ success: false, error: 'This admin has already approved this proposal' });
      }
      throw error;
    }

    const signatureCount = approval.signatures.length + 1;
    if (signatureCount < approval.threshold) {
      return res.json({ success: true, status: 'PENDING', signatureCount, threshold: approval.threshold });
    }

    const result = await executeApproval(approval.id, user.id);
    return res.json({ success: true, status: 'EXECUTED', signatureCount, threshold: approval.threshold, result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

async function executeApproval(approvalId: string, executedBy: string) {
  const approval = await prisma.electionApproval.findUniqueOrThrow({ where: { id: approvalId } });
  const election = await prisma.election.findUniqueOrThrow({ where: { id: approval.electionId } });
  const precondition = ACTION_PRECONDITIONS[approval.action];

  let resultSummary: Record<string, unknown>;
  try {
    if (approval.action === 'FINALIZE') {
      resultSummary = await finalizeElection(election.id);
    } else if (approval.action === 'TALLY') {
      resultSummary = await computeTally(election.id);
    } else if (precondition?.toStatus) {
      await prisma.election.update({ where: { id: election.id }, data: { status: precondition.toStatus } });
      resultSummary = { newStatus: precondition.toStatus };
    } else {
      throw new Error(`Unknown action ${approval.action}`);
    }

    await prisma.electionApproval.update({
      where: { id: approvalId },
      data: { status: 'EXECUTED', executedAt: new Date(), executedBy, executedResult: JSON.stringify(resultSummary) },
    });

    if (election.signingPrivateKey) {
      await createLedgerEntry(
        election.id,
        'ADMIN_ACTION',
        { action: approval.action, executedBy, approvalId },
        election.signingPrivateKey
      );
    }

    return resultSummary;
  } catch (error: any) {
    await prisma.electionApproval.update({
      where: { id: approvalId },
      data: { status: 'FAILED', executedAt: new Date(), executedBy, executedResult: JSON.stringify({ error: error.message }) },
    });
    throw error;
  }
}

/** GET /:electionId/admin-actions - list all proposals and their signoffs for this election. */
router.get('/:electionId/admin-actions', requireAuth, requireOrgRole(['ORG_ADMIN', 'ELECTION_OFFICER', 'AUDITOR']), async (req: AuthedRequest, res: Response) => {
  try {
    const { electionId } = req.params;
    const approvals = await prisma.electionApproval.findMany({
      where: { electionId },
      include: { signatures: { select: { approverId: true, approverRole: true, approvedAt: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, approvals });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
