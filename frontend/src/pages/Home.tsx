/**
 * SPDX-License-Identifier: LicenseRef-Proprietary
 * Copyright (c) 2026 blockchain-voting-system.
 * Proprietary and confidential. Unauthorized use, copying, or distribution is prohibited.
 */

/**
 * Landing page. Every capability listed here is real and wired into a live
 * endpoint elsewhere in this app (see the linked pages) - not marketing
 * copy ahead of the implementation. Deliberately avoids cryptocurrency/
 * blockchain-as-currency framing: the cryptographic techniques used
 * (Merkle trees, zk-SNARKs, threshold decryption, external timestamping)
 * have nothing to do with a token or ledger-as-money.
 */

import { Link } from 'react-router-dom';
import { Box, Button, Card, CardContent, Chip, Container, Stack, Typography } from '@mui/material';
import { alpha, Theme } from '@mui/material/styles';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import AccountTreeRounded from '@mui/icons-material/AccountTreeRounded';
import VisibilityOffRounded from '@mui/icons-material/VisibilityOffRounded';
import FunctionsRounded from '@mui/icons-material/FunctionsRounded';
import ScheduleRounded from '@mui/icons-material/ScheduleRounded';
import TerminalRounded from '@mui/icons-material/TerminalRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import HowToVoteRounded from '@mui/icons-material/HowToVoteRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import MonitorHeartRounded from '@mui/icons-material/MonitorHeartRounded';

const differentiators = [
  {
    icon: <AccountTreeRounded />,
    title: 'Real Merkle audit trail',
    description:
      'Every ballot is hashed into an RFC 6962-style, domain-separated SHA3-256 Merkle tree. Anyone can recompute the root from the live ledger and confirm it matches - no vote can be silently added, removed, or altered.',
  },
  {
    icon: <VisibilityOffRounded />,
    title: 'Anonymous eligibility, not just anonymous ballots',
    description:
      'Voters enroll a Poseidon-committed credential and prove membership at vote time with a real Groth16 zk-SNARK circuit. The server verifies eligibility without ever learning which enrolled voter cast which ballot.',
  },
  {
    icon: <FunctionsRounded />,
    title: 'Homomorphic tally, independently re-checkable',
    description:
      'Ballots are encrypted one-hot with EC ElGamal, summed homomorphically, and decrypted only by combining threshold trustee shares with Chaum-Pedersen proofs. A public endpoint re-derives the whole tally from scratch and reports whether it agrees.',
  },
  {
    icon: <ScheduleRounded />,
    title: 'External timestamp anchoring',
    description:
      "A finalized election's signed manifest is optionally notarized against OpenTimestamps, an independent public timestamping service - proof the result existed at a point in time, without trusting this server's clock.",
  },
  {
    icon: <TerminalRounded />,
    title: 'Verifiable without trusting us',
    description:
      'A standalone verifier CLI ships separately from this server and re-checks signatures, Merkle proofs, and the tally offline. You are never asked to take our word for it.',
  },
  {
    icon: <GroupsRounded />,
    title: 'Multi-party admin approval',
    description:
      'Certifying, opening, finalizing, or cancelling an election requires real Ed25519 signatures from two or more distinct admins over the same proposal - no single compromised account can act alone.',
  },
];

const steps = [
  {
    title: '1. Anonymous enrollment',
    body: 'Eligible voters enroll a cryptographic commitment into the election\'s eligibility tree - the server records that a valid credential exists, not who holds it.',
  },
  {
    title: '2. Cast your vote',
    body: 'At vote time, a zero-knowledge proof shows your credential is a member of that tree without revealing which one. Your encrypted ballot is appended to a signed, hash-chained ledger.',
  },
  {
    title: '3. Verify your vote',
    body: 'Your receipt hash lets you (or anyone) recompute your ballot\'s Merkle inclusion proof and check it against the election\'s root - step by step, in plain language.',
  },
  {
    title: '4. Tally & finalize',
    body: 'Once voting closes, the homomorphic tally is computed and independently re-verified, then the election is finalized into one signed manifest and optionally timestamp-anchored.',
  },
];

export default function Home() {
  return (
    <Box>
      {/* Hero */}
      <Box
        sx={{
          background: (theme: Theme) =>
            theme.palette.mode === 'dark'
              ? `radial-gradient(circle at 20% 20%, ${alpha(theme.palette.primary.dark, 0.35)}, transparent 55%), ${theme.palette.background.default}`
              : `radial-gradient(circle at 20% 20%, ${alpha(theme.palette.primary.light, 0.18)}, transparent 55%), ${theme.palette.background.default}`,
          borderBottom: (theme: Theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
          <Stack spacing={3} sx={{ maxWidth: 760 }}>
            <Chip
              label="Cryptographic election infrastructure"
              color="secondary"
              variant="outlined"
              size="small"
              sx={{ alignSelf: 'flex-start' }}
            />
            <Typography variant="h1" component="h1" fontWeight={800}>
              Elections that prove themselves.
            </Typography>
            <Typography variant="h6" color="text.secondary" fontWeight={400} sx={{ maxWidth: 620 }}>
              Verity is a cryptographically verifiable election platform: real Merkle audit trails,
              zero-knowledge anonymous eligibility, a homomorphic tally, and external timestamp
              anchoring - independently checkable by anyone, not just trusted on our word.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
              <Button component={Link} to="/verify" variant="contained" size="large" endIcon={<ArrowForwardRounded />}>
                Verify Your Vote
              </Button>
              <Button component={Link} to="/elections" variant="outlined" size="large">
                View Elections
              </Button>
              <Button component={Link} to="/whitepaper" variant="text" size="large">
                Read the Whitepaper
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ pt: 1 }}>
              {['SHA3-256 Merkle trees', 'Groth16 zk-SNARK', 'EC ElGamal + Shamir threshold', 'Ed25519 signing', 'OpenTimestamps'].map(t => (
                <Chip key={t} label={t} size="small" variant="outlined" sx={{ fontFamily: 'inherit' }} />
              ))}
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* Differentiators */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Stack spacing={1} sx={{ mb: 4, maxWidth: 640 }}>
          <Typography variant="overline" color="secondary.main" fontWeight={700}>
            Why this is different
          </Typography>
          <Typography variant="h4" component="h2" fontWeight={800}>
            Every claim below is wired to a real, live endpoint
          </Typography>
        </Stack>
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' } }}>
          {differentiators.map(d => (
            <Card key={d.title} variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 1.5,
                    color: 'primary.main',
                    bgcolor: (theme: Theme) => alpha(theme.palette.primary.main, 0.1),
                  }}
                >
                  {d.icon}
                </Box>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                  {d.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {d.description}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Container>

      {/* How it works */}
      <Box sx={{ bgcolor: 'background.paper', borderTop: (theme: Theme) => `1px solid ${theme.palette.divider}`, borderBottom: (theme: Theme) => `1px solid ${theme.palette.divider}` }}>
        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
          <Typography variant="h4" component="h2" fontWeight={800} sx={{ mb: 4 }}>
            How It Works
          </Typography>
          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' } }}>
            {steps.map(s => (
              <Box key={s.title}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                  {s.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {s.body}
                </Typography>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* CTA strip */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          }}
        >
          <Card variant="outlined">
            <CardContent>
              <VerifiedRounded color="secondary" sx={{ mb: 1 }} />
              <Typography variant="h6" fontWeight={700}>
                Voters
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Walk through your ballot's real Merkle inclusion proof, step by step.
              </Typography>
              <Button component={Link} to="/verify" size="small" endIcon={<ArrowForwardRounded />}>
                Verify a vote
              </Button>
            </CardContent>
          </Card>
          <Card variant="outlined">
            <CardContent>
              <MonitorHeartRounded color="secondary" sx={{ mb: 1 }} />
              <Typography variant="h6" fontWeight={700}>
                Admins &amp; auditors
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Live cryptographic health: ledger integrity, tally re-verification, finalization status.
              </Typography>
              <Button component={Link} to="/admin/integrity" size="small" endIcon={<ArrowForwardRounded />}>
                Open the integrity dashboard
              </Button>
            </CardContent>
          </Card>
          <Card variant="outlined">
            <CardContent>
              <HowToVoteRounded color="secondary" sx={{ mb: 1 }} />
              <Typography variant="h6" fontWeight={700}>
                Everyone
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Browse active elections or read the full cryptographic audit trail.
              </Typography>
              <Button component={Link} to="/audit" size="small" endIcon={<ArrowForwardRounded />}>
                Public Audit Trail
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Container>

      {/* Honesty footer */}
      <Box sx={{ bgcolor: (theme: Theme) => alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.04 : 0.03) }}>
        <Container maxWidth="lg" sx={{ py: { xs: 5, md: 6 } }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
            What we don't claim
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 760 }}>
            This is not a cryptocurrency, a token, or a public financial ledger - the cryptography here
            (Merkle trees, zero-knowledge proofs, threshold decryption, external timestamping) has nothing
            to do with on-chain finance. No FIPS 140-2, Common Criteria, SOC 2, or ISO 27001 certification is
            held or claimed. See the{' '}
            <Typography component={Link} to="/whitepaper" color="secondary.main" sx={{ fontWeight: 600 }}>
              whitepaper
            </Typography>{' '}
            for the full, current breakdown of what's real versus in progress.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
