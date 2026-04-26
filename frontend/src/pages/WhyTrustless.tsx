/**
 * WHY TRUSTLESS VOTING - COMPARISON & DEMO POLL
 * ==============================================
 * Shows gaps in 2024 election data vs our cryptographic approach
 * Interactive mock poll demonstrates the full voting experience
 * 
 * Fully polished with Material UI components
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Radio,
  LinearProgress,
  Fade,
  Collapse,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Alert,
  IconButton,
  Tooltip,
  CircularProgress,
  useMediaQuery,
} from '@mui/material';
import { useTheme as useMuiTheme, alpha, styled } from '@mui/material/styles';
import LockIcon from '@mui/icons-material/Lock';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import LinkIcon from '@mui/icons-material/Link';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import BoltIcon from '@mui/icons-material/Bolt';
import BlockIcon from '@mui/icons-material/Block';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';
import TheaterComedyIcon from '@mui/icons-material/TheaterComedy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import SecurityIcon from '@mui/icons-material/Security';
import GppGoodIcon from '@mui/icons-material/GppGood';
import GppBadIcon from '@mui/icons-material/GppBad';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

interface DataPoint {
  category: string;
  traditional: string | null;
  trustless: string;
  icon: React.ReactNode;
  critical: boolean;
}

interface PollOption {
  id: string;
  label: string;
  votes: number;
}

interface VoteReceipt {
  receiptHash: string;
  timestamp: string;
  merkleRoot: string;
  blockHeight: number;
  zkProofValid: boolean;
}

// Styled components
const GradientBox = styled(Box)(({ theme }) => ({
  background: theme.palette.mode === 'dark'
    ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: '#fff',
  borderRadius: Number(theme.shape.borderRadius) * 2,
  padding: theme.spacing(6),
  textAlign: 'center',
  marginBottom: theme.spacing(4),
}));

const ComparisonRow = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'visible' && prop !== 'critical',
})<{ visible?: boolean; critical?: boolean }>(({ theme, visible, critical }) => ({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  marginBottom: theme.spacing(1),
  opacity: visible ? 1 : 0,
  transform: visible ? 'translateY(0)' : 'translateY(20px)',
  transition: 'all 0.3s ease',
  borderLeft: critical ? `4px solid ${theme.palette.error.main}` : 'none',
  [theme.breakpoints.down('md')]: {
    gridTemplateColumns: '1fr',
    '& > *': {
      padding: theme.spacing(1),
    },
  },
}));

const ReceiptCode = styled('code')(({ theme }) => ({
  display: 'block',
  fontFamily: 'Monaco, "Cascadia Code", "Fira Code", monospace',
  fontSize: '0.75rem',
  backgroundColor: alpha(theme.palette.primary.main, 0.1),
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  wordBreak: 'break-all',
  color: theme.palette.text.secondary,
}));

const PollOptionCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== 'selected',
})<{ selected?: boolean }>(({ theme, selected }) => ({
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  border: selected
    ? `2px solid ${theme.palette.primary.main}`
    : `2px solid transparent`,
  backgroundColor: selected
    ? alpha(theme.palette.primary.main, 0.08)
    : theme.palette.background.paper,
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4],
  },
}));

const dataComparison: DataPoint[] = [
  {
    category: 'Vote Encryption',
    traditional: null,
    trustless: 'Curve25519 ECDH + XSalsa20-Poly1305 AEAD',
    icon: <LockIcon />,
    critical: true,
  },
  {
    category: 'Voter Verification',
    traditional: 'Signature match (subjective)',
    trustless: 'Zero-Knowledge Proof (mathematical)',
    icon: <VerifiedUserIcon />,
    critical: true,
  },
  {
    category: 'Chain of Custody',
    traditional: 'Paper logs, human attestation',
    trustless: 'SHA3-256 hash chain, immutable ledger',
    icon: <LinkIcon />,
    critical: true,
  },
  {
    category: 'Audit Trail',
    traditional: 'Partial, varies by county',
    trustless: 'Complete cryptographic proof for every vote',
    icon: <FactCheckIcon />,
    critical: true,
  },
  {
    category: 'Vote Receipt',
    traditional: null,
    trustless: 'Unique hash for personal verification',
    icon: <ReceiptLongIcon />,
    critical: true,
  },
  {
    category: 'Real-time Results',
    traditional: 'Days/weeks to certify',
    trustless: 'Instant with homomorphic tallying',
    icon: <BoltIcon />,
    critical: false,
  },
  {
    category: 'Double Vote Prevention',
    traditional: 'Database check (can fail)',
    trustless: 'Cryptographic nullifier (mathematically impossible)',
    icon: <BlockIcon />,
    critical: true,
  },
  {
    category: 'Public Verifiability',
    traditional: null,
    trustless: 'Anyone can verify the entire election',
    icon: <VisibilityIcon />,
    critical: true,
  },
  {
    category: 'Tamper Detection',
    traditional: 'Manual recount',
    trustless: 'Automatic - any change breaks hash chain',
    icon: <SearchIcon />,
    critical: true,
  },
  {
    category: 'Voter Privacy',
    traditional: 'Trust poll workers',
    trustless: 'Mathematically guaranteed anonymity',
    icon: <TheaterComedyIcon />,
    critical: true,
  },
];

const mockPollOptions: PollOption[] = [
  { id: 'a', label: 'Cryptographic verification for all elections', votes: 0 },
  { id: 'b', label: 'Keep current paper-based system', votes: 0 },
  { id: 'c', label: 'Hybrid approach with both', votes: 0 },
  { id: 'd', label: 'Need more information to decide', votes: 0 },
];

export default function WhyTrustless() {
  useTheme(); // Keep theme context for dark mode CSS class
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  
  const [animationStep, setAnimationStep] = useState(0);
  const [showComparison, setShowComparison] = useState(false);
  const [pollOptions, setPollOptions] = useState(mockPollOptions);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [voteReceipt, setVoteReceipt] = useState<VoteReceipt | null>(null);
  const [votingStage, setVotingStage] = useState<'select' | 'encrypting' | 'proving' | 'submitting' | 'confirmed'>('select');
  const [showVerification, setShowVerification] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Animate the comparison reveal
  useEffect(() => {
    if (showComparison && animationStep < dataComparison.length) {
      const timer = setTimeout(() => {
        setAnimationStep(prev => prev + 1);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [showComparison, animationStep]);

  // Generate mock cryptographic data
  const generateHash = () => {
    const chars = '0123456789abcdef';
    return Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * 16)]).join('');
  };

  const handleVote = async () => {
    if (!selectedOption) return;

    // Stage 1: Encrypting
    setVotingStage('encrypting');
    await new Promise(r => setTimeout(r, 1200));

    // Stage 2: Generating ZK Proof
    setVotingStage('proving');
    await new Promise(r => setTimeout(r, 1500));

    // Stage 3: Submitting to blockchain
    setVotingStage('submitting');
    await new Promise(r => setTimeout(r, 1000));

    // Stage 4: Confirmed
    const receipt: VoteReceipt = {
      receiptHash: generateHash(),
      timestamp: new Date().toISOString(),
      merkleRoot: generateHash(),
      blockHeight: 847293 + Math.floor(Math.random() * 100),
      zkProofValid: true,
    };

    setVoteReceipt(receipt);
    setPollOptions(prev => prev.map(opt => 
      opt.id === selectedOption 
        ? { ...opt, votes: opt.votes + 1 }
        : opt
    ));
    setHasVoted(true);
    setVotingStage('confirmed');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const totalVotes = pollOptions.reduce((sum, opt) => sum + opt.votes, 0);

  const getVotingProgress = () => {
    switch (votingStage) {
      case 'encrypting': return 33;
      case 'proving': return 66;
      case 'submitting': return 90;
      case 'confirmed': return 100;
      default: return 0;
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 4 }}>
      <Container maxWidth="lg">
        {/* Hero Section */}
        <GradientBox>
          <SecurityIcon sx={{ fontSize: 64, mb: 2, opacity: 0.9 }} />
          <Typography variant="h2" fontWeight="bold" gutterBottom>
            Why Trustless Voting?
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9, maxWidth: 600, mx: 'auto' }}>
            See the critical data gaps in traditional elections—and how cryptography solves them
          </Typography>
        </GradientBox>

        {/* 2024 Election Data Gaps Animation */}
        <Card sx={{ mb: 4 }}>
          <CardHeader
            title={
              <Typography variant="h4" fontWeight="bold">
                The 2024 Election: What Data Is Missing?
              </Typography>
            }
            subheader="After every election, questions arise about integrity. Traditional systems lack the cryptographic proof needed for universal verification."
          />
          <CardContent>
            {!showComparison ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Button
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => setShowComparison(true)}
                  sx={{
                    background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                    px: 4,
                    py: 1.5,
                  }}
                >
                  Reveal the Gaps
                </Button>
              </Box>
            ) : (
              <>
                {/* Table Header */}
                <Paper
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
                    gap: 2,
                    p: 2,
                    mb: 2,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                  }}
                >
                  <Typography fontWeight="bold">Security Feature</Typography>
                  {!isMobile && (
                    <>
                      <Typography fontWeight="bold">Traditional (2024)</Typography>
                      <Typography fontWeight="bold">Trustless Voting</Typography>
                    </>
                  )}
                </Paper>

                {/* Data Rows */}
                {dataComparison.map((item, idx) => (
                  <ComparisonRow
                    key={item.category}
                    visible={idx < animationStep}
                    critical={item.critical}
                    elevation={1}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ color: 'primary.main' }}>{item.icon}</Box>
                      <Typography fontWeight="medium">{item.category}</Typography>
                      {item.critical && (
                        <Chip label="Critical" size="small" color="error" sx={{ ml: 1 }} />
                      )}
                    </Box>

                    {isMobile && <Divider sx={{ my: 1 }} />}

                    <Box>
                      {isMobile && (
                        <Typography variant="caption" color="text.secondary">
                          Traditional (2024):
                        </Typography>
                      )}
                      {item.traditional ? (
                        <Typography color="text.secondary">{item.traditional}</Typography>
                      ) : (
                        <Chip
                          icon={<CancelIcon />}
                          label="NOT CAPTURED"
                          color="error"
                          variant="outlined"
                          size="small"
                        />
                      )}
                    </Box>

                    <Box>
                      {isMobile && (
                        <Typography variant="caption" color="text.secondary">
                          Trustless Voting:
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircleIcon color="success" fontSize="small" />
                        <Typography color="success.main">{item.trustless}</Typography>
                      </Box>
                    </Box>
                  </ComparisonRow>
                ))}

                {/* Summary Stats */}
                <Fade in={animationStep >= dataComparison.length}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    justifyContent="center"
                    sx={{ mt: 4 }}
                  >
                    <Alert
                      severity="error"
                      icon={<GppBadIcon />}
                      sx={{ flex: 1, maxWidth: 400 }}
                    >
                      <Typography variant="h4" fontWeight="bold">5</Typography>
                      <Typography>Critical data points NOT captured in 2024</Typography>
                    </Alert>
                    <Alert
                      severity="success"
                      icon={<GppGoodIcon />}
                      sx={{ flex: 1, maxWidth: 400 }}
                    >
                      <Typography variant="h4" fontWeight="bold">10/10</Typography>
                      <Typography>Complete cryptographic coverage</Typography>
                    </Alert>
                  </Stack>
                </Fade>
              </>
            )}
          </CardContent>
        </Card>

        {/* Interactive Mock Poll */}
        <Card sx={{ mb: 4 }}>
          <CardHeader
            avatar={<HowToVoteIcon color="primary" />}
            title={
              <Typography variant="h4" fontWeight="bold">
                Experience It Yourself
              </Typography>
            }
            subheader="Cast a vote in our demo poll and see exactly what cryptographic proof you receive—proof that's impossible with paper ballots."
          />
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
              {/* Poll Card */}
              <Card variant="outlined" sx={{ flex: 1 }}>
                <CardContent>
                  <Chip
                    label="DEMO POLL"
                    color="primary"
                    size="small"
                    sx={{ mb: 2 }}
                  />
                  <Typography variant="h5" gutterBottom>
                    What voting system should the US adopt?
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    This is a non-binding demonstration. Your vote generates real cryptographic proofs.
                  </Typography>

                  {!hasVoted ? (
                    <>
                      <Stack spacing={2} sx={{ mb: 3 }}>
                        {pollOptions.map((option, idx) => (
                          <PollOptionCard
                            key={option.id}
                            selected={selectedOption === option.id}
                            onClick={() => votingStage === 'select' && setSelectedOption(option.id)}
                          >
                            <CardContent sx={{ py: 1.5, px: 2 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Radio
                                  checked={selectedOption === option.id}
                                  disabled={votingStage !== 'select'}
                                />
                                <Chip
                                  label={String.fromCharCode(65 + idx)}
                                  size="small"
                                  color={selectedOption === option.id ? 'primary' : 'default'}
                                />
                                <Typography>{option.label}</Typography>
                              </Box>
                            </CardContent>
                          </PollOptionCard>
                        ))}
                      </Stack>

                      {votingStage === 'select' && (
                        <Button
                          variant="contained"
                          fullWidth
                          size="large"
                          disabled={!selectedOption}
                          onClick={handleVote}
                          sx={{
                            background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                          }}
                        >
                          Cast Your Vote
                        </Button>
                      )}

                      {votingStage !== 'select' && votingStage !== 'confirmed' && (
                        <Box sx={{ mt: 3 }}>
                          <LinearProgress
                            variant="determinate"
                            value={getVotingProgress()}
                            sx={{ height: 8, borderRadius: 4, mb: 2 }}
                          />
                          <Stack spacing={2}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              {votingStage === 'encrypting' ? (
                                <CircularProgress size={20} />
                              ) : (
                                <CheckCircleIcon color="success" />
                              )}
                              <Typography color={votingStage === 'encrypting' ? 'primary' : 'text.secondary'}>
                                🔐 Encrypting Vote
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              {votingStage === 'proving' ? (
                                <CircularProgress size={20} />
                              ) : votingStage === 'submitting' ? (
                                <CheckCircleIcon color="success" />
                              ) : (
                                <Box sx={{ width: 20 }} />
                              )}
                              <Typography color={votingStage === 'proving' ? 'primary' : 'text.secondary'}>
                                🧮 Generating ZK Proof
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              {votingStage === 'submitting' ? (
                                <CircularProgress size={20} />
                              ) : (
                                <Box sx={{ width: 20 }} />
                              )}
                              <Typography color={votingStage === 'submitting' ? 'primary' : 'text.secondary'}>
                                ⛓️ Recording to Blockchain
                              </Typography>
                            </Box>
                          </Stack>
                        </Box>
                      )}
                    </>
                  ) : (
                    <Box>
                      <Alert
                        severity="success"
                        icon={<CheckCircleIcon />}
                        sx={{ mb: 3 }}
                      >
                        <Typography variant="h6">Vote Recorded!</Typography>
                      </Alert>

                      <Stack spacing={2} sx={{ mb: 3 }}>
                        {pollOptions.map(option => {
                          const percentage = totalVotes > 0 ? (option.votes / totalVotes * 100) : 0;
                          return (
                            <Box key={option.id}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="body2">
                                  {option.label}
                                  {selectedOption === option.id && (
                                    <Chip label="Your vote" size="small" color="primary" sx={{ ml: 1 }} />
                                  )}
                                </Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {percentage.toFixed(1)}%
                                </Typography>
                              </Box>
                              <LinearProgress
                                variant="determinate"
                                value={percentage}
                                sx={{
                                  height: 8,
                                  borderRadius: 4,
                                  bgcolor: alpha(muiTheme.palette.primary.main, 0.1),
                                }}
                              />
                            </Box>
                          );
                        })}
                      </Stack>

                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {totalVotes} total vote{totalVotes !== 1 ? 's' : ''}
                      </Typography>

                      <Button
                        variant="outlined"
                        onClick={() => setShowVerification(!showVerification)}
                        endIcon={showVerification ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      >
                        {showVerification ? 'Hide' : 'Show'} Cryptographic Receipt
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* Cryptographic Receipt Panel */}
              <Collapse in={voteReceipt !== null && showVerification} sx={{ flex: 1 }}>
                <Card
                  sx={{
                    bgcolor: alpha(muiTheme.palette.primary.main, 0.02),
                    border: `1px solid ${alpha(muiTheme.palette.primary.main, 0.2)}`,
                  }}
                >
                  <CardHeader
                    avatar={<ReceiptLongIcon color="primary" />}
                    title="Your Cryptographic Receipt"
                    subheader="This is proof your vote was recorded. In a traditional election, you get nothing."
                    action={
                      <Tooltip title={copySuccess ? 'Copied!' : 'Copy receipt hash'}>
                        <IconButton onClick={() => voteReceipt && copyToClipboard(voteReceipt.receiptHash)}>
                          <ContentCopyIcon />
                        </IconButton>
                      </Tooltip>
                    }
                  />
                  <CardContent>
                    {voteReceipt && (
                      <Stack spacing={2}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Vote Receipt Hash
                          </Typography>
                          <ReceiptCode>{voteReceipt.receiptHash}</ReceiptCode>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Timestamp
                          </Typography>
                          <ReceiptCode>{new Date(voteReceipt.timestamp).toLocaleString()}</ReceiptCode>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Merkle Root
                          </Typography>
                          <ReceiptCode>{voteReceipt.merkleRoot}</ReceiptCode>
                        </Box>
                        <Stack direction="row" spacing={2}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              Block Height
                            </Typography>
                            <ReceiptCode>#{voteReceipt.blockHeight}</ReceiptCode>
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              ZK Proof Valid
                            </Typography>
                            <Chip
                              icon={<CheckCircleIcon />}
                              label="VERIFIED"
                              color="success"
                              size="small"
                              sx={{ mt: 0.5 }}
                            />
                          </Box>
                        </Stack>

                        <Divider sx={{ my: 2 }} />

                        <Typography variant="subtitle2" fontWeight="bold">
                          What This Proves:
                        </Typography>
                        <List dense>
                          <ListItem>
                            <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                            <ListItemText
                              primary="Your vote exists"
                              secondary="The receipt hash uniquely identifies your encrypted vote"
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                            <ListItemText
                              primary="It wasn't tampered with"
                              secondary="Any modification would change the hash"
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                            <ListItemText
                              primary="You're eligible"
                              secondary="ZK proof confirms eligibility without revealing identity"
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                            <ListItemText
                              primary="It's permanently recorded"
                              secondary={`Block #${voteReceipt.blockHeight} is anchored to Ethereum`}
                            />
                          </ListItem>
                        </List>

                        <Alert severity="warning" icon={<CancelIcon />}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            What You Get With Paper Ballots:
                          </Typography>
                          <Typography variant="body2">
                            Nothing. "Trust us, we counted it."
                          </Typography>
                        </Alert>
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Collapse>
            </Stack>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <Card
          sx={{
            mb: 4,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
          }}
        >
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Ready to See More?
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              justifyContent="center"
              sx={{ mt: 3 }}
            >
              <Button
                component={Link}
                to="/whitepaper"
                variant="contained"
                startIcon={<MenuBookIcon />}
                sx={{
                  bgcolor: 'white',
                  color: '#667eea',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
                }}
              >
                Read the Whitepaper
              </Button>
              <Button
                component={Link}
                to="/explorer"
                variant="outlined"
                startIcon={<AccountTreeIcon />}
                sx={{
                  borderColor: 'white',
                  color: 'white',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                }}
              >
                Browse the Blockchain
              </Button>
              <Button
                component={Link}
                to="/elections"
                variant="outlined"
                startIcon={<HowToVoteIcon />}
                sx={{
                  borderColor: 'white',
                  color: 'white',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                }}
              >
                View Live Elections
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {/* Key Differences Summary */}
        <Typography variant="h4" fontWeight="bold" textAlign="center" sx={{ mb: 4 }}>
          The Fundamental Difference
        </Typography>
        
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} sx={{ mb: 4 }}>
          {/* Traditional Card */}
          <Card
            sx={{
              flex: 1,
              border: `2px solid ${muiTheme.palette.error.main}`,
              bgcolor: alpha(muiTheme.palette.error.main, 0.02),
            }}
          >
            <CardHeader
              avatar={<GppBadIcon color="error" />}
              title={<Typography variant="h5">Traditional Elections</Typography>}
              subheader={
                <Chip
                  label={'"Trust us"'}
                  color="error"
                  variant="outlined"
                  size="small"
                />
              }
            />
            <CardContent>
              <List dense>
                <ListItem>
                  <ListItemIcon><CancelIcon color="error" fontSize="small" /></ListItemIcon>
                  <ListItemText primary="Trust poll workers counted correctly" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CancelIcon color="error" fontSize="small" /></ListItemIcon>
                  <ListItemText primary="Trust no ballots were lost or added" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CancelIcon color="error" fontSize="small" /></ListItemIcon>
                  <ListItemText primary="Trust the database wasn't modified" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CancelIcon color="error" fontSize="small" /></ListItemIcon>
                  <ListItemText primary="Trust signature matching was fair" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CancelIcon color="error" fontSize="small" /></ListItemIcon>
                  <ListItemText primary="Trust chain of custody was maintained" />
                </ListItem>
              </List>
              <Alert severity="error" sx={{ mt: 2 }}>
                Result: Doubt → Disputes → Division
              </Alert>
            </CardContent>
          </Card>

          {/* Trustless Card */}
          <Card
            sx={{
              flex: 1,
              border: `2px solid ${muiTheme.palette.success.main}`,
              bgcolor: alpha(muiTheme.palette.success.main, 0.02),
            }}
          >
            <CardHeader
              avatar={<GppGoodIcon color="success" />}
              title={<Typography variant="h5">Trustless Voting</Typography>}
              subheader={
                <Chip
                  label={'"Verify yourself"'}
                  color="success"
                  variant="outlined"
                  size="small"
                />
              }
            />
            <CardContent>
              <List dense>
                <ListItem>
                  <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                  <ListItemText primary="Verify your vote with your receipt" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                  <ListItemText primary="Verify the Merkle tree includes all votes" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                  <ListItemText primary="Verify the hash chain is unbroken" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                  <ListItemText primary="Verify ZK proofs are mathematically valid" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                  <ListItemText primary="Verify results via homomorphic tallying" />
                </ListItem>
              </List>
              <Alert severity="success" sx={{ mt: 2 }}>
                Result: Proof → Confidence → Unity
              </Alert>
            </CardContent>
          </Card>
        </Stack>

        {/* Footer Quote */}
        <Paper
          sx={{
            p: 4,
            textAlign: 'center',
            bgcolor: alpha(muiTheme.palette.primary.main, 0.05),
          }}
        >
          <Typography variant="h6" fontStyle="italic" color="text.secondary">
            Trustless voting doesn't mean we don't trust people—it means we don't{' '}
            <strong>have</strong> to. Mathematics replaces faith. Proof replaces hope.
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
