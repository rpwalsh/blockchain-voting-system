/**
 * SPDX-License-Identifier: LicenseRef-Proprietary
 * Copyright (c) 2026 blockchain-voting-system.
 * Proprietary and confidential. Unauthorized use, copying, or distribution is prohibited.
 */

import { useState } from 'react';
import { Routes, Route, Link, useLocation, useParams } from 'react-router-dom';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Container,
  useMediaQuery,
  Chip,
} from '@mui/material';
import { useTheme as useMuiTheme, alpha } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import HomeIcon from '@mui/icons-material/Home';
import CompareIcon from '@mui/icons-material/Compare';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ExploreIcon from '@mui/icons-material/Explore';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import VerifiedIcon from '@mui/icons-material/Verified';
import LoginIcon from '@mui/icons-material/Login';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import SecurityIcon from '@mui/icons-material/Security';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import Home from './pages/Home';
import Elections from './pages/Elections';
import Vote from './pages/Vote';
import Verify from './pages/Verify';
import Audit from './pages/Audit';
import CryptoDemo from './pages/CryptoDemo';
import CryptoWhitepaper from './pages/CryptoWhitepaper';
import BlockchainBrowser from './pages/BlockchainBrowser';
import WhyTrustless from './pages/WhyTrustless';
import DemoTour from './pages/DemoTour';
import Login from './pages/Login';
import Register from './pages/Register';
import SuperAdmin from './pages/SuperAdmin';
import AdminDebug from './pages/AdminDebug';
import AdminConfig from './pages/AdminConfig';
import IntegrityDashboard from './pages/IntegrityDashboard';
import BlockchainVotingSystem from './pages/BlockchainVotingSystem';
import GovernanceVerify from './pages/GovernanceVerify';
import SSOCallback from './pages/SSOCallback';
import ElectionPlayer from './components/ElectionPlayer/ElectionPlayer';
import { gradients } from './theme/muiTheme';

function PlayerWrapper() {
  const { electionId } = useParams();
  return <ElectionPlayer electionId={electionId || ''} />;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  highlight?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Home', path: '/', icon: <HomeIcon /> },
  { label: 'Why Us', path: '/why-trustless', icon: <CompareIcon />, highlight: true },
  { label: 'Blockchain', path: '/crypto-demo', icon: <AccountTreeIcon /> },
  { label: 'Explorer', path: '/explorer', icon: <ExploreIcon /> },
  { label: 'Whitepaper', path: '/whitepaper', icon: <MenuBookIcon /> },
  { label: 'Elections', path: '/elections', icon: <HowToVoteIcon /> },
  { label: 'Verify', path: '/verify', icon: <VerifiedIcon /> },
  { label: 'Integrity Dashboard', path: '/admin/integrity', icon: <MonitorHeartIcon />, highlight: true },
  { label: 'Governance', path: '/governance', icon: <SecurityIcon /> },
];

const authItems: NavItem[] = [
  { label: 'Login', path: '/login', icon: <LoginIcon /> },
  { label: 'Register', path: '/register', icon: <PersonAddIcon /> },
];

function App() {
  const location = useLocation();
  const { darkMode, toggleTheme } = useTheme();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('lg'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const drawer = (
    <Box sx={{ width: 280 }}>
      <Box
        sx={{
          p: 2,
          background: gradients.primary,
          color: 'white',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon />
          <Typography variant="h6" fontWeight="bold">
            Verity
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ opacity: 0.8 }}>
          Cryptographic Election Infrastructure
        </Typography>
      </Box>
      <Divider />
      <List>
        {navItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              component={Link}
              to={item.path}
              selected={isActive(item.path)}
              onClick={() => setDrawerOpen(false)}
              sx={{
                '&.Mui-selected': {
                  bgcolor: alpha(muiTheme.palette.primary.main, 0.1),
                  borderRight: `3px solid ${muiTheme.palette.primary.main}`,
                },
              }}
            >
              <ListItemIcon sx={{ color: isActive(item.path) ? 'primary.main' : 'inherit' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} />
              {item.highlight && (
                <Chip label="New" size="small" color="secondary" />
              )}
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        {authItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              component={Link}
              to={item.path}
              selected={isActive(item.path)}
              onClick={() => setDrawerOpen(false)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          onClick={toggleTheme}
          startIcon={darkMode ? <LightModeIcon /> : <DarkModeIcon />}
        >
          {darkMode ? 'Light Mode' : 'Dark Mode'}
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar
        position="sticky"
        elevation={1}
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: `1px solid ${muiTheme.palette.divider}`,
        }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ gap: 2 }}>
            {isMobile && (
              <IconButton
                edge="start"
                color="inherit"
                onClick={() => setDrawerOpen(true)}
              >
                <MenuIcon />
              </IconButton>
            )}

            <Box
              component={Link}
              to="/"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <SecurityIcon
                sx={{
                  fontSize: 32,
                  background: gradients.primary,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              />
              <Typography
                variant="h6"
                fontWeight="bold"
                sx={{
                  background: gradients.primary,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  display: { xs: 'none', sm: 'block' },
                }}
              >
                Verity
              </Typography>
            </Box>

            {!isMobile && (
              <Box component="nav" aria-label="Main navigation" sx={{ display: 'flex', gap: 0.5, ml: 2, flexGrow: 1 }}>
                {navItems.map((item) => (
                  <Button
                    key={item.path}
                    component={Link}
                    to={item.path}
                    startIcon={item.icon}
                    sx={{
                      color: isActive(item.path) ? 'primary.main' : 'text.secondary',
                      fontWeight: isActive(item.path) ? 600 : 400,
                      bgcolor: isActive(item.path) ? alpha(muiTheme.palette.primary.main, 0.08) : 'transparent',
                      '&:hover': {
                        bgcolor: alpha(muiTheme.palette.primary.main, 0.12),
                      },
                    }}
                  >
                    {item.label}
                    {item.highlight && (
                      <Chip
                        label="New"
                        size="small"
                        color="secondary"
                        sx={{ ml: 0.5, height: 18, fontSize: '0.65rem' }}
                      />
                    )}
                  </Button>
                ))}
              </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
              {!isMobile && (
                <>
                  <Button
                    component={Link}
                    to="/login"
                    variant="outlined"
                    size="small"
                    sx={{
                      borderColor: isActive('/login') ? 'primary.main' : 'divider',
                    }}
                  >
                    Login
                  </Button>
                  <Button
                    component={Link}
                    to="/register"
                    variant="contained"
                    size="small"
                  >
                    Register
                  </Button>
                </>
              )}
              <IconButton
                onClick={toggleTheme}
                color="inherit"
                sx={{
                  ml: 1,
                  bgcolor: alpha(muiTheme.palette.primary.main, 0.08),
                  '&:hover': {
                    bgcolor: alpha(muiTheme.palette.primary.main, 0.16),
                  },
                }}
              >
                {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {drawer}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/why-trustless" element={<WhyTrustless />} />
          <Route path="/why-us" element={<WhyTrustless />} />
          <Route path="/compare" element={<WhyTrustless />} />
          <Route path="/demo" element={<DemoTour />} />
          <Route path="/elections" element={<Elections />} />
          <Route path="/vote/:electionId" element={<Vote />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/crypto-demo" element={<CryptoDemo />} />
          <Route path="/whitepaper" element={<CryptoWhitepaper />} />
          <Route path="/crypto" element={<CryptoWhitepaper />} />
          <Route path="/explorer" element={<BlockchainBrowser />} />
          <Route path="/blockchain" element={<BlockchainBrowser />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/governance" element={<BlockchainVotingSystem />} />
          <Route path="/governance/verify" element={<GovernanceVerify />} />
          <Route path="/sso" element={<SSOCallback />} />
          <Route path="/admin" element={<SuperAdmin />} />
          <Route path="/admin/debug" element={<AdminDebug />} />
          <Route path="/admin/config" element={<AdminConfig />} />
          <Route path="/admin/dashboard" element={<SuperAdmin />} />
          <Route path="/admin/integrity" element={<IntegrityDashboard />} />
          <Route path="/admin/integrity/:electionId" element={<IntegrityDashboard />} />
          <Route path="/player/:electionId" element={<PlayerWrapper />} />
        </Routes>
      </Box>
    </Box>
  );
}

function AppWrapper() {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}

export default AppWrapper;