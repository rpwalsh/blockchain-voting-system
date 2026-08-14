/**
 * SPDX-License-Identifier: LicenseRef-Proprietary
 * Copyright (c) 2026 blockchain-voting-system.
 * Proprietary and confidential. Unauthorized use, copying, or distribution is prohibited.
 */

/**
 * Public "verify your vote" flow - the trust-building centerpiece. Walks a
 * voter through their real Merkle inclusion proof, one step at a time,
 * using POST /api/election-player/:electionId/verify-vote (see
 * backend/src/routes/election-player.ts). That endpoint recomputes the
 * proof from the live ballot set and checks it against the signed
 * finalization root when one exists - not a second, weaker verifier.
 *
 * Every hash, direction, and level shown below is a real field from that
 * response. The response also includes the voter's own candidate choice
 * (looked up server-side by receipt hash); this page never renders it -
 * a receipt should prove inclusion, not become a way to prove your vote
 * to someone standing over your shoulder.
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, Theme } from '@mui/material/styles';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CancelRounded from '@mui/icons-material/CancelRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import AccountTreeRounded from '@mui/icons-material/AccountTreeRounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import CallMergeRounded from '@mui/icons-material/CallMergeRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import { cryptoAuditService, electionPlayerService, governanceService } from '../services/api';
import { fontFamilyMono } from '../theme/muiTheme';

function truncateHash(hash?: string | null, head = 12, tail = 10): string {
  if (!hash) return '—';
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

function HashChip({ value, label }: { value?: string | null; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      {label && (
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
          {label}
        </Typography>
      )}
      <Box
        sx={{
          fontFamily: fontFamilyMono,
          fontSize: 12.5,
          px: 1,
          py: 0.5,
          borderRadius: 1,
          bgcolor: (theme: Theme) => alpha(theme.palette.text.primary, 0.05),
          border: (theme: Theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        {truncateHash(value)}
      </Box>
      <Tooltip title={copied ? 'Copied' : 'Copy full hash'}>
        <IconButton size="small" onClick={handleCopy} disabled={!value}>
          <ContentCopyRounded sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

interface VerifyResult {
  verified: boolean;
  checkedAgainst: string;
  receiptHash: string;
  timestamp: string;
  merkleProof: {
    root: string;
    leaf: string;
    index: number;
    algorithm: string;
    siblings: { left: boolean; hash: string; empty?: boolean }[];
  };
}

export default function Verify() {
  const [searchParams] = useSearchParams();

  const [electionId, setElectionId] = useState(searchParams.get('electionId') || '');
  const [receiptHash, setReceiptHash] = useState(searchParams.get('receiptHash') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [treeContext, setTreeContext] = useState<{ totalLeaves: number; depth: number } | null>(null);

  // Election lookup helper - unifies the old org-slug picker (formerly a
  // separate page) into this flow, for voters who only remember their
  // organization, not a raw election ID.
  const [orgSlug, setOrgSlug] = useState('');
  const [orgLookupLoading, setOrgLookupLoading] = useState(false);
  const [orgLookupError, setOrgLookupError] = useState('');
  const [orgElections, setOrgElections] = useState<any[]>([]);

  const runVerification = async (eid: string, hash: string) => {
    if (!eid.trim() || !hash.trim()) {
      setError('Enter both the election ID and your receipt hash.');
      return;
    }
    setLoading(true);
    setError('');
    setNotFound(false);
    setResult(null);
    setTreeContext(null);
    try {
      const res = await electionPlayerService.verifyVote(eid.trim(), hash.trim());
      if (!res.success || !res.vote) {
        setNotFound(true);
        return;
      }
      // Deliberately drop candidateName even though the API returns it -
      // see file header comment.
      setResult({
        verified: res.verified,
        checkedAgainst: res.checkedAgainst,
        receiptHash: res.vote.receiptHash,
        timestamp: res.vote.timestamp,
        merkleProof: res.vote.merkleProof,
      });
      cryptoAuditService
        .getMerkleTree(eid.trim())
        .then(treeRes => {
          if (treeRes.merkleTree) {
            setTreeContext({ totalLeaves: treeRes.merkleTree.totalLeaves, depth: treeRes.merkleTree.depth });
          }
        })
        .catch(() => {
          // Purely supplementary context - the verification result above
          // already stands on its own without it.
        });
    } catch (err: any) {
      if (err.response?.status === 404) {
        setNotFound(true);
      } else {
        setError(err.response?.data?.error || 'Could not reach the verification service. Try again shortly.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const eid = searchParams.get('electionId');
    const hash = searchParams.get('receiptHash');
    if (eid && hash) {
      runVerification(eid, hash);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoadOrgElections = async () => {
    if (!orgSlug.trim()) return;
    setOrgLookupLoading(true);
    setOrgLookupError('');
    try {
      const res = await governanceService.listPublicElections(orgSlug.trim());
      setOrgElections(res?.elections || []);
      if (!res?.elections?.length) setOrgLookupError('No public elections found for that organization.');
    } catch {
      setOrgLookupError('Could not find that organization.');
    } finally {
      setOrgLookupLoading(false);
    }
  };

  const levels = result?.merkleProof?.siblings?.length ?? 0;

  const rootMatches = result?.verified;

  const summaryLine = useMemo(() => {
    if (!result) return '';
    return result.checkedAgainst === 'signed final root'
      ? 'Checked against the signed, immutable finalization manifest - not the live database.'
      : 'Checked against the current election Merkle root (this election has not been finalized yet).';
  }, [result]);

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Chip
          size="small"
          icon={<VerifiedRounded />}
          label="Public · no login required"
          color="secondary"
          variant="outlined"
          sx={{ alignSelf: 'flex-start' }}
        />
        <Typography variant="h4" fontWeight={800}>
          Verify Your Vote
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640 }}>
          Enter the election ID and the receipt hash you were given after voting. We recompute your
          ballot's Merkle inclusion proof from the live ledger and check it here, step by step - the
          same check anyone, including an independent auditor, can perform.
        </Typography>
      </Stack>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Election ID"
                value={electionId}
                onChange={e => setElectionId(e.target.value)}
                fullWidth
                InputProps={{ sx: { fontFamily: fontFamilyMono, fontSize: 13.5 } }}
              />
              <TextField
                label="Receipt hash"
                value={receiptHash}
                onChange={e => setReceiptHash(e.target.value)}
                fullWidth
                InputProps={{ sx: { fontFamily: fontFamilyMono, fontSize: 13.5 } }}
              />
            </Stack>
            <Button
              variant="contained"
              size="large"
              onClick={() => runVerification(electionId, receiptHash)}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SearchRounded />}
              sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
            >
              {loading ? 'Verifying…' : 'Verify'}
            </Button>

            <Accordion variant="outlined" disableGutters sx={{ '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMoreRounded />}>
                <Typography variant="body2">Don't know your election ID? Look it up by organization</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label="Organization slug"
                      size="small"
                      value={orgSlug}
                      onChange={e => setOrgSlug(e.target.value)}
                      fullWidth
                    />
                    <Button variant="outlined" onClick={handleLoadOrgElections} disabled={orgLookupLoading}>
                      {orgLookupLoading ? 'Loading…' : 'Find elections'}
                    </Button>
                  </Stack>
                  {orgLookupError && <Alert severity="info">{orgLookupError}</Alert>}
                  {orgElections.length > 0 && (
                    <TextField
                      select
                      label="Election"
                      size="small"
                      value=""
                      onChange={e => setElectionId(e.target.value)}
                    >
                      {orgElections.map((e: any) => (
                        <MenuItem key={e.id} value={e.id}>
                          {e.name} ({e.status})
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {notFound && !loading && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          No ballot was found for that election ID and receipt hash. Double-check both values - they're
          case-sensitive and were shown to you exactly once, when you voted.
        </Alert>
      )}

      {result && (
        <Stack spacing={3}>
          <Alert
            severity={rootMatches ? 'success' : 'error'}
            icon={rootMatches ? <CheckCircleRounded /> : <CancelRounded />}
            sx={{ fontWeight: 600 }}
          >
            {rootMatches
              ? 'Your ballot is included in this election\'s ledger, and the proof checks out.'
              : 'The recomputed proof does not match the expected root - this ballot could not be verified.'}
            <Typography variant="caption" display="block" sx={{ mt: 0.5, fontWeight: 400 }}>
              {summaryLine}
            </Typography>
          </Alert>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                How this was checked
              </Typography>
              <Stepper orientation="vertical" nonLinear activeStep={levels + 2}>
                <Step expanded>
                  <StepLabel icon={<ReceiptLongRounded color="primary" />}>
                    <Typography fontWeight={600}>Ballot located</Typography>
                  </StepLabel>
                  <StepContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Your receipt hash matched exactly one cast ballot, recorded{' '}
                      {result.timestamp ? new Date(result.timestamp).toLocaleString() : 'at an unrecorded time'}.
                      {treeContext && ` It is one of ${treeContext.totalLeaves} ballots cast in this election.`}
                    </Typography>
                    <HashChip label="Receipt" value={result.receiptHash} />
                  </StepContent>
                </Step>

                <Step expanded>
                  <StepLabel icon={<LockRounded color="primary" />}>
                    <Typography fontWeight={600}>Leaf hash computed</Typography>
                  </StepLabel>
                  <StepContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Your encrypted ballot was hashed with {result.merkleProof.algorithm}, domain-separated
                      so a leaf hash can never be mistaken for an internal tree node. This is position{' '}
                      {result.merkleProof.index + 1} in the tree.
                    </Typography>
                    <HashChip label="Leaf" value={result.merkleProof.leaf} />
                  </StepContent>
                </Step>

                {result.merkleProof.siblings.map((sib, i) => (
                  <Step key={i} expanded>
                    <StepLabel icon={<CallMergeRounded color="primary" />}>
                      <Typography fontWeight={600}>
                        Combine at level {i + 1} of {levels}
                      </Typography>
                    </StepLabel>
                    <StepContent>
                      {sib.empty ? (
                        <Typography variant="body2" color="text.secondary">
                          No sibling at this level (odd node) - the hash is promoted unchanged to the next level.
                        </Typography>
                      ) : (
                        <>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Combined with the neighboring hash to the {sib.left ? 'left' : 'right'} of your
                            branch, producing the next level's hash.
                          </Typography>
                          <HashChip label="Sibling" value={sib.hash} />
                        </>
                      )}
                    </StepContent>
                  </Step>
                ))}

                <Step expanded>
                  <StepLabel icon={<AccountTreeRounded color={rootMatches ? 'success' : 'error'} />}>
                    <Typography fontWeight={600}>Compared to the election's Merkle root</Typography>
                  </StepLabel>
                  <StepContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      After {levels} combination{levels === 1 ? '' : 's'}, the resulting hash was compared
                      against the root below. {rootMatches ? 'They match.' : 'They do not match.'}
                    </Typography>
                    <HashChip label="Root" value={result.merkleProof.root} />
                  </StepContent>
                </Step>
              </Stepper>
            </CardContent>
          </Card>

          <Alert severity="info" variant="outlined">
            This proves your ballot is included and unmodified. It does not reveal, and cannot be used to
            prove to anyone else, which candidate you chose.
          </Alert>
        </Stack>
      )}

      <Divider sx={{ my: 4 }} />

      <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
        How verification works
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Every cast ballot is hashed into a Merkle tree - a structure where combining hashes pairwise, level
        by level, produces a single root hash. Changing or removing any one ballot changes that root, so
        matching the root proves your ballot is exactly as recorded, without decrypting it or revealing your
        choice. Once an election is finalized, that root is signed and (optionally) anchored to an
        independent public timestamping service, so this check no longer depends on trusting this server's
        live database at all.
      </Typography>
    </Container>
  );
}
