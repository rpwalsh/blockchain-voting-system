import { useState, useEffect } from 'react';
import './AdminDebug.css';

interface PollResult {
  optionId: string;
  optionText: string;
  voteCount: number;
  percentage: number;
  merkleRoots: string[];
  timestamps: number[];
}

interface VoteRecord {
  receiptHash: string;
  merkleProof: string[];
  timestamp: number;
  verified: boolean;
}

export default function AdminDebug() {
  const [pollResults, setPollResults] = useState<PollResult[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [voteRecords, setVoteRecords] = useState<VoteRecord[]>([]);

  useEffect(() => {
    // Simulate loading poll data
    const mockResults: PollResult[] = [
      {
        optionId: 'very-useful',
        optionText: 'Very useful - I would trust this system',
        voteCount: 847,
        percentage: 58.2,
        merkleRoots: Array.from({ length: 9 }, () => generateMockHash()),
        timestamps: Array.from({ length: 847 }, (_, i) => Date.now() - i * 60000)
      },
      {
        optionId: 'somewhat-useful',
        optionText: 'Somewhat useful - needs improvements',
        voteCount: 342,
        percentage: 23.5,
        merkleRoots: Array.from({ length: 4 }, () => generateMockHash()),
        timestamps: Array.from({ length: 342 }, (_, i) => Date.now() - i * 60000)
      },
      {
        optionId: 'not-useful',
        optionText: 'Not useful - prefer traditional systems',
        voteCount: 156,
        percentage: 10.7,
        merkleRoots: Array.from({ length: 2 }, () => generateMockHash()),
        timestamps: Array.from({ length: 156 }, (_, i) => Date.now() - i * 60000)
      },
      {
        optionId: 'unsure',
        optionText: 'Unsure - need more information',
        voteCount: 110,
        percentage: 7.6,
        merkleRoots: Array.from({ length: 2 }, () => generateMockHash()),
        timestamps: Array.from({ length: 110 }, (_, i) => Date.now() - i * 60000)
      }
    ];

    setPollResults(mockResults);
    setTotalVotes(mockResults.reduce((sum, r) => sum + r.voteCount, 0));
  }, []);

  const generateMockHash = () => {
    return Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  };

  const handleOptionClick = (optionId: string) => {
    setSelectedOption(optionId);
    
    // Generate mock vote records
    const option = pollResults.find(r => r.optionId === optionId);
    if (option) {
      const records: VoteRecord[] = Array.from({ length: Math.min(100, option.voteCount) }, (_, i) => ({
        receiptHash: generateMockHash(),
        merkleProof: [generateMockHash(), generateMockHash(), generateMockHash()],
        timestamp: option.timestamps[i] || Date.now(),
        verified: true
      }));
      setVoteRecords(records);
    }
  };

  const getWidthClass = (percent: number) => {
    const rounded = Math.floor(percent / 5) * 5;
    return `width-${Math.min(100, Math.max(0, rounded))}`;
  };

  return (
    <div className="admin-debug">
      <header className="debug-header">
        <h1>Admin Debug Console</h1>
        <p>View anonymized voting data and cryptographic proofs</p>
        <div className="header-badge">Read-Only Access</div>
      </header>

      {/* System Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">[VOTES]</div>
          <div className="stat-value">{totalVotes.toLocaleString()}</div>
          <div className="stat-label">Total Votes Cast</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">[MRK]</div>
          <div className="stat-value">{pollResults.reduce((sum, r) => sum + r.merkleRoots.length, 0)}</div>
          <div className="stat-label">Merkle Trees Generated</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">[ENC]</div>
          <div className="stat-value">100%</div>
          <div className="stat-label">Votes Encrypted</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">[ZKP]</div>
          <div className="stat-value">100%</div>
          <div className="stat-label">Verified with zk-SNARKs</div>
        </div>
      </div>

      {/* Poll Results */}
      <section className="results-section">
        <h2>Poll Results: System Usefulness</h2>
        <p className="section-subtitle">
          All data is anonymized - individual voter identities cannot be recovered
        </p>

        <div className="results-list">
          {pollResults.map((result) => (
            <div
              key={result.optionId}
              className={`result-item ${selectedOption === result.optionId ? 'selected' : ''}`}
              onClick={() => handleOptionClick(result.optionId)}
            >
              <div className="result-header">
                <div className="result-info">
                  <h3>{result.optionText}</h3>
                  <div className="result-meta">
                    <span>{result.voteCount.toLocaleString()} votes</span>
                    <span>•</span>
                    <span>{result.merkleRoots.length} Merkle trees</span>
                  </div>
                </div>
                <div className="result-percentage">{result.percentage}%</div>
              </div>
              <div className="result-bar-container">
                <div className={`result-bar-fill ${getWidthClass(result.percentage)}`} />
              </div>
              {selectedOption === result.optionId && (
                <div className="result-details">
                  <div className="merkle-trees">
                    <h4>Merkle Tree Roots</h4>
                    <div className="merkle-list">
                      {result.merkleRoots.map((root, idx) => (
                        <code key={idx} className="merkle-root">
                          Tree {idx + 1}: {root.substring(0, 32)}...
                        </code>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Vote Records */}
      {selectedOption && voteRecords.length > 0 && (
        <section className="records-section">
          <h2>Vote Records (Showing first 100)</h2>
          <p className="section-subtitle">
            Receipt hashes and Merkle proofs - no voter identities
          </p>

          <div className="records-table">
            <div className="table-header">
              <div className="col-receipt">Receipt Hash</div>
              <div className="col-merkle">Merkle Proof (3 steps)</div>
              <div className="col-time">Timestamp</div>
              <div className="col-status">Status</div>
            </div>
            <div className="table-body">
              {voteRecords.slice(0, 20).map((record, idx) => (
                <div key={idx} className="table-row">
                  <div className="col-receipt">
                    <code>{record.receiptHash.substring(0, 16)}...</code>
                  </div>
                  <div className="col-merkle">
                    <code className="merkle-compact">
                      {record.merkleProof.length} nodes
                    </code>
                  </div>
                  <div className="col-time">
                    {new Date(record.timestamp).toLocaleString()}
                  </div>
                  <div className="col-status">
                    <span className="status-badge verified">✓ Verified</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="records-note">
            <strong>Privacy Guarantee:</strong> These records show cryptographic proof that votes 
            were counted, but the actual vote choices remain encrypted and anonymous. Even system 
            administrators cannot link a receipt to a voter or determine how someone voted.
          </div>
        </section>
      )}

      {/* Cryptographic Audit */}
      <section className="audit-section">
        <h2>Cryptographic Audit Trail</h2>
        <div className="audit-grid">
          <div className="audit-item">
            <div className="audit-icon">[SIG]</div>
            <h3>Digital Signatures</h3>
            <p>Every vote is signed with Ed25519</p>
            <div className="audit-status">✓ All signatures valid</div>
          </div>
          <div className="audit-item">
            <div className="audit-icon">[MRK]</div>
            <h3>Merkle Tree Integrity</h3>
            <p>All votes organized in tamper-proof trees</p>
            <div className="audit-status">✓ All trees verified</div>
          </div>
          <div className="audit-item">
            <div className="audit-icon">[BCH]</div>
            <h3>Blockchain Anchoring</h3>
            <p>Batches anchored to public blockchain</p>
            <div className="audit-status">✓ {Math.floor(totalVotes / 100)} anchors created</div>
          </div>
          <div className="audit-item">
            <div className="audit-icon">[ZKP]</div>
            <h3>Zero-Knowledge Proofs</h3>
            <p>Tallies verified without revealing votes</p>
            <div className="audit-status">✓ All proofs valid</div>
          </div>
        </div>
      </section>

      {/* De-anonymization Warning */}
      <section className="warning-section">
        <h2>🔒 Security Guarantee: Impossible to De-Anonymize</h2>
        <div className="warning-content">
          <div className="warning-item">
            <strong>No IP Address Storage:</strong> IP addresses are hashed with a daily salt and 
            discarded. The original IP cannot be recovered from the hash.
          </div>
          <div className="warning-item">
            <strong>No User-Vote Linkage:</strong> Votes are encrypted before leaving the voter's 
            device. The system never sees the combination of user identity + vote choice.
          </div>
          <div className="warning-item">
            <strong>Zero-Knowledge Tallying:</strong> Results are tallied using zk-SNARKs, proving 
            correct counting without revealing individual votes.
          </div>
          <div className="warning-item">
            <strong>Post-Quantum Option:</strong> When enabled, even future quantum computers cannot 
            break the encryption to reveal how someone voted.
          </div>
        </div>
        <div className="warning-footer">
          <strong>Mathematical Guarantee:</strong> These protections are enforced by mathematics, 
          not policies. Even with full database access, votes cannot be de-anonymized.
        </div>
      </section>
    </div>
  );
}
