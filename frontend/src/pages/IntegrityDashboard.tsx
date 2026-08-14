/**
 * SPDX-License-Identifier: LicenseRef-Proprietary
 * Copyright (c) 2026 blockchain-voting-system.
 * Proprietary and confidential. Unauthorized use, copying, or distribution is prohibited.
 */

/**
 * Election Integrity Dashboard - real cryptographic health signals for a
 * single election, pulled live from the crypto-audit, tally, finalization,
 * and operations endpoints. No number on this page is fabricated: every
 * chip, count, and chart derives directly from an API response, and every
 * section that has nothing to show yet says so explicitly rather than
 * inventing a placeholder value.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Container,
  Divider,
  IconButton,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CancelRounded from '@mui/icons-material/CancelRounded';
import HourglassEmptyRounded from '@mui/icons-material/HourglassEmptyRounded';
import AccountTreeRounded from '@mui/icons-material/AccountTreeRounded';
import LinkRounded from '@mui/icons-material/LinkRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import ScheduleRounded from '@mui/icons-material/ScheduleRounded';
import RestartAltRounded from '@mui/icons-material/RestartAltRounded';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import HowToVoteRounded from '@mui/icons-material/HowToVoteRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import { Chart } from '@risklab/charts-react';
import type { SeriesConfig } from '@risklab/charts';
import {
  cryptoAuditService,
  electionPlayerService,
  finalizationService,
  governanceService,
  operationsService,
  tallyService,
} from '../services/api';
import { fontFamilyMono } from '../theme/muiTheme';

type CheckStatus = 'PASS' | 'FAIL';

interface IntegrityCheck {
  check: string;
  status: CheckStatus;
  details: Record<string, unknown>;
}

const CHECK_ICONS: Record<string, JSX.Element> = {
  'Vote Count Integrity': <HowToVoteRounded fontSize="small" />,
  'Merkle Tree Integrity': <AccountTreeRounded fontSize="small" />,
  'Ledger Chain Integrity': <LinkRounded fontSize="small" />,
  'Vote Encryption Status': <LockRounded fontSize="small" />,
  'Timestamp Monotonicity': <ScheduleRounded fontSize="small" />,
};

function truncateHash(hash?: string | null, head = 10, tail = 8): string {
  if (!hash) return '—';
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

function StatusPill({ ok, pendingLabel }: { ok: boolean | null; pendingLabel?: string }) {
  if (ok === null) {
    return (
      <Chip
        size="small"
        icon={<HourglassEmptyRounded />}
        label={pendingLabel || 'PENDING'}
        variant="outlined"
      />
    );
  }
  return ok ? (
    <Chip size="small" color="success" icon={<CheckCircleRounded />} label="PASS" />
  ) : (
    <Chip size="small" color="error" icon={<CancelRounded />} label="FAIL" />
  );
}

function StatTile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="overline" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5, mb: hint ? 0.5 : 0 }}>
          {value}
        </Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

const CANDIDATE_COLORS = ['primary', 'secondary', 'warning', 'error', 'info'] as const;

interface CandidateSeriesPoint {
  name: string;
  votes: number;
  colorKey: (typeof CANDIDATE_COLORS)[number];
}

export default function IntegrityDashboard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { electionId: routeElectionId } = useParams();

  const [electionIdInput, setElectionIdInput] = useState(routeElectionId || '');
  const [selectedElectionId, setSelectedElectionId] = useState(routeElectionId || '');

  const [elections, setElections] = useState<any[]>([]);
  const [electionsRequiresAuth, setElectionsRequiresAuth] = useState(false);
  const [electionsLoading, setElectionsLoading] = useState(true);

  const [integrity, setIntegrity] = useState<any>(null);
  const [integrityLoading, setIntegrityLoading] = useState(false);
  const [integrityError, setIntegrityError] = useState('');

  const [tally, setTally] = useState<any>(null);
  const [tallyState, setTallyState] = useState<'idle' | 'loading' | 'ready' | 'not-computed' | 'error'>('idle');

  const [finalization, setFinalization] = useState<any>(null);
  const [anchor, setAnchor] = useState<any>(null);
  const [finalizationState, setFinalizationState] = useState<'idle' | 'loading' | 'ready' | 'not-finalized' | 'error'>('idle');

  const [observer, setObserver] = useState<any>(null);
  const [observerLoading, setObserverLoading] = useState(false);

  const [timeline, setTimeline] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [chartsLoading, setChartsLoading] = useState(false);

  const [recount, setRecount] = useState<any>(null);
  const [recountLoading, setRecountLoading] = useState(false);
  const [recountOpen, setRecountOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setElectionsLoading(true);
      try {
        const res = await governanceService.listElections();
        if (!cancelled) setElections(res.elections || []);
      } catch {
        if (!cancelled) setElectionsRequiresAuth(true);
      } finally {
        if (!cancelled) setElectionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadAll = useCallback(async (electionId: string) => {
    setIntegrityLoading(true);
    setIntegrityError('');
    setTallyState('loading');
    setFinalizationState('loading');
    setObserverLoading(true);
    setChartsLoading(true);
    setRecount(null);
    setRecountOpen(false);

    cryptoAuditService
      .getElectionIntegrity(electionId)
      .then(res => setIntegrity(res))
      .catch(err => setIntegrityError(err.response?.data?.error || 'Failed to load integrity report'))
      .finally(() => setIntegrityLoading(false));

    tallyService
      .verifyTally(electionId)
      .then(res => {
        setTally(res);
        setTallyState('ready');
      })
      .catch(err => {
        if (err.response?.status === 404) setTallyState('not-computed');
        else setTallyState('error');
      });

    finalizationService
      .getFinalization(electionId)
      .then(async res => {
        setFinalization(res);
        setFinalizationState('ready');
        try {
          const anchorRes = await finalizationService.getAnchorStatus(electionId);
          setAnchor(anchorRes);
        } catch {
          // Anchor status is best-effort - finalization itself already loaded.
        }
      })
      .catch(err => {
        if (err.response?.status === 404) setFinalizationState('not-finalized');
        else setFinalizationState('error');
      });

    operationsService
      .getObserverStatus(electionId)
      .then(res => setObserver(res))
      .catch(() => setObserver(null))
      .finally(() => setObserverLoading(false));

    Promise.allSettled([
      electionPlayerService.getTimeline(electionId),
      electionPlayerService.getStats(electionId),
    ])
      .then(([timelineRes, statsRes]) => {
        setTimeline(timelineRes.status === 'fulfilled' ? timelineRes.value : null);
        setStats(statsRes.status === 'fulfilled' ? statsRes.value : null);
      })
      .finally(() => setChartsLoading(false));
  }, []);

  useEffect(() => {
    if (selectedElectionId) {
      loadAll(selectedElectionId);
    }
  }, [selectedElectionId, loadAll]);

  const handleSelect = (id: string) => {
    if (!id) return;
    setSelectedElectionId(id);
    setElectionIdInput(id);
    navigate(`/admin/integrity/${id}`, { replace: true });
  };

  const handleRecount = async () => {
    if (!selectedElectionId) return;
    setRecountLoading(true);
    setRecountOpen(true);
    try {
      const res = await operationsService.recount(selectedElectionId);
      setRecount(res.recount);
    } catch (err: any) {
      setRecount({ error: err.response?.data?.error || 'Recount failed' });
    } finally {
      setRecountLoading(false);
    }
  };

  const ballotSeries = useMemo(() => {
    if (!timeline?.timeline?.length) return [];
    return timeline.timeline.map((entry: any) => ({
      x: new Date(entry.timestamp).getTime(),
      y: entry.sequenceNumber as number,
    }));
  }, [timeline]);

  const candidateSeries = useMemo<CandidateSeriesPoint[]>(() => {
    if (!stats?.candidates?.length) return [];
    const verifiedResults: any[] = tallyState === 'ready' ? tally?.results || [] : [];
    return stats.candidates.map((c: any, i: number) => {
      const verified = verifiedResults.find(r => r.candidateId === c.id);
      return {
        name: c.name,
        votes: verified ? verified.recomputedVoteCount : c.votes,
        colorKey: CANDIDATE_COLORS[i % CANDIDATE_COLORS.length],
      };
    });
  }, [stats, tally, tallyState]);

  const chartColor = (key: string) => (theme.palette as any)[key]?.main || theme.palette.primary.main;

  const ballotChartSeries = useMemo<SeriesConfig[]>(
    () => [{ id: 'ballots', name: 'Ballots cast', type: 'area', data: ballotSeries, color: theme.palette.primary.main }],
    [ballotSeries, theme.palette.primary.main]
  );

  const candidateChartSeries = useMemo<SeriesConfig[]>(
    () => [
      {
        id: 'votes',
        name: 'Votes',
        type: 'column',
        data: candidateSeries.map(c => ({ x: c.name, y: c.votes, color: chartColor(c.colorKey) })),
        dataLabels: { enabled: true, format: 'value', position: 'top', color: theme.palette.text.primary },
      },
    ],
    [candidateSeries, theme]
  );

  const tallyIsVerified = tallyState === 'ready' && !!tally?.allVerified;
  const overallVerified = integrity?.integrityReport?.overallStatus === 'VERIFIED';

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="overline" color="text.secondary">
          Admin
        </Typography>
        <Typography variant="h4" fontWeight={800}>
          Election Integrity Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 720 }}>
          Live cryptographic health for a single election: Merkle root recomputation, hash-chained
          ledger verification, an independent re-verification of the homomorphic tally, and
          finalization/timestamp-anchor status. Every value below is fetched directly from the
          crypto-audit, tally, finalization, and operations endpoints - nothing here is simulated.
        </Typography>
      </Stack>

      {/* Election picker */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            {electionsLoading ? (
              <Skeleton variant="rounded" width={280} height={40} />
            ) : elections.length > 0 ? (
              <TextField
                select
                label="Election"
                size="small"
                value={selectedElectionId}
                onChange={e => handleSelect(e.target.value)}
                sx={{ minWidth: 280 }}
              >
                {elections.map((e: any) => (
                  <MenuItem key={e.id} value={e.id}>
                    {e.name} ({e.status})
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <Alert severity={electionsRequiresAuth ? 'info' : 'warning'} sx={{ flex: 1 }}>
                {electionsRequiresAuth
                  ? 'Sign in as an org admin to browse your elections, or paste an election ID directly - the checks below are public read-only endpoints.'
                  : 'No elections found for this account.'}
              </Alert>
            )}

            <TextField
              label="Election ID"
              size="small"
              value={electionIdInput}
              onChange={e => setElectionIdInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSelect(electionIdInput.trim())}
              sx={{ minWidth: 280, fontFamily: fontFamilyMono }}
              InputProps={{ sx: { fontFamily: fontFamilyMono, fontSize: 13 } }}
              placeholder="paste an election ID"
            />
            <Button
              variant="contained"
              onClick={() => handleSelect(electionIdInput.trim())}
              disabled={!electionIdInput.trim()}
            >
              Load
            </Button>
            {selectedElectionId && (
              <Tooltip title="Refresh all checks">
                <IconButton onClick={() => loadAll(selectedElectionId)}>
                  <RefreshRounded />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </CardContent>
      </Card>

      {!selectedElectionId && (
        <Alert severity="info" icon={<ErrorOutlineRounded />}>
          Select or paste an election ID above to load its live integrity report.
        </Alert>
      )}

      {selectedElectionId && (
        <Stack spacing={3}>
          {/* Overall status + observer stat strip */}
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            }}
          >
            <Card
              variant="outlined"
              sx={{
                gridColumn: { xs: '1', md: 'span 1' },
                borderColor: integrityLoading
                  ? undefined
                  : overallVerified
                  ? alpha(theme.palette.success.main, 0.4)
                  : alpha(theme.palette.error.main, 0.4),
              }}
            >
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  Cryptographic Status
                </Typography>
                {integrityLoading ? (
                  <Skeleton variant="text" width={120} height={40} />
                ) : integrityError ? (
                  <Typography color="error.main" variant="body2">
                    {integrityError}
                  </Typography>
                ) : (
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    {overallVerified ? (
                      <CheckCircleRounded color="success" />
                    ) : (
                      <CancelRounded color="error" />
                    )}
                    <Typography variant="h5" fontWeight={800}>
                      {integrity?.integrityReport?.overallStatus || 'UNKNOWN'}
                    </Typography>
                  </Stack>
                )}
                <Typography variant="caption" color="text.secondary">
                  {integrity?.integrityReport?.checksPerformed ?? '—'} checks, recomputed live
                </Typography>
              </CardContent>
            </Card>

            <StatTile
              label="Ballots Cast"
              value={observerLoading ? <Skeleton width={60} /> : observer?.observer?.voteCount ?? '—'}
            />
            <StatTile
              label="Ledger Entries"
              value={observerLoading ? <Skeleton width={60} /> : observer?.observer?.ledgerEntryCount ?? '—'}
            />
            <StatTile
              label="Election Status"
              value={observerLoading ? <Skeleton width={60} /> : observer?.observer?.status ?? '—'}
              hint={
                observer?.observer?.finalized
                  ? observer?.observer?.timestampAnchorConfirmed
                    ? 'Finalized, anchor confirmed'
                    : 'Finalized, anchor pending'
                  : 'Not yet finalized'
              }
            />
          </Box>

          {/* Integrity checks grid */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                Integrity Checks
              </Typography>
              {integrityLoading ? (
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} variant="rounded" height={90} />
                  ))}
                </Box>
              ) : integrityError ? (
                <Alert severity="error">{integrityError}</Alert>
              ) : (
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                  {(integrity?.integrityReport?.checks || []).map((c: IntegrityCheck) => (
                    <Card
                      key={c.check}
                      variant="outlined"
                      sx={{
                        borderColor:
                          c.status === 'PASS'
                            ? alpha(theme.palette.success.main, 0.35)
                            : alpha(theme.palette.error.main, 0.4),
                      }}
                    >
                      <CardContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                          <Stack direction="row" spacing={1} alignItems="center">
                            {CHECK_ICONS[c.check] || <FactCheckRounded fontSize="small" />}
                            <Typography variant="subtitle2" fontWeight={700}>
                              {c.check}
                            </Typography>
                          </Stack>
                          <StatusPill ok={c.status === 'PASS'} />
                        </Stack>
                        <Stack spacing={0.25} sx={{ mt: 1 }}>
                          {Object.entries(c.details || {})
                            .filter(([k]) => k !== 'issues')
                            .slice(0, 4)
                            .map(([k, v]) => (
                              <Typography
                                key={k}
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}
                              >
                                <span>{k}</span>
                                <span style={{ fontFamily: fontFamilyMono, textAlign: 'right' }}>
                                  {String(v)}
                                </span>
                              </Typography>
                            ))}
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Charts */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" fontWeight={700}>
                  Ballots Cast Over Time
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Cumulative count from the real ballot timeline
                </Typography>
                <Box sx={{ height: 260, mt: 2 }}>
                  {chartsLoading ? (
                    <Skeleton variant="rounded" height="100%" />
                  ) : ballotSeries.length === 0 ? (
                    <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
                      <Typography variant="body2" color="text.secondary">
                        No ballots cast yet
                      </Typography>
                    </Stack>
                  ) : (
                    <Chart
                      series={ballotChartSeries}
                      theme={theme.palette.mode}
                      height="100%"
                      width="100%"
                      xAxis={{
                        type: 'time',
                        labels: {
                          format: (value: number) =>
                            new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                        },
                      }}
                      yAxis={{ type: 'linear', min: 0, allowDecimals: false }}
                      legend={{ enabled: false }}
                      tooltip={{ shared: true }}
                      animation={{ enabled: true, duration: 400 }}
                    />
                  )}
                </Box>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" fontWeight={700}>
                  Candidate Standings
                </Typography>
                <Typography variant="caption" color={tallyIsVerified ? 'success.main' : 'text.secondary'}>
                  {tallyIsVerified
                    ? 'Cryptographically verified tally (homomorphic sum + threshold decryption re-checked)'
                    : 'Live ballot count - pending independent tally verification'}
                </Typography>
                <Box sx={{ height: 260, mt: 2 }}>
                  {chartsLoading ? (
                    <Skeleton variant="rounded" height="100%" />
                  ) : candidateSeries.length === 0 ? (
                    <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
                      <Typography variant="body2" color="text.secondary">
                        No candidates or ballots yet
                      </Typography>
                    </Stack>
                  ) : (
                    <Chart
                      series={candidateChartSeries}
                      theme={theme.palette.mode}
                      height="100%"
                      width="100%"
                      xAxis={{ type: 'band', labels: { enabled: true } }}
                      yAxis={{ type: 'linear', min: 0, allowDecimals: false }}
                      legend={{ enabled: false }}
                      tooltip={{ shared: true }}
                      animation={{ enabled: true, duration: 400 }}
                    />
                  )}
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* Tally verification */}
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6" fontWeight={700}>
                  Tally Verification
                </Typography>
                {tallyState === 'ready' && (
                  <StatusPill ok={tallyIsVerified} pendingLabel="UNVERIFIED" />
                )}
              </Stack>
              {tallyState === 'loading' && <Skeleton variant="rounded" height={80} />}
              {tallyState === 'not-computed' && (
                <Alert severity="info">
                  No tally has been computed for this election yet. Once computed, this section
                  independently re-derives the homomorphic sum and re-checks every trustee's
                  Chaum-Pedersen partial-decryption proof from scratch - it does not trust the
                  stored vote count.
                </Alert>
              )}
              {tallyState === 'error' && (
                <Alert severity="error">Could not load tally verification for this election.</Alert>
              )}
              {tallyState === 'ready' && (
                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    {tally.totalBallots} ballots homomorphically summed and re-decrypted independently of the stored result.
                  </Typography>
                  <Box sx={{ overflowX: 'auto' }}>
                    <Box
                      component="table"
                      sx={{ width: '100%', borderCollapse: 'collapse', mt: 1, minWidth: 480 }}
                    >
                      <Box component="thead">
                        <Box component="tr">
                          {['Candidate', 'Certified', 'Recomputed', 'Sum matches', 'Proofs valid', 'Count matches'].map(h => (
                            <Box
                              component="th"
                              key={h}
                              sx={{ textAlign: 'left', py: 1, borderBottom: `2px solid ${theme.palette.divider}`, fontSize: 12, color: 'text.secondary' }}
                            >
                              {h}
                            </Box>
                          ))}
                        </Box>
                      </Box>
                      <Box component="tbody">
                        {tally.results.map((r: any) => (
                          <Box component="tr" key={r.candidateId}>
                            <Box component="td" sx={{ py: 1, borderBottom: `1px solid ${theme.palette.divider}`, fontFamily: fontFamilyMono, fontSize: 12 }}>
                              {truncateHash(r.candidateId, 8, 4)}
                            </Box>
                            <Box component="td" sx={{ py: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>
                              {r.certifiedVoteCount}
                            </Box>
                            <Box component="td" sx={{ py: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>
                              {r.recomputedVoteCount}
                            </Box>
                            <Box component="td" sx={{ py: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>
                              <StatusPill ok={r.checks.ciphertextSumMatches} />
                            </Box>
                            <Box component="td" sx={{ py: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>
                              <StatusPill ok={r.checks.partialDecryptionProofsValid} />
                            </Box>
                            <Box component="td" sx={{ py: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>
                              <StatusPill ok={r.checks.decryptedCountMatches} />
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                </Stack>
              )}
            </CardContent>
          </Card>

          {/* Finalization + timestamp anchor */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                Finalization &amp; Timestamp Anchor
              </Typography>
              {finalizationState === 'loading' && <Skeleton variant="rounded" height={80} />}
              {finalizationState === 'not-finalized' && (
                <Alert severity="info">
                  This election has not been finalized yet. Finalization produces a single signed,
                  append-only manifest (configuration hash, eligibility root, ballot root, ledger
                  root) that a verifier checks against instead of the live database.
                </Alert>
              )}
              {finalizationState === 'error' && (
                <Alert severity="error">Could not load finalization status.</Alert>
              )}
              {finalizationState === 'ready' && finalization && (
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">Manifest hash</Typography>
                    <Typography sx={{ fontFamily: fontFamilyMono, fontSize: 13 }}>
                      {truncateHash(finalization.finalization?.manifestHash)}
                    </Typography>
                  </Stack>
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">Signature</Typography>
                    <StatusPill ok={!!finalization.verified?.signatureValid} />
                  </Stack>
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">Ballot count at finalization</Typography>
                    <Typography variant="body2">{finalization.finalization?.ballotCount}</Typography>
                  </Stack>
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">External timestamp anchor</Typography>
                    {anchor?.anchored ? (
                      <StatusPill ok={!!anchor.confirmed} pendingLabel="SUBMITTED, AWAITING CONFIRMATION" />
                    ) : (
                      <Chip size="small" variant="outlined" label="NOT SUBMITTED" />
                    )}
                  </Stack>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Recount */}
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    Full Recount
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Recomputes the ledger chain, ballot Merkle tree, and (if tallied) the threshold
                    decryption from scratch - a read-only recomputation, not a re-tally.
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  startIcon={recountLoading ? <CircularProgress size={16} /> : <RestartAltRounded />}
                  onClick={handleRecount}
                  disabled={recountLoading}
                >
                  Run Recount
                </Button>
              </Stack>
              <Collapse in={recountOpen}>
                <Divider sx={{ my: 2 }} />
                {recountLoading && <Skeleton variant="rounded" height={60} />}
                {!recountLoading && recount?.error && <Alert severity="error">{recount.error}</Alert>}
                {!recountLoading && recount && !recount.error && (
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <StatusPill ok={recount.allMatch} pendingLabel="MISMATCH" />
                      <Typography variant="body2">
                        {recount.allMatch
                          ? 'Independently recomputed values match what is currently stored.'
                          : 'Discrepancy found between the recomputed and stored values - see details below.'}
                      </Typography>
                    </Stack>
                    <Box
                      sx={{
                        display: 'grid',
                        gap: 1,
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                        fontSize: 13,
                      }}
                    >
                      <Typography variant="body2">
                        Ledger entries checked: <b>{recount.ledgerEntriesChecked}</b>
                      </Typography>
                      <Typography variant="body2">
                        Ballots checked: <b>{recount.ballotsChecked}</b>
                      </Typography>
                      <Typography variant="body2">
                        Merkle root matches live: <b>{String(recount.merkleMatchesLive)}</b>
                      </Typography>
                    </Box>
                    {recount.ledgerIssues?.length > 0 && (
                      <Alert severity="warning">{recount.ledgerIssues.join('; ')}</Alert>
                    )}
                  </Stack>
                )}
              </Collapse>
            </CardContent>
          </Card>

          <Stack direction="row" spacing={1} alignItems="center" color="text.secondary">
            <VisibilityRounded fontSize="small" />
            <Typography variant="caption">
              These checks read from public, unauthenticated observer endpoints where noted in the
              backend - anyone with the election ID can reproduce this report, not just an admin.
            </Typography>
          </Stack>
        </Stack>
      )}
    </Container>
  );
}
