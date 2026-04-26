/**
 * SPDX-License-Identifier: LicenseRef-Proprietary
 * Copyright (c) 2026 blockchain-voting-system.
 * Proprietary and confidential. Unauthorized use, copying, or distribution is prohibited.
 */

import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Paper, Button } from '@mui/material';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function SSOCallback() {
  const query = useQuery();
  const navigate = useNavigate();

  const token = query.get('token');

  useEffect(() => {
    if (token) {
      localStorage.setItem('authToken', token);
    }
  }, [token]);

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          SSO Sign-in
        </Typography>
        {token ? (
          <Box>
            <Typography sx={{ mb: 2 }}>
              Sign-in successful. Your session token is stored locally.
            </Typography>
            <Button variant="contained" onClick={() => navigate('/governance')}>Go to blockchain-voting-system</Button>
          </Box>
        ) : (
          <Box>
            <Typography sx={{ mb: 2 }}>
              Missing token. If you refreshed this page, retry the login flow.
            </Typography>
            <Button variant="outlined" onClick={() => navigate('/login')}>Go to Login</Button>
          </Box>
        )}
      </Paper>
    </Container>
  );
}
