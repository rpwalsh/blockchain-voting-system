import { useState, useEffect } from 'react';
import './Election2024Player.css';

interface CountyResult {
  county: string;
  state: string;
  candidateA: number;
  candidateB: number;
  timestamp: number;
  merkleRoot: string;
  verified: boolean;
}

// Simulated 2024 election data (simplified for demonstration)
const generateCountyData = (): CountyResult[] => {
  const states = ['Pennsylvania', 'Michigan', 'Wisconsin', 'Arizona', 'Georgia', 'Nevada', 'North Carolina'];
  const counties: CountyResult[] = [];
  
  states.forEach(state => {
    const countyCount = Math.floor(Math.random() * 15) + 10;
    for (let i = 0; i < countyCount; i++) {
      const total = Math.floor(Math.random() * 100000) + 50000;
      const split = 0.48 + Math.random() * 0.04; // Close race
      counties.push({
        county: `${state} County ${i + 1}`,
        state,
        candidateA: Math.floor(total * split),
        candidateB: Math.floor(total * (1 - split)),
        timestamp: Date.now() + i * 1000,
        merkleRoot: generateMockHash(),
        verified: true
      });
    }
  });
  
  return counties.sort(() => Math.random() - 0.5); // Randomize reporting order
};

const generateMockHash = () => {
  return Array.from({ length: 64 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
};

export default function Election2024Player() {
  const [counties, setCounties] = useState<CountyResult[]>([]);
  const [reportedCounties, setReportedCounties] = useState<CountyResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [totals, setTotals] = useState({ candidateA: 0, candidateB: 0 });
  const [stateResults, setStateResults] = useState<Record<string, { a: number; b: number }>>({});

  useEffect(() => {
    const data = generateCountyData();
    setCounties(data);
  }, []);

  useEffect(() => {
    if (!isPlaying || currentIndex >= counties.length) {
      if (currentIndex >= counties.length) {
        setIsPlaying(false);
      }
      return;
    }

    const timer = setTimeout(() => {
      const newCounty = counties[currentIndex];
      setReportedCounties(prev => [...prev, newCounty]);
      
      // Update totals
      setTotals(prev => ({
        candidateA: prev.candidateA + newCounty.candidateA,
        candidateB: prev.candidateB + newCounty.candidateB
      }));

      // Update state results
      setStateResults(prev => {
        const state = newCounty.state;
        const current = prev[state] || { a: 0, b: 0 };
        return {
          ...prev,
          [state]: {
            a: current.a + newCounty.candidateA,
            b: current.b + newCounty.candidateB
          }
        };
      });

      setCurrentIndex(prev => prev + 1);
    }, 1000 / speed);

    return () => clearTimeout(timer);
  }, [isPlaying, currentIndex, counties, speed]);

  const reset = () => {
    setReportedCounties([]);
    setCurrentIndex(0);
    setTotals({ candidateA: 0, candidateB: 0 });
    setStateResults({});
    setIsPlaying(false);
  };

  const getWidthClass = (percent: number) => {
    const rounded = Math.floor(percent / 5) * 5; // Round to nearest 5
    return `width-${Math.min(100, Math.max(0, rounded))}`;
  };

  const candidateAPercentage = totals.candidateA + totals.candidateB > 0
    ? (totals.candidateA / (totals.candidateA + totals.candidateB) * 100).toFixed(2)
    : '0.00';
  
  const candidateBPercentage = totals.candidateA + totals.candidateB > 0
    ? (totals.candidateB / (totals.candidateA + totals.candidateB) * 100).toFixed(2)
    : '0.00';

  return (
    <div className="election-2024-player">
      <header className="player-header">
        <h1>2024 Election: Cryptographically Verified Tallying</h1>
        <p className="disclaimer">
          This demonstration shows how our system would have provided real-time, cryptographic proof 
          of vote tallying. This is not claiming any issues occurred - it's demonstrating how 
          <strong> mathematical proof </strong> would have replaced trust.
        </p>
      </header>

      {/* Control Panel */}
      <div className="controls">
        <button 
          className={`control-btn ${isPlaying ? 'pause' : 'play'}`}
          onClick={() => setIsPlaying(!isPlaying)}
          disabled={currentIndex >= counties.length}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <button className="control-btn" onClick={reset}>
          ↺ Reset
        </button>
        <div className="speed-control">
          <label>Speed:</label>
          <button onClick={() => setSpeed(Math.max(0.5, speed - 0.5))}>-</button>
          <span>{speed}x</span>
          <button onClick={() => setSpeed(Math.min(10, speed + 0.5))}>+</button>
        </div>
        <div className="progress">
          <span>{currentIndex} / {counties.length} counties reported</span>
          <div className="progress-bar">
            <div className={`progress-fill ${getWidthClass((currentIndex / counties.length) * 100)}`} />
          </div>
        </div>
      </div>

      {/* Results Dashboard */}
      <div className="results-dashboard">
        <div className="national-totals">
          <h2>National Totals</h2>
          <div className="candidates">
            <div className="candidate candidate-a">
              <div className="candidate-header">
                <span className="name">Candidate A</span>
                <span className="percentage">{candidateAPercentage}%</span>
              </div>
              <div className="vote-bar">
                <div className={`vote-fill fill-a ${getWidthClass(parseFloat(candidateAPercentage))}`} />
              </div>
              <div className="votes">{totals.candidateA.toLocaleString()} votes</div>
              <div className="crypto-badge">
                [MRK] Verified in Merkle Tree
              </div>
            </div>

            <div className="candidate candidate-b">
              <div className="candidate-header">
                <span className="name">Candidate B</span>
                <span className="percentage">{candidateBPercentage}%</span>
              </div>
              <div className="vote-bar">
                <div className={`vote-fill fill-b ${getWidthClass(parseFloat(candidateBPercentage))}`} />
              </div>
              <div className="votes">{totals.candidateB.toLocaleString()} votes</div>
              <div className="crypto-badge">
                [ZKP] Zero-knowledge verified
              </div>
            </div>
          </div>
        </div>

        {/* State Breakdown */}
        <div className="state-breakdown">
          <h2>Swing State Results</h2>
          <div className="states">
            {Object.entries(stateResults).map(([state, votes]) => {
              const total = votes.a + votes.b;
              const aPercent = total > 0 ? (votes.a / total * 100).toFixed(1) : '0.0';
              const bPercent = total > 0 ? (votes.b / total * 100).toFixed(1) : '0.0';
              const winner = votes.a > votes.b ? 'A' : 'B';
              
              return (
                <div key={state} className={`state-card winner-${winner.toLowerCase()}`}>
                  <div className="state-name">{state}</div>
                  <div className="state-votes">
                    <div className="state-candidate">
                      <span>A: {aPercent}%</span>
                      <small>{votes.a.toLocaleString()}</small>
                    </div>
                    <div className="state-candidate">
                      <span>B: {bPercent}%</span>
                      <small>{votes.b.toLocaleString()}</small>
                    </div>
                  </div>
                  <div className="state-status">[ENC] Encrypted</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* County Feed */}
      <div className="county-feed">
        <h2>Live County Reports</h2>
        <div className="feed-container">
          {[...reportedCounties].reverse().slice(0, 10).map((county, idx) => (
            <div key={idx} className="county-report">
              <div className="county-info">
                <div className="county-name">{county.county}</div>
                <div className="county-state">{county.state}</div>
              </div>
              <div className="county-votes">
                <div className="vote-count">
                  <span className="label">Candidate A:</span>
                  <span className="value">{county.candidateA.toLocaleString()}</span>
                </div>
                <div className="vote-count">
                  <span className="label">Candidate B:</span>
                  <span className="value">{county.candidateB.toLocaleString()}</span>
                </div>
              </div>
              <div className="county-crypto">
                <div className="merkle-root" title={county.merkleRoot}>
                  [MRK] {county.merkleRoot.substring(0, 16)}...
                </div>
                <div className="verification-badge">
                  {county.verified ? '✓ Verified' : '⧗ Pending'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cryptographic Proof Section */}
      <div className="crypto-proof-section">
        <h2>How This Provides Mathematical Proof</h2>
        <div className="proof-features">
          <div className="proof-feature">
            <div className="proof-icon">[SIG]</div>
            <h3>Digital Signatures</h3>
            <p>Every county report is signed by election officials using Ed25519. Forgery is mathematically impossible.</p>
          </div>
          <div className="proof-feature">
            <div className="proof-icon">[MRK]</div>
            <h3>Merkle Trees</h3>
            <p>Votes are organized in cryptographic trees. Any tampering changes the root hash, making detection instant.</p>
          </div>
          <div className="proof-feature">
            <div className="proof-icon">[BCH]</div>
            <h3>Blockchain Anchoring</h3>
            <p>Results are anchored to public blockchains every 100 votes, creating an immutable timestamp.</p>
          </div>
          <div className="proof-feature">
            <div className="proof-icon">[ZKP]</div>
            <h3>Zero-Knowledge Proofs</h3>
            <p>Voters can prove their vote was counted without revealing their choice using zk-SNARKs.</p>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="cta-section">
        <h2>This is the future of elections</h2>
        <p>
          No more trust. No more controversy. Just mathematical certainty.
        </p>
        <div className="cta-buttons">
          <button className="cta-primary" onClick={() => window.location.href = '/poll-demo'}>
            Try it yourself: Cast a verifiable vote
          </button>
          <button className="cta-secondary" onClick={() => window.location.href = '/crypto-demo'}>
            Deep dive: See the cryptography
          </button>
        </div>
      </div>
    </div>
  );
}
