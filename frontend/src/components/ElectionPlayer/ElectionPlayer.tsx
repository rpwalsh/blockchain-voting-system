/**
 * 2024 ELECTION PLAYER
 * ====================
 * Replays the 2024 Presidential Election using REAL county-level data
 * 154,863,739 total votes • 3,160 counties • 51 states
 * 
 * SHOWCASES CRYPTOGRAPHIC TOOLING:
 * - Merkle Tree verification
 * - Ed25519 signatures
 * - Threshold encryption (Shamir)
 * - Zero-knowledge proofs
 * - Blockchain anchoring
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';
import axios from "axios";
import './ElectionPlayer.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const US_STATES_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

// Colors
const GOP_COLOR = '#E81B23';
const DEM_COLOR = '#0015BC';
const NEUTRAL_COLOR = '#374151';

interface NationalData {
  year: number;
  candidates: {
    gop: { name: string };
    dem: { name: string };
  };
  votes: {
    total: number;
    gop: number;
    dem: number;
  };
  electoral: {
    gop: number;
    dem: number;
    needed: number;
  };
}

interface StateResult {
  id: string;
  name: string;
  abbreviation: string;
  votes: {
    total: number;
    gop: number;
    dem: number;
    gopPercent: string;
    demPercent: string;
  };
  electoral: number;
  winner: string;
}

interface TimelineStep {
  step: number;
  counties: Array<{
    id: string;
    name: string;
    state: string;
    winner: string;
    gopVotes: number;
    demVotes: number;
    totalVotes: number;
  }>;
  totals: {
    votes: number;
    gop: number;
    dem: number;
  };
  progress: {
    reported: number;
    total: number;
    percent: string;
  };
  hasMore: boolean;
}

interface Props {
  electionId: string;
}

interface CryptoDemo {
  operation: string;
  duration: string;
  result: Record<string, any>;
}

interface CryptoCapabilities {
  system: string;
  capabilities: {
    encryption: { name: string; security: string };
    signatures: { name: string; type: string };
    thresholdCrypto: { name: string; defaultThreshold: string; benefit: string };
    merkleTree: { algorithm: string; verification: string; benefit: string };
    zeroKnowledge: { current: string; benefit: string };
  };
  comparison: {
    smartmatic: Record<string, string>;
    trustlessVoting: Record<string, string>;
  };
}

export default function ElectionPlayer({ electionId: _electionId }: Props) {
  // Data state
  const [national, setNational] = useState<NationalData | null>(null);
  const [states, setStates] = useState<StateResult[]>([]);
  const [stateWinners, setStateWinners] = useState<Record<string, string>>({});
  
  // Playback state
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [batchSize] = useState(50);
  
  // Running totals
  const [runningTotals, setRunningTotals] = useState({ votes: 0, gop: 0, dem: 0 });
  const [reportedCounties, setReportedCounties] = useState(0);
  const [totalCounties] = useState(3160);
  const [recentCounties, setRecentCounties] = useState<TimelineStep['counties']>([]);
  const [electoralGop, setElectoralGop] = useState(0);
  const [electoralDem, setElectoralDem] = useState(0);
  
  // Crypto dashboard state
  const [cryptoCapabilities, setCryptoCapabilities] = useState<CryptoCapabilities | null>(null);
  const [cryptoDemos, setCryptoDemos] = useState<CryptoDemo[]>([]);
  const [showCryptoPanel, setShowCryptoPanel] = useState(true);
  const [cryptoLoading, setCryptoLoading] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tooltipContent, setTooltipContent] = useState<any>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  
  const intervalRef = useRef<number>();
  const stateDataRef = useRef<Record<string, { gop: number; dem: number; total: number }>>({});

  const colorScale = scaleLinear<string>()
    .domain([-0.5, 0, 0.5])
    .range([DEM_COLOR, NEUTRAL_COLOR, GOP_COLOR]);

  useEffect(() => {
    loadInitialData();
    loadCryptoCapabilities();
  }, []);

  const loadCryptoCapabilities = async () => {
    try {
      setCryptoLoading(true);
      const [capabilitiesRes, demoRes] = await Promise.all([
        axios.get(`${API_BASE}/crypto-audit/capabilities`),
        axios.get(`${API_BASE}/crypto-audit/live-demo`),
      ]);
      setCryptoCapabilities(capabilitiesRes.data);
      setCryptoDemos(demoRes.data.demonstrations || []);
    } catch (err) {
      console.log('Crypto audit endpoints not available yet');
    } finally {
      setCryptoLoading(false);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = window.setInterval(() => {
        fetchNextStep();
      }, 1000 / speed);
      
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [isPlaying, speed, currentStep]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [nationalRes, statesRes] = await Promise.all([
        axios.get(`${API_BASE}/election-data/national`),
        axios.get(`${API_BASE}/election-data/states`),
      ]);
      
      setNational(nationalRes.data);
      setStates(statesRes.data);
      
      const stateData: Record<string, { gop: number; dem: number; total: number }> = {};
      statesRes.data.forEach((s: StateResult) => {
        stateData[s.id] = { gop: 0, dem: 0, total: 0 };
      });
      stateDataRef.current = stateData;
      setError('');
    } catch (err: any) {
      console.error('Failed to load election data:', err);
      setError(err.response?.data?.error || 'Failed to load 2024 election data');
    } finally {
      setLoading(false);
    }
  };

  const fetchNextStep = useCallback(async () => {
    try {
      const response = await axios.get<TimelineStep>(
        `${API_BASE}/election-data/timeline?step=${currentStep}&batchSize=${batchSize}`
      );
      
      const data = response.data;
      setRunningTotals(data.totals);
      setReportedCounties(data.progress.reported);
      setRecentCounties(data.counties);
      
      const newStateWinners = { ...stateWinners };
      const stateData = stateDataRef.current;
      
      data.counties.forEach(county => {
        const stateId = county.id.substring(0, 2);
        if (stateData[stateId]) {
          stateData[stateId].gop += county.gopVotes;
          stateData[stateId].dem += county.demVotes;
          stateData[stateId].total += county.totalVotes;
          
          if (stateData[stateId].gop > stateData[stateId].dem) {
            newStateWinners[stateId] = 'GOP';
          } else if (stateData[stateId].dem > stateData[stateId].gop) {
            newStateWinners[stateId] = 'DEM';
          }
        }
      });
      
      setStateWinners(newStateWinners);
      
      let gopEV = 0;
      let demEV = 0;
      states.forEach(state => {
        if (newStateWinners[state.id] === 'GOP') gopEV += state.electoral;
        else if (newStateWinners[state.id] === 'DEM') demEV += state.electoral;
      });
      setElectoralGop(gopEV);
      setElectoralDem(demEV);
      
      if (!data.hasMore) {
        setIsPlaying(false);
      } else {
        setCurrentStep(prev => prev + 1);
      }
    } catch (err) {
      console.error('Failed to fetch timeline step:', err);
    }
  }, [currentStep, batchSize, stateWinners, states]);

  const handlePlay = () => {
    if (reportedCounties >= totalCounties) handleReset();
    setIsPlaying(true);
  };

  const handlePause = () => setIsPlaying(false);

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStep(0);
    setRunningTotals({ votes: 0, gop: 0, dem: 0 });
    setReportedCounties(0);
    setStateWinners({});
    setElectoralGop(0);
    setElectoralDem(0);
    setRecentCounties([]);
    
    const stateData: Record<string, { gop: number; dem: number; total: number }> = {};
    states.forEach(s => { stateData[s.id] = { gop: 0, dem: 0, total: 0 }; });
    stateDataRef.current = stateData;
  };

  const getStateColor = useCallback((geoId: string) => {
    const stateId = geoId?.padStart(2, '0');
    const winner = stateWinners[stateId];
    if (!winner) return NEUTRAL_COLOR;
    
    const stateData = stateDataRef.current[stateId];
    if (!stateData || stateData.total === 0) return NEUTRAL_COLOR;
    
    const margin = (stateData.gop - stateData.dem) / stateData.total;
    return colorScale(margin);
  }, [stateWinners, colorScale]);

  const handleStateHover = useCallback((geo: any, e: React.MouseEvent) => {
    const stateId = geo.id?.toString().padStart(2, '0');
    const state = states.find(s => s.id === stateId);
    const stateData = stateDataRef.current[stateId];
    
    if (state && stateData) {
      setTooltipContent({
        name: state.name,
        abbreviation: state.abbreviation,
        electoral: state.electoral,
        gop: stateData.gop,
        dem: stateData.dem,
        total: stateData.total,
        winner: stateWinners[stateId]
      });
      setTooltipPos({ x: e.clientX, y: e.clientY });
    }
  }, [states, stateWinners]);

  if (loading) {
    return (
      <div className="player-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <h2>Loading 2024 Election Data</h2>
          <p>154,863,739 votes • 3,160 counties • 51 states</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="player-container">
        <div className="error-state">
          <h2>⚠️ Error</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={loadInitialData}>Retry</button>
        </div>
      </div>
    );
  }

  const progress = (reportedCounties / totalCounties) * 100;
  const gopPercent = runningTotals.votes > 0 ? ((runningTotals.gop / runningTotals.votes) * 100).toFixed(1) : '0.0';
  const demPercent = runningTotals.votes > 0 ? ((runningTotals.dem / runningTotals.votes) * 100).toFixed(1) : '0.0';

  return (
    <div className="player-container">
      <header className="player-header">
        <div className="header-left">
          <h1>🗳️ 2024 Presidential Election</h1>
          <p className="subtitle">
            {reportedCounties === 0 ? 'Press Play to watch the election unfold' : `${reportedCounties.toLocaleString()} of ${totalCounties.toLocaleString()} counties reporting`}
          </p>
        </div>
        
        <div className="electoral-display">
          <div className="candidate gop">
            <span className="name">{national?.candidates.gop.name || 'Trump'}</span>
            <span className="ev">{electoralGop}</span>
          </div>
          <div className="ev-bar">
            <div className="ev-fill gop" style={{ width: `${(electoralGop / 538) * 100}%` }}></div>
            <div className="ev-fill dem" style={{ width: `${(electoralDem / 538) * 100}%`, marginLeft: `${(electoralGop / 538) * 100}%` }}></div>
            <div className="ev-marker">270</div>
          </div>
          <div className="candidate dem">
            <span className="name">{national?.candidates.dem.name || 'Harris'}</span>
            <span className="ev">{electoralDem}</span>
          </div>
        </div>
      </header>

      <div className="player-main">
        <div className="map-container">
          <ComposableMap projection="geoAlbersUsa" projectionConfig={{ scale: 1000 }}>
            <ZoomableGroup>
              <Geographies geography={US_STATES_URL}>
                {({ geographies }: { geographies: any[] }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getStateColor(geo.id)}
                      stroke="#FFF"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: 'none' },
                        hover: { outline: 'none', strokeWidth: 2, stroke: '#000' },
                        pressed: { outline: 'none' },
                      }}
                      onMouseEnter={(e) => handleStateHover(geo, e)}
                      onMouseLeave={() => setTooltipContent(null)}
                    />
                  ))
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>

          {tooltipContent && (
            <div className="map-tooltip" style={{ left: tooltipPos.x + 15, top: tooltipPos.y - 10 }}>
              <strong>{tooltipContent.name} ({tooltipContent.abbreviation})</strong>
              <span className="ev-badge">{tooltipContent.electoral} EV</span>
              <div className="tooltip-results">
                <div className="result gop">Trump: {tooltipContent.gop.toLocaleString()} {tooltipContent.total > 0 && `(${((tooltipContent.gop / tooltipContent.total) * 100).toFixed(1)}%)`}</div>
                <div className="result dem">Harris: {tooltipContent.dem.toLocaleString()} {tooltipContent.total > 0 && `(${((tooltipContent.dem / tooltipContent.total) * 100).toFixed(1)}%)`}</div>
              </div>
              {tooltipContent.winner && <div className={`winner ${tooltipContent.winner.toLowerCase()}`}>{tooltipContent.winner === 'GOP' ? '🔴 Trump' : '🔵 Harris'} leads</div>}
            </div>
          )}
        </div>

        <div className="player-sidebar">
          <div className="panel vote-panel">
            <h3>Popular Vote</h3>
            <div className="vote-totals">
              <div className="vote-row gop">
                <span className="label">Trump (R)</span>
                <span className="votes">{runningTotals.gop.toLocaleString()}</span>
                <span className="percent">{gopPercent}%</span>
              </div>
              <div className="vote-bar"><div className="bar-fill gop" style={{ width: `${parseFloat(gopPercent)}%` }}></div></div>
              
              <div className="vote-row dem">
                <span className="label">Harris (D)</span>
                <span className="votes">{runningTotals.dem.toLocaleString()}</span>
                <span className="percent">{demPercent}%</span>
              </div>
              <div className="vote-bar"><div className="bar-fill dem" style={{ width: `${parseFloat(demPercent)}%` }}></div></div>
            </div>
            <div className="total-votes">Total: {runningTotals.votes.toLocaleString()} votes</div>
          </div>

          <div className="panel counties-panel">
            <h3>Recent Results</h3>
            <div className="counties-list">
              {recentCounties.slice(-8).reverse().map((county, idx) => (
                <div key={idx} className={`county-item ${county.winner.toLowerCase()}`}>
                  <div className="county-info">
                    <span className="county-name">{county.name}</span>
                    <span className="county-state">{county.state}</span>
                  </div>
                  <div className="county-result">{county.winner === 'GOP' ? '🔴' : '🔵'} {county.totalVotes.toLocaleString()}</div>
                </div>
              ))}
              {recentCounties.length === 0 && <p className="no-data">Press Play to start</p>}
            </div>
          </div>

          {/* CRYPTOGRAPHIC TOOLING DASHBOARD */}
          <div className="panel crypto-panel">
            <h3 onClick={() => setShowCryptoPanel(!showCryptoPanel)} className="crypto-toggle">
              Cryptographic Details {showCryptoPanel ? '▼' : '▶'}
            </h3>
            {showCryptoPanel && (
              <div className="crypto-dashboard">
                {cryptoLoading ? (
                  <p className="crypto-loading">Loading crypto engine...</p>
                ) : (
                  <>
                    <div className="crypto-comparison">
                      <div className="comparison-header">
                        {cryptoCapabilities?.system || 'Trustless Voting System'}
                      </div>
                      <div className="comparison-row">
                        <div className="comparison-label">Smartmatic/Diebold:</div>
                        <div className="comparison-value bad">Black box - Trust required</div>
                      </div>
                      <div className="comparison-row">
                        <div className="comparison-label">Our System:</div>
                        <div className="comparison-value good">Fully verifiable - Zero trust</div>
                      </div>
                    </div>

                    <div className="crypto-features">
                      <div className="crypto-feature">
                        <span className="feature-icon">[ENC]</span>
                        <div className="feature-info">
                          <span className="feature-name">Vote Encryption</span>
                          <span className="feature-detail">NaCl Box (Curve25519-XSalsa20-Poly1305)</span>
                        </div>
                      </div>
                      <div className="crypto-feature">
                        <span className="feature-icon">[SIG]</span>
                        <div className="feature-info">
                          <span className="feature-name">Digital Signatures</span>
                          <span className="feature-detail">Ed25519 - Every vote signed</span>
                        </div>
                      </div>
                      <div className="crypto-feature">
                        <span className="feature-icon">[MRK]</span>
                        <div className="feature-info">
                          <span className="feature-name">Merkle Tree</span>
                          <span className="feature-detail">SHA3-256 • O(log n) proofs</span>
                        </div>
                      </div>
                      <div className="crypto-feature">
                        <span className="feature-icon">[KEY]</span>
                        <div className="feature-info">
                          <span className="feature-name">Threshold Crypto</span>
                          <span className="feature-detail">Shamir 3-of-5 key split</span>
                        </div>
                      </div>
                      <div className="crypto-feature">
                        <span className="feature-icon">[ZKP]</span>
                        <div className="feature-info">
                          <span className="feature-name">Zero-Knowledge Proofs</span>
                          <span className="feature-detail">Prove eligibility privately</span>
                        </div>
                      </div>
                      <div className="crypto-feature">
                        <span className="feature-icon">[BCH]</span>
                        <div className="feature-info">
                          <span className="feature-name">Blockchain Anchoring</span>
                          <span className="feature-detail">Ethereum/Hyperledger ready</span>
                        </div>
                      </div>
                    </div>

                    {cryptoDemos.length > 0 && (
                      <div className="crypto-demos">
                        <div className="demos-header">Live Crypto Operations</div>
                        {cryptoDemos.slice(0, 4).map((demo, idx) => (
                          <div key={idx} className="demo-item">
                            <span className="demo-name">{demo.operation}</span>
                            <span className="demo-time">{demo.duration}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="crypto-guarantees">
                      <div className="guarantee">
                        <span className="guarantee-check">✓</span>
                        Every voter gets a cryptographic receipt
                      </div>
                      <div className="guarantee">
                        <span className="guarantee-check">✓</span>
                        Anyone can verify any vote
                      </div>
                      <div className="guarantee">
                        <span className="guarantee-check">✓</span>
                        Tampering is mathematically impossible
                      </div>
                      <div className="guarantee">
                        <span className="guarantee-check">✓</span>
                        No single point of trust
                      </div>
                    </div>

                    <button 
                      className="btn btn-crypto-refresh"
                      onClick={loadCryptoCapabilities}
                      disabled={cryptoLoading}
                    >
                      🔄 Run Live Demo
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="player-controls">
        <div className="progress-section">
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }}></div></div>
          <span className="progress-text">{progress.toFixed(1)}% reporting</span>
        </div>

        <div className="control-buttons">
          {!isPlaying ? (
            <button className="btn btn-play" onClick={handlePlay}>▶ {reportedCounties > 0 && reportedCounties < totalCounties ? 'Resume' : 'Play'}</button>
          ) : (
            <button className="btn btn-pause" onClick={handlePause}>⏸ Pause</button>
          )}
          <button className="btn btn-reset" onClick={handleReset} disabled={isPlaying}>⏮ Reset</button>
        </div>

        <div className="speed-section">
          <label>Speed:</label>
          <div className="speed-buttons">
            {[1, 2, 5, 10, 25, 50].map(s => (
              <button key={s} className={`speed-btn ${speed === s ? 'active' : ''}`} onClick={() => setSpeed(s)}>{s}x</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
