import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { governanceService } from '../services/api';

export default function GovernanceVerify() {
  const [orgSlug, setOrgSlug] = useState('');
  const [orgInfo, setOrgInfo] = useState<any>(null);
  const [elections, setElections] = useState<any[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState('');
  const [receiptHash, setReceiptHash] = useState('');
  const [result, setResult] = useState<any>(null);

  const canLoad = useMemo(() => orgSlug.trim().length > 0, [orgSlug]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Public Receipt Verifier
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.85 }}>
          Paste a receipt hash and get a Merkle inclusion proof.
        </Typography>
      </Stack>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack spacing={2}>
          <Alert severity="info">
            No login needed. You only need your organization slug and the receipt hash.
          </Alert>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Organization slug"
              value={orgSlug}
              onChange={(e) => setOrgSlug(e.target.value)}
              fullWidth
            />
            <Button
              variant="contained"
              disabled={!canLoad}
              onClick={async () => {
                const r = await governanceService.listPublicElections(orgSlug.trim());
                setOrgInfo(r?.organization || null);
                setElections(r?.elections || []);
                setSelectedElectionId('');
                setResult(null);
              }}
            >
              Load elections
            </Button>
          </Stack>

          {orgInfo && (
            <Alert severity="success">Loaded: {orgInfo.name}</Alert>
          )}

          {elections.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography fontWeight="bold" sx={{ mb: 1 }}>
                Elections
              </Typography>
              <Stack spacing={1}>
                {elections.map((e) => (
                  <Box
                    key={e.id}
                    sx={{
                      display: 'flex',
                      gap: 2,
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                    }}
                  >
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

          <TextField
            label="Receipt hash"
            value={receiptHash}
            onChange={(e) => setReceiptHash(e.target.value)}
            placeholder="Paste the receipt hash here"
            fullWidth
          />

          <Button
            variant="contained"
            disabled={!selectedElectionId || !receiptHash.trim()}
            onClick={async () => {
              const r = await governanceService.verifyReceipt(receiptHash.trim(), selectedElectionId);
              setResult(r);
            }}
          >
            Verify receipt
          </Button>

          {result && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography fontWeight="bold" sx={{ mb: 1 }}>
                Result
              </Typography>
              <Box component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0, fontSize: 12 }}>
                {JSON.stringify(result, null, 2)}
              </Box>
            </Paper>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
