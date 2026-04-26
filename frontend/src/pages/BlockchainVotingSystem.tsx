/**
 * SPDX-License-Identifier: LicenseRef-Proprietary
 * Copyright (c) 2026 blockchain-voting-system.
 * Proprietary and confidential. Unauthorized use, copying, or distribution is prohibited.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Divider,
  FormControlLabel,
  Switch,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { governanceService } from '../services/api';

type EligibilityExpr = {
  all?: Array<{ field: string; op: string; value?: any }>;
  any?: Array<{ field: string; op: string; value?: any }>;
};

type WizardElectionTemplate = {
  label: string;
  category: string;
  description: string;
  defaultCandidates: Array<{ name: string; party?: string; description?: string; order?: number }>;
};

const templates: WizardElectionTemplate[] = [
  {
    label: 'Motion (Yes / No)',
    category: 'MOTION',
    description: 'Fastest to run. Great for proposals and simple decisions.',
    defaultCandidates: [
      { name: 'YES', order: 0 },
      { name: 'NO', order: 1 },
    ],
  },
  {
    label: 'Ratification (Approve / Reject)',
    category: 'RATIFICATION',
    description: 'Approve a contract, endorse a plan, ratify bylaws.',
    defaultCandidates: [
      { name: 'APPROVE', order: 0 },
      { name: 'REJECT', order: 1 },
    ],
  },
  {
    label: 'Strike Authorization',
    category: 'STRIKE',
    description: 'High-stakes vote. Builds receipts + a Proof Pack for audit.',
    defaultCandidates: [
      { name: 'AUTHORIZE STRIKE', order: 0 },
      { name: 'DO NOT AUTHORIZE', order: 1 },
    ],
  },
  {
    label: 'Officer Election',
    category: 'OFFICER',
    description: 'Add candidates and run a standard election.',
    defaultCandidates: [{ name: 'Candidate 1', order: 0 }],
  },
  {
    label: 'Survey / Poll',
    category: 'SURVEY',
    description: 'Multiple-choice opinion check (add options).',
    defaultCandidates: [{ name: 'Option 1', order: 0 }],
  },
];

function csvTemplate() {
  return ['externalId,email,displayName,duesCurrent,unit,worksite', 'u-1001,alex@example.com,Alex,true,Store 12,Front Counter'].join('\n');
}

function buildEligibilityExpr(params: {
  requireActive: boolean;
  requireDuesCurrent: boolean;
  unitsCsv: string;
  worksitesCsv: string;
}): EligibilityExpr {
  const all: EligibilityExpr['all'] = [];
  if (params.requireActive) all.push({ field: 'isActive', op: 'eq', value: true });
  if (params.requireDuesCurrent) all.push({ field: 'duesCurrent', op: 'eq', value: true });

  const units = params.unitsCsv
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const worksites = params.worksitesCsv
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (units.length > 0) all.push({ field: 'unit', op: 'in', value: units });
  if (worksites.length > 0) all.push({ field: 'worksite', op: 'in', value: worksites });

  return { all };
}

function downloadJson(filename: string, data: any) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function BlockchainVotingSystem() {
  const [view, setView] = useState<'wizard' | 'dashboard'>('wizard');
  const steps = ['Welcome', 'Import members', 'Eligibility', 'Create election', 'Proof Pack'];
  const [activeStep, setActiveStep] = useState(0);

  const [orgInfo, setOrgInfo] = useState<any>(null);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [governanceHealth, setGovernanceHealth] = useState<any>(null);
  const [governanceHealthError, setGovernanceHealthError] = useState<string | null>(null);

  const [orgSlug, setOrgSlug] = useState('');
  const [providerName, setProviderName] = useState('default');

  const [settingsPatch, setSettingsPatch] = useState<any>({});
  const [settingsResult, setSettingsResult] = useState<any>(null);

  const [oidcName, setOidcName] = useState('default');
  const [oidcIssuerUrl, setOidcIssuerUrl] = useState('');
  const [oidcClientId, setOidcClientId] = useState('');
  const [oidcClientSecret, setOidcClientSecret] = useState('');
  const [oidcRedirectUri, setOidcRedirectUri] = useState('');
  const [oidcScopes, setOidcScopes] = useState('openid profile email');
  const [oidcEnabled, setOidcEnabled] = useState(true);
  const [oidcEmailClaim, setOidcEmailClaim] = useState('email');
  const [oidcSubjectClaim, setOidcSubjectClaim] = useState('sub');
  const [oidcRolesClaim, setOidcRolesClaim] = useState('');
  const [oidcResult, setOidcResult] = useState<any>(null);

  const [superName, setSuperName] = useState('');
  const [superSlug, setSuperSlug] = useState('');
  const [superType, setSuperType] = useState('UNION');
  const [superPrimaryContact, setSuperPrimaryContact] = useState('');
  const [superEmail, setSuperEmail] = useState('');
  const [superResult, setSuperResult] = useState<any>(null);

  const [csv, setCsv] = useState(csvTemplate());
  const [importResult, setImportResult] = useState<any>(null);

  const [requireActive, setRequireActive] = useState(true);
  const [requireDuesCurrent, setRequireDuesCurrent] = useState(true);
  const [unitsCsv, setUnitsCsv] = useState('');
  const [worksitesCsv, setWorksitesCsv] = useState('');
  const [ruleName, setRuleName] = useState('Eligible Voters');
  const [rules, setRules] = useState<any[]>([]);
  const [eligibilityRuleId, setEligibilityRuleId] = useState<string>('');
  const eligibilityExpr = useMemo(
    () => buildEligibilityExpr({ requireActive, requireDuesCurrent, unitsCsv, worksitesCsv }),
    [requireActive, requireDuesCurrent, unitsCsv, worksitesCsv]
  );

  const [template, setTemplate] = useState<WizardElectionTemplate>(templates[0]);
  const [electionName, setElectionName] = useState('');
  const [electionDescription, setElectionDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [candidates, setCandidates] = useState<Array<{ name: string; party?: string; description?: string; order?: number }>>(
    templates[0].defaultCandidates
  );
  const [createElectionResult, setCreateElectionResult] = useState<any>(null);

  const [elections, setElections] = useState<any[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState('');
  const [proofPack, setProofPack] = useState<any>(null);

  const authed = Boolean(localStorage.getItem('authToken'));

  const minOptions = useMemo(() => {
    // For binary/authorization style votes, keep at least 2 options.
    if (['MOTION', 'RATIFICATION', 'STRIKE'].includes(template.category)) return 2;
    return 1;
  }, [template.category]);

  const ssoLoginUrl = useMemo(() => {
    if (!orgSlug.trim() || !providerName.trim()) return '';
    const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
    return `${base}/governance/sso/oidc/${encodeURIComponent(orgSlug.trim())}/${encodeURIComponent(providerName.trim())}/login`;
  }, [orgSlug, providerName]);

  const oidcCallbackUrl = useMemo(() => {
    // Same-origin: nginx proxies `/api` to backend in production.
    return `${window.location.origin}/api/governance/sso/oidc/callback`;
  }, []);

  useEffect(() => {
    if (!authed) return;
    governanceService
      .getOrg()
      .then((data) => {
        setOrgInfo(data);
        setOrgError(null);

        const org = data?.organization;
        if (org?.slug && typeof org.slug === 'string') setOrgSlug(org.slug);

        const settings = data?.settings;
        if (settings) {
          setSettingsPatch({
            brandName: settings.brandName ?? '',
            brandLogoUrl: settings.brandLogoUrl ?? '',
            brandPrimaryColor: settings.brandPrimaryColor ?? '',
            allowSelfJoin: Boolean(settings.allowSelfJoin),
            selfJoinDomain: settings.selfJoinDomain ?? '',
            requireMfaAdmins: Boolean(settings.requireMfaAdmins),
            complianceProfile: settings.complianceProfile ?? 'GOVERNMENT',
            authMode: settings.authMode ?? 'LOCAL',
            tenantMode: settings.tenantMode ?? 'MULTI',
            mode: settings.mode ?? 'GOVERNANCE',
          });
        }

        // OIDC default redirect is the current origin callback.
        if (!oidcRedirectUri) setOidcRedirectUri(oidcCallbackUrl);
      })
      .catch((e) => {
        setOrgInfo(null);
        setOrgError(String(e));
      });
  }, [authed]);

  useEffect(() => {
    governanceService
      .health()
      .then((data) => {
        setGovernanceHealth(data);
        setGovernanceHealthError(null);
      })
      .catch((e) => {
        setGovernanceHealth(null);
        setGovernanceHealthError(String(e));
      });
  }, []);

  async function refreshRules() {
    const r = await governanceService.listEligibilityRules();
    setRules(r?.rules || []);
  }

  async function refreshElections() {
    const r = await governanceService.listElections();
    setElections(r?.elections || []);
  }

  useEffect(() => {
    if (!authed) return;
    refreshRules().catch(() => undefined);
    refreshElections().catch(() => undefined);
  }, [authed]);

  useEffect(() => {
    setCandidates(template.defaultCandidates);
    if (!electionName) setElectionName(template.label);
  }, [template]);

  useEffect(() => {
    if (startDate && endDate) return;
    const now = new Date();
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
    const fmt = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setStartDate(fmt(now));
    setEndDate(fmt(inOneHour));
  }, [startDate, endDate]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          blockchain-voting-system
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.85 }}>
          A guided setup for receipts + Merkle proofs + immutable audit trails.
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Button
            variant={view === 'wizard' ? 'contained' : 'outlined'}
            size="large"
            onClick={() => setView('wizard')}
          >
            Wizard (Step-by-step)
          </Button>
          <Button
            variant={view === 'dashboard' ? 'contained' : 'outlined'}
            size="large"
            onClick={() => setView('dashboard')}
          >
            All Tools (Everything)
          </Button>
          <Button component={RouterLink} to="/governance/verify" variant="outlined" size="large">
            Verify a receipt
          </Button>
        </Stack>
      </Stack>

      {view === 'dashboard' && (
        <Stack spacing={3} sx={{ mb: 3 }}>
          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h6">System status</Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                If something is broken, start here.
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  variant="contained"
                  onClick={async () => {
                    const data = await governanceService.health();
                    setGovernanceHealth(data);
                    setGovernanceHealthError(null);
                  }}
                >
                  Refresh blockchain-voting-system health
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    navigator.clipboard.writeText(oidcCallbackUrl).catch(() => undefined);
                  }}
                >
                  Copy SSO callback URL
                </Button>
              </Stack>

              {governanceHealthError && <Alert severity="warning">{governanceHealthError}</Alert>}
              {governanceHealth && (
                <Box component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0, fontSize: 12 }}>
                  {JSON.stringify(governanceHealth, null, 2)}
                </Box>
              )}
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h6">Organization settings (branding + rules)</Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                Change the name/logo/colors and basic admin rules.
              </Typography>

              {!authed ? (
                <Alert severity="warning">Sign in to edit organization settings.</Alert>
              ) : (
                <>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label="Brand name (what members see)"
                      value={settingsPatch.brandName || ''}
                      onChange={(e) => setSettingsPatch((p: any) => ({ ...p, brandName: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label="Primary color (optional)"
                      value={settingsPatch.brandPrimaryColor || ''}
                      onChange={(e) => setSettingsPatch((p: any) => ({ ...p, brandPrimaryColor: e.target.value }))}
                      fullWidth
                      placeholder="#1976d2"
                    />
                  </Stack>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label="Logo URL (optional)"
                      value={settingsPatch.brandLogoUrl || ''}
                      onChange={(e) => setSettingsPatch((p: any) => ({ ...p, brandLogoUrl: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label="Self-join email domain (optional)"
                      value={settingsPatch.selfJoinDomain || ''}
                      onChange={(e) => setSettingsPatch((p: any) => ({ ...p, selfJoinDomain: e.target.value }))}
                      fullWidth
                      placeholder="example.org"
                    />
                  </Stack>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(settingsPatch.allowSelfJoin)}
                          onChange={(e) => setSettingsPatch((p: any) => ({ ...p, allowSelfJoin: e.target.checked }))}
                        />
                      }
                      label="Allow self-join (simple onboarding)"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(settingsPatch.requireMfaAdmins)}
                          onChange={(e) => setSettingsPatch((p: any) => ({ ...p, requireMfaAdmins: e.target.checked }))}
                        />
                      }
                      label="Require MFA for admins"
                    />
                  </Stack>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label="Compliance profile"
                      value={settingsPatch.complianceProfile || 'GOVERNMENT'}
                      onChange={(e) => setSettingsPatch((p: any) => ({ ...p, complianceProfile: e.target.value }))}
                      fullWidth
                      helperText="Examples: GOVERNMENT, ENTERPRISE"
                    />
                    <TextField
                      label="Auth mode"
                      value={settingsPatch.authMode || 'LOCAL'}
                      onChange={(e) => setSettingsPatch((p: any) => ({ ...p, authMode: e.target.value }))}
                      fullWidth
                      helperText="LOCAL or OIDC"
                    />
                  </Stack>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label="Tenant mode"
                      value={settingsPatch.tenantMode || 'MULTI'}
                      onChange={(e) => setSettingsPatch((p: any) => ({ ...p, tenantMode: e.target.value }))}
                      fullWidth
                      helperText="MULTI or SINGLE"
                    />
                    <TextField
                      label="Platform mode"
                      value={settingsPatch.mode || 'GOVERNANCE'}
                      onChange={(e) => setSettingsPatch((p: any) => ({ ...p, mode: e.target.value }))}
                      fullWidth
                      helperText="blockchain-voting-system"
                    />
                  </Stack>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <Button
                      variant="contained"
                      onClick={async () => {
                        const r = await governanceService.updateOrgSettings(settingsPatch);
                        setSettingsResult(r);
                        try {
                          const data = await governanceService.getOrg();
                          setOrgInfo(data);
                          setOrgError(null);
                        } catch (e: any) {
                          setOrgError(String(e));
                        }
                      }}
                    >
                      Save settings
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setSettingsResult(null);
                      }}
                    >
                      Clear result
                    </Button>
                  </Stack>

                  {settingsResult && (
                    <Box component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0, fontSize: 12 }}>
                      {JSON.stringify(settingsResult, null, 2)}
                    </Box>
                  )}
                </>
              )}
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h6">Set up SSO (OIDC)</Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                Works with Okta, Auth0, Azure AD, Google, and most OIDC providers.
              </Typography>

              {!authed ? (
                <Alert severity="warning">Sign in as an org admin to configure SSO.</Alert>
              ) : (
                <>
                  <Alert severity="info">
                    Set your provider’s Redirect URI to: <b>{oidcCallbackUrl}</b>
                  </Alert>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField label="Provider name" value={oidcName} onChange={(e) => setOidcName(e.target.value)} fullWidth />
                    <FormControlLabel
                      control={<Switch checked={oidcEnabled} onChange={(e) => setOidcEnabled(e.target.checked)} />}
                      label="Enabled"
                    />
                  </Stack>

                  <TextField label="Issuer URL" value={oidcIssuerUrl} onChange={(e) => setOidcIssuerUrl(e.target.value)} fullWidth />
                  <TextField label="Client ID" value={oidcClientId} onChange={(e) => setOidcClientId(e.target.value)} fullWidth />
                  <TextField label="Client Secret" value={oidcClientSecret} onChange={(e) => setOidcClientSecret(e.target.value)} fullWidth type="password" />
                  <TextField label="Redirect URI" value={oidcRedirectUri} onChange={(e) => setOidcRedirectUri(e.target.value)} fullWidth />
                  <TextField label="Scopes" value={oidcScopes} onChange={(e) => setOidcScopes(e.target.value)} fullWidth />

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField label="Email claim" value={oidcEmailClaim} onChange={(e) => setOidcEmailClaim(e.target.value)} fullWidth />
                    <TextField label="Subject claim" value={oidcSubjectClaim} onChange={(e) => setOidcSubjectClaim(e.target.value)} fullWidth />
                  </Stack>
                  <TextField label="Roles claim (optional)" value={oidcRolesClaim} onChange={(e) => setOidcRolesClaim(e.target.value)} fullWidth />

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <Button
                      variant="contained"
                      onClick={async () => {
                        const r = await governanceService.configureOidcProvider({
                          name: oidcName,
                          issuerUrl: oidcIssuerUrl,
                          clientId: oidcClientId,
                          clientSecret: oidcClientSecret,
                          redirectUri: oidcRedirectUri,
                          scopes: oidcScopes,
                          enabled: oidcEnabled,
                          emailClaim: oidcEmailClaim,
                          subjectClaim: oidcSubjectClaim,
                          rolesClaim: oidcRolesClaim || null,
                        });
                        setOidcResult(r);
                        try {
                          const data = await governanceService.getOrg();
                          setOrgInfo(data);
                          setOrgError(null);
                        } catch (e: any) {
                          setOrgError(String(e));
                        }
                      }}
                    >
                      Save OIDC provider
                    </Button>
                    <Button
                      variant="outlined"
                      disabled={!ssoLoginUrl}
                      onClick={() => {
                        navigator.clipboard.writeText(ssoLoginUrl).catch(() => undefined);
                      }}
                    >
                      Copy SSO login link
                    </Button>
                  </Stack>

                  {oidcResult && (
                    <Box component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0, fontSize: 12 }}>
                      {JSON.stringify(oidcResult, null, 2)}
                    </Box>
                  )}

                  {orgInfo?.authProviders?.length > 0 && (
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Configured auth providers
                      </Typography>
                      <Box component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0, fontSize: 12 }}>
                        {JSON.stringify(orgInfo.authProviders, null, 2)}
                      </Box>
                    </Paper>
                  )}
                </>
              )}
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h6">Superadmin: Create a new organization</Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                Only superadmins can do this. If you’re not one, this will fail.
              </Typography>
              {!authed ? (
                <Alert severity="warning">Sign in as a superadmin to create organizations.</Alert>
              ) : (
                <>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField label="Organization name" value={superName} onChange={(e) => setSuperName(e.target.value)} fullWidth />
                    <TextField label="Slug (short name)" value={superSlug} onChange={(e) => setSuperSlug(e.target.value)} fullWidth />
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField label="Type" value={superType} onChange={(e) => setSuperType(e.target.value)} fullWidth />
                    <TextField label="Primary contact" value={superPrimaryContact} onChange={(e) => setSuperPrimaryContact(e.target.value)} fullWidth />
                  </Stack>
                  <TextField label="Contact email" value={superEmail} onChange={(e) => setSuperEmail(e.target.value)} fullWidth />

                  <Button
                    variant="contained"
                    onClick={async () => {
                      const r = await governanceService.superadminCreateOrg({
                        name: superName,
                        slug: superSlug,
                        type: superType,
                        primaryContact: superPrimaryContact,
                        email: superEmail,
                      });
                      setSuperResult(r);
                    }}
                    disabled={!superName || !superSlug || !superType || !superPrimaryContact || !superEmail}
                  >
                    Create organization
                  </Button>

                  {superResult && (
                    <Box component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0, fontSize: 12 }}>
                      {JSON.stringify(superResult, null, 2)}
                    </Box>
                  )}
                </>
              )}
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h6">Quick actions</Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                Big buttons for the main flows.
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button variant="contained" onClick={() => { setView('wizard'); setActiveStep(1); }} disabled={!authed}>
                  Import members
                </Button>
                <Button variant="contained" onClick={() => { setView('wizard'); setActiveStep(2); }} disabled={!authed}>
                  Eligibility rules
                </Button>
                <Button variant="contained" onClick={() => { setView('wizard'); setActiveStep(3); }} disabled={!authed}>
                  Create election
                </Button>
                <Button variant="contained" onClick={() => { setView('wizard'); setActiveStep(4); }} disabled={!authed}>
                  Proof Pack
                </Button>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button component={RouterLink} to="/login" variant="outlined">
                  Organizer login
                </Button>
                <Button
                  variant="text"
                  onClick={() => {
                    localStorage.removeItem('authToken');
                    setOrgInfo(null);
                    setOrgError(null);
                  }}
                >
                  Sign out
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Stack>
      )}

      {view === 'dashboard' && <Divider sx={{ my: 3 }} />}

      {view === 'wizard' && (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Stepper activeStep={activeStep} alternativeLabel>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Paper>

          {activeStep === 0 && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Stack spacing={2}>
                <Alert severity="info">If you just want to check a receipt, use the public verifier (no login).</Alert>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Button component={RouterLink} to="/governance/verify" variant="contained" size="large">
                    Verify a receipt
                  </Button>
                  <Button component={RouterLink} to="/login" variant="outlined" size="large">
                    Organizer login
                  </Button>
                </Stack>

                <Divider />

                <Typography variant="h6">SSO sign-in (OIDC)</Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  If your organization has SSO configured, enter your org slug + provider name and hit “Sign in with SSO”.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField label="Org slug" value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} fullWidth />
                  <TextField label="Provider" value={providerName} onChange={(e) => setProviderName(e.target.value)} fullWidth />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Button
                    variant="contained"
                    disabled={!ssoLoginUrl}
                    onClick={() => {
                      if (!ssoLoginUrl) return;
                      window.location.href = ssoLoginUrl;
                    }}
                  >
                    Sign in with SSO
                  </Button>
                  <Button
                    variant="text"
                    disabled={!ssoLoginUrl}
                    onClick={() => {
                      if (!ssoLoginUrl) return;
                      navigator.clipboard.writeText(ssoLoginUrl).catch(() => undefined);
                    }}
                  >
                    Copy SSO link
                  </Button>
                </Stack>

                {authed ? (
                  <Alert severity="success">Signed in (token present). Continue to Step 1.</Alert>
                ) : (
                  <Alert severity="warning">Not signed in yet. Use Organizer login or SSO to unlock admin steps.</Alert>
                )}

                <Stack direction="row" spacing={2} justifyContent="flex-end">
                  <Button variant="contained" disabled={!authed} onClick={() => setActiveStep(1)}>
                    Start setup
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          )}

      {activeStep > 0 && !authed && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Sign in to continue. Admin steps require an organizer token.
        </Alert>
      )}

      {activeStep === 1 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6">Step 1: Import members</Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Paste CSV or upload a file. Columns: externalId,email,displayName,duesCurrent,unit,worksite
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                variant="outlined"
                component="label"
                disabled={!authed}
              >
                Upload CSV file
                <input
                  hidden
                  type="file"
                  accept=".csv,text/csv"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const text = await f.text();
                    setCsv(text);
                  }}
                />
              </Button>
              <Button
                variant="text"
                onClick={() => {
                  setCsv(csvTemplate());
                }}
              >
                Load example
              </Button>
            </Stack>

            <TextField value={csv} onChange={(e) => setCsv(e.target.value)} multiline minRows={8} fullWidth />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                variant="contained"
                disabled={!authed}
                onClick={async () => {
                  const r = await governanceService.importMembersCsv(csv);
                  setImportResult(r);
                }}
              >
                Import members
              </Button>
              <Button
                variant="outlined"
                disabled={!authed}
                onClick={async () => {
                  const r = await governanceService.listMembers();
                  setImportResult(r);
                }}
              >
                Preview roster
              </Button>
            </Stack>

            {importResult && (
              <Box component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0, fontSize: 12 }}>
                {JSON.stringify(importResult, null, 2)}
              </Box>
            )}

            <Stack direction="row" spacing={2} justifyContent="space-between">
              <Button variant="text" onClick={() => setActiveStep(0)}>
                Back
              </Button>
              <Button variant="contained" disabled={!authed} onClick={() => setActiveStep(2)}>
                Next: eligibility
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {activeStep === 2 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6">Step 2: Eligibility</Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Build a simple rule with toggles instead of writing JSON.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                variant={requireActive ? 'contained' : 'outlined'}
                onClick={() => setRequireActive(v => !v)}
                disabled={!authed}
              >
                Require Active: {requireActive ? 'ON' : 'OFF'}
              </Button>
              <Button
                variant={requireDuesCurrent ? 'contained' : 'outlined'}
                onClick={() => setRequireDuesCurrent(v => !v)}
                disabled={!authed}
              >
                Require Dues Current: {requireDuesCurrent ? 'ON' : 'OFF'}
              </Button>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Units (comma-separated, optional)"
                value={unitsCsv}
                onChange={(e) => setUnitsCsv(e.target.value)}
                fullWidth
                disabled={!authed}
              />
              <TextField
                label="Worksites (comma-separated, optional)"
                value={worksitesCsv}
                onChange={(e) => setWorksitesCsv(e.target.value)}
                fullWidth
                disabled={!authed}
              />
            </Stack>

            <TextField label="Rule name" value={ruleName} onChange={(e) => setRuleName(e.target.value)} fullWidth disabled={!authed} />

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
                <Chip label={`Active: ${requireActive ? 'required' : 'ignored'}`} />
                <Chip label={`Dues: ${requireDuesCurrent ? 'required' : 'ignored'}`} />
                {unitsCsv.trim() && <Chip label={`Units: ${unitsCsv}`} />}
                {worksitesCsv.trim() && <Chip label={`Worksites: ${worksitesCsv}`} />}
              </Stack>
              <Box component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0, fontSize: 12 }}>
                {JSON.stringify(eligibilityExpr, null, 2)}
              </Box>
            </Paper>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                variant="contained"
                disabled={!authed}
                onClick={async () => {
                  const r = await governanceService.createEligibilityRule(ruleName, eligibilityExpr);
                  await refreshRules();
                  const newId = r?.rule?.id;
                  if (newId) setEligibilityRuleId(newId);
                }}
              >
                Save eligibility rule
              </Button>
              <Button variant="outlined" disabled={!authed} onClick={refreshRules}>
                Refresh saved rules
              </Button>
            </Stack>

            {rules.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Saved rules
                </Typography>
                <Stack spacing={1}>
                  {rules.map((r) => (
                    <Box key={r.id} sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography fontWeight="bold">{r.name}</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                          {r.id}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        variant={eligibilityRuleId === r.id ? 'contained' : 'outlined'}
                        onClick={() => setEligibilityRuleId(r.id)}
                      >
                        Use this
                      </Button>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            )}

            <Stack direction="row" spacing={2} justifyContent="space-between">
              <Button variant="text" onClick={() => setActiveStep(1)}>
                Back
              </Button>
              <Button variant="contained" disabled={!authed} onClick={() => setActiveStep(3)}>
                Next: election
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {activeStep === 3 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6">Step 3: Create election</Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Choose a template, confirm dates, and publish a locked electorate snapshot.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {templates.map((t) => (
                <Card key={t.label} sx={{ flex: 1, border: template.label === t.label ? '2px solid' : '1px solid', borderColor: template.label === t.label ? 'primary.main' : 'divider' }}>
                  <CardActionArea onClick={() => setTemplate(t)}>
                    <CardContent>
                      <Typography fontWeight="bold">{t.label}</Typography>
                      <Typography variant="body2" sx={{ opacity: 0.75 }}>
                        {t.description}
                      </Typography>
                      <Chip label={t.category} size="small" sx={{ mt: 1 }} />
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))}
            </Stack>

            <TextField label="Election name" value={electionName} onChange={(e) => setElectionName(e.target.value)} fullWidth disabled={!authed} />
            <TextField
              label="Description (optional)"
              value={electionDescription}
              onChange={(e) => setElectionDescription(e.target.value)}
              fullWidth
              disabled={!authed}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Start"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                disabled={!authed}
              />
              <TextField
                label="End"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                disabled={!authed}
              />
            </Stack>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography fontWeight="bold" sx={{ mb: 1 }}>
                Candidates / Options
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.75, display: 'block', mb: 1 }}>
                Minimum options for this template: {minOptions}
              </Typography>
              <Stack spacing={1}>
                {candidates.map((c, idx) => (
                  <Stack key={idx} direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField
                      label={`Option ${idx + 1}`}
                      value={c.name}
                      onChange={(e) => {
                        const next = [...candidates];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setCandidates(next);
                      }}
                      fullWidth
                      disabled={!authed}
                    />
                    <Button
                      variant="outlined"
                      color="error"
                      disabled={!authed || candidates.length <= minOptions}
                      onClick={() => {
                        setCandidates(candidates.filter((_, j) => j !== idx));
                      }}
                    >
                      Remove
                    </Button>
                  </Stack>
                ))}
                <Button
                  variant="text"
                  disabled={!authed}
                  onClick={() => setCandidates([...candidates, { name: `Option ${candidates.length + 1}`, order: candidates.length }])}
                >
                  + Add option
                </Button>
              </Stack>
            </Paper>

            <Alert severity="info">
              Snapshot lock happens automatically on creation. If you choose a saved rule above, its ID is used.
            </Alert>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                variant="contained"
                disabled={!authed}
                onClick={async () => {
                  const r = await governanceService.createElection({
                    name: electionName || template.label,
                    description: electionDescription || null,
                    category: template.category,
                    startDate: new Date(startDate).toISOString(),
                    endDate: new Date(endDate).toISOString(),
                    eligibilityRuleId: eligibilityRuleId || null,
                    candidates,
                  });
                  setCreateElectionResult(r);
                  await refreshElections();
                }}
              >
                Create election + lock electorate
              </Button>
              <Button variant="outlined" disabled={!authed} onClick={refreshElections}>
                Refresh elections
              </Button>
            </Stack>

            {createElectionResult && (
              <Box component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0, fontSize: 12 }}>
                {JSON.stringify(createElectionResult, null, 2)}
              </Box>
            )}

            <Stack direction="row" spacing={2} justifyContent="space-between">
              <Button variant="text" onClick={() => setActiveStep(2)}>
                Back
              </Button>
              <Button variant="contained" disabled={!authed} onClick={() => setActiveStep(4)}>
                Next: Proof Pack
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {activeStep === 4 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6">Step 4: Proof Pack</Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Export a “Proof Pack” for public verification and auditing.
            </Typography>

            {orgError && <Alert severity="warning">{orgError}</Alert>}
            {orgInfo && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography fontWeight="bold">Organization</Typography>
                <Box component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0, fontSize: 12 }}>
                  {JSON.stringify(orgInfo, null, 2)}
                </Box>
              </Paper>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Election"
                value={selectedElectionId}
                onChange={(e) => setSelectedElectionId(e.target.value)}
                fullWidth
                placeholder="Pick from the list below"
                disabled={!authed}
              />
              <Button
                variant="contained"
                disabled={!authed || !selectedElectionId}
                onClick={async () => {
                  const p = await governanceService.getProofPack(selectedElectionId);
                  setProofPack(p);
                  downloadJson(`proof-pack-${selectedElectionId}.json`, p);
                }}
              >
                Download Proof Pack
              </Button>
            </Stack>

            {elections.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Elections
                </Typography>
                <Stack spacing={1}>
                  {elections.map((e) => (
                    <Box key={e.id} sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography fontWeight="bold">{e.name}</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                          {e.id} • {e.status} • {e.category}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        variant={selectedElectionId === e.id ? 'contained' : 'outlined'}
                        onClick={() => setSelectedElectionId(e.id)}
                      >
                        Select
                      </Button>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            )}

            {proofPack && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography fontWeight="bold" sx={{ mb: 1 }}>
                  Latest Proof Pack
                </Typography>
                <Box component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0, fontSize: 12 }}>
                  {JSON.stringify(proofPack, null, 2)}
                </Box>
              </Paper>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button component={RouterLink} to="/governance/verify" variant="outlined">
                Open public verifier
              </Button>
              <Button
                variant="text"
                onClick={() => {
                  localStorage.removeItem('authToken');
                  setOrgInfo(null);
                  setOrgError(null);
                }}
              >
                Sign out
              </Button>
            </Stack>

            <Stack direction="row" spacing={2} justifyContent="space-between">
              <Button variant="text" onClick={() => setActiveStep(3)}>
                Back
              </Button>
              <Button variant="contained" onClick={() => setActiveStep(0)}>
                Done
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}
        </>
      )}
    </Container>
  );
}
