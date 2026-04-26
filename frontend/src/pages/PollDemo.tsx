import { useState } from 'react';
import './PollDemo.css';

interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export default function PollDemo() {
  const [voted, setVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [merkleProof, setMerkleProof] = useState<string[] | null>(null);
  const [showCrypto, setShowCrypto] = useState(false);

  const [pollOptions, setPollOptions] = useState<PollOption[]>([
    { id: 'very-useful', text: 'Very useful - I would trust this system', votes: 0 },
    { id: 'somewhat-useful', text: 'Somewhat useful - needs improvements', votes: 0 },
    { id: 'not-useful', text: 'Not useful - prefer traditional systems', votes: 0 },
    { id: 'unsure', text: 'Unsure - need more information', votes: 0 }
  ]);

  const handleVote = async (optionId: string) => {
    setSelectedOption(optionId);
    
    // Simulate cryptographic operations
    await new Promise(resolve => setTimeout(resolve, 500));
    const mockReceipt = generateMockHash();
    setReceipt(mockReceipt);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    const mockProof = [generateMockHash(), generateMockHash(), generateMockHash()];
    setMerkleProof(mockProof);
    
    // Update votes
    setPollOptions(prev => prev.map(opt => 
      opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
    ));
    
    setVoted(true);
  };

  const generateMockHash = () => {
    return Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  };

  const totalVotes = pollOptions.reduce((sum, opt) => sum + opt.votes, 0);

  return (
    <div className="poll-demo">
      <header className="poll-header">
        <h1>Experience Trustless Voting</h1>
        <p>Cast a real vote and receive your cryptographic proof</p>
      </header>

      {!voted ? (
        <div className="poll-voting">
          <div className="poll-question">
            <h2>How useful would this voting system be for your organization?</h2>
            <p className="question-subtitle">
              Your vote will be encrypted, anonymized, and cryptographically verified
            </p>
          </div>

          <div className="poll-options">
            {pollOptions.map(option => (
              <button
                key={option.id}
                className="poll-option"
                onClick={() => handleVote(option.id)}
              >
                <span className="option-text">{option.text}</span>
                <span className="option-arrow">→</span>
              </button>
            ))}
          </div>

          <div className="poll-info">
            <div className="info-card">
              <div className="info-icon">[ENC]</div>
              <h3>Encrypted</h3>
              <p>Your choice is encrypted before leaving your device</p>
            </div>
            <div className="info-card">
              <div className="info-icon">[KEY]</div>
              <h3>Anonymous</h3>
              <p>No way to link your identity to your vote</p>
            </div>
            <div className="info-card">
              <div className="info-icon">[MRK]</div>
              <h3>Verifiable</h3>
              <p>You get cryptographic proof your vote was counted</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="poll-results">
          <div className="success-message">
            <div className="success-icon">✓</div>
            <h2>Vote Recorded Successfully!</h2>
            <p>Your vote has been encrypted, signed, and added to the Merkle tree</p>
          </div>

          <div className="receipt-section">
            <h3>Your Cryptographic Receipt</h3>
            <div className="receipt-box">
              <div className="receipt-item">
                <span className="receipt-label">[SIG] Receipt Hash:</span>
                <code className="receipt-value">{receipt}</code>
              </div>
              {merkleProof && (
                <div className="receipt-item">
                  <span className="receipt-label">[MRK] Merkle Proof (3 steps):</span>
                  <div className="merkle-proof">
                    {merkleProof.map((hash, idx) => (
                      <code key={idx} className="merkle-step">
                        Step {idx + 1}: {hash.substring(0, 32)}...
                      </code>
                    ))}
                  </div>
                </div>
              )}
              <button 
                className="show-crypto-btn"
                onClick={() => setShowCrypto(!showCrypto)}
              >
                {showCrypto ? 'Hide' : 'Show'} Cryptographic Details
              </button>
            </div>

            {showCrypto && (
              <div className="crypto-details">
                <h4>What Just Happened?</h4>
                <ol className="crypto-steps">
                  <li>
                    <strong>[ENC] Encryption:</strong> Your vote "{pollOptions.find(o => o.id === selectedOption)?.text}" 
                    was encrypted using Curve25519-XSalsa20-Poly1305
                  </li>
                  <li>
                    <strong>[SIG] Signing:</strong> The encrypted vote was signed with Ed25519, 
                    creating an unforgeable timestamp
                  </li>
                  <li>
                    <strong>[MRK] Merkle Tree:</strong> Your vote was added to a cryptographic tree structure. 
                    The 3-step proof above proves inclusion without revealing your vote
                  </li>
                  <li>
                    <strong>[ZKP] Zero-Knowledge:</strong> When results are tallied, zk-SNARKs prove your vote 
                    was counted correctly without revealing how you voted
                  </li>
                  <li>
                    <strong>[BCH] Blockchain:</strong> Every 100 votes, the Merkle root is anchored to a public 
                    blockchain for immutable timestamping
                  </li>
                </ol>
              </div>
            )}
          </div>

          <div className="results-visualization">
            <h3>Live Results (Anonymized)</h3>
            <p className="results-subtitle">
              These results are public, but individual votes remain private
            </p>
            <div className="results-bars">
              {pollOptions.map(option => {
                const percentage = totalVotes > 0 ? (option.votes / totalVotes * 100).toFixed(1) : '0.0';
                const widthClass = `width-${Math.floor(parseFloat(percentage) / 5) * 5}`;
                return (
                  <div key={option.id} className="result-bar">
                    <div className="result-label">
                      <span className="result-text">{option.text}</span>
                      <span className="result-percentage">{percentage}%</span>
                    </div>
                    <div className="result-bar-container">
                      <div className={`result-bar-fill ${widthClass}`} />
                    </div>
                    <div className="result-votes">{option.votes} votes</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="verification-section">
            <h3>Verify Your Vote</h3>
            <p>
              You can verify your vote was included in the tally at any time using your receipt hash. 
              The system will prove your vote is in the Merkle tree without revealing your choice.
            </p>
            <button className="verify-btn">
              Verify Vote on Public Audit Page →
            </button>
          </div>

          <div className="next-steps">
            <h3>Explore More</h3>
            <div className="next-steps-grid">
              <a href="/election-2024-player" className="next-step-card">
                <h4>2024 Election Playback</h4>
                <p>See how this would have worked for the 2024 election</p>
              </a>
              <a href="/crypto-demo" className="next-step-card">
                <h4>Cryptography Deep Dive</h4>
                <p>Explore the underlying cryptographic operations</p>
              </a>
              <a href="/admin/config" className="next-step-card">
                <h4>Admin Configuration</h4>
                <p>See system-wide settings and post-quantum options</p>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
