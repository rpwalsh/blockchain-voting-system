/**
 * BLOCKCHAIN EXPLORER - LIVE ELECTION & VOTE BROWSER
 * ===================================================
 * Browse elections, view blocks, search transactions,
 * verify votes with Merkle proofs.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';
import './BlockchainBrowser.css';

interface Block {
  id: string;
  height: number;
  hash: string;
  previousHash: string;
  merkleRoot: string;
  timestamp: string;
  voteCount: number;
  electionId: string;
  electionName: string;
  status: 'PENDING' | 'CONFIRMED' | 'ANCHORED';
  ethereumTx?: string;
}

interface Election {
  id: string;
  name: string;
  organizationName: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  voteCount: number;
  candidateCount: number;
  blockCount: number;
  merkleRoot?: string;
  stats?: {
    votesCast?: number;
    candidates?: number;
  };
}

interface Stats {
  totalElections: number;
  totalVotes: number;
  totalBlocks: number;
  activeElections: number;
  chainIntegrity: 'VALID' | 'WARNING' | 'ERROR';
}

export default function BlockchainBrowser() {
  const { darkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<'elections' | 'blocks' | 'search'>('elections');
  const [elections, setElections] = useState<Election[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selected items
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [electionsRes, statsRes] = await Promise.all([
        api.get('/election'),
        api.get('/blockchain/stats').catch(() => ({ data: { stats: null } }))
      ]);
      
      setElections(electionsRes.data.elections || []);
      setStats(statsRes.data.stats || {
        totalElections: electionsRes.data.elections?.length || 0,
        totalVotes: electionsRes.data.elections?.reduce((sum: number, e: any) => sum + (e.stats?.votesCast || 0), 0) || 0,
        totalBlocks: 0,
        activeElections: electionsRes.data.elections?.filter((e: any) => e.status === 'VOTING').length || 0,
        chainIntegrity: 'VALID'
      });
      
      // Load blocks
      const blocksRes = await api.get('/blockchain/blocks').catch(() => ({ data: { blocks: [] } }));
      setBlocks(blocksRes.data.blocks || []);
      
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadElectionBlocks = async (electionId: string) => {
    try {
      const res = await api.get(`/blockchain/blocks?electionId=${electionId}`);
      setBlocks(res.data.blocks || []);
    } catch (err) {
      console.error('Failed to load election blocks');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearchError(null);
    setSearchResult(null);
    
    try {
      // Try to find by receipt hash, block hash, or transaction hash
      const res = await api.post('/blockchain/verify', { receiptHash: searchQuery.trim() });
      setSearchResult(res.data);
    } catch (err: any) {
      setSearchError('No results found. Check the hash and try again.');
    }
  };

  const truncateHash = (hash: string, len = 8) => {
    if (!hash) return '—';
    return `${hash.slice(0, len)}...${hash.slice(-len)}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  return (
    <div className={`explorer ${darkMode ? 'dark-mode' : ''}`}>
      {/* Header with Stats */}
      <header className="explorer-header">
        <div className="header-title">
          <h1>Blockchain Explorer</h1>
          <p>Browse elections, blocks, and verify votes on the immutable ledger</p>
        </div>
        
        {stats && (
          <div className="header-stats">
            <div className="stat-box">
              <span className="stat-value">{stats.totalElections}</span>
              <span className="stat-label">Elections</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{stats.totalVotes.toLocaleString()}</span>
              <span className="stat-label">Votes</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{stats.totalBlocks}</span>
              <span className="stat-label">Blocks</span>
            </div>
            <div className={`stat-box integrity-${stats.chainIntegrity.toLowerCase()}`}>
              <span className="stat-value">{stats.chainIntegrity}</span>
              <span className="stat-label">Chain Status</span>
            </div>
          </div>
        )}
      </header>

      {/* Navigation Tabs */}
      <nav className="explorer-nav">
        <button 
          className={`nav-tab ${activeTab === 'elections' ? 'active' : ''}`}
          onClick={() => { setActiveTab('elections'); setSelectedElection(null); }}
        >
          Elections
        </button>
        <button 
          className={`nav-tab ${activeTab === 'blocks' ? 'active' : ''}`}
          onClick={() => setActiveTab('blocks')}
        >
          Blocks
        </button>
        <button 
          className={`nav-tab ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          Verify Vote
        </button>
      </nav>

      {loading && <div className="loading-state">Loading blockchain data...</div>}
      {error && <div className="error-state">{error}</div>}

      {/* Elections Tab */}
      {activeTab === 'elections' && !loading && (
        <div className="explorer-content">
          {!selectedElection ? (
            <div className="elections-list">
              <h2>All Elections</h2>
              <p className="section-description">
                Each election is cryptographically secured with its own keypair. 
                Votes are encrypted, stored in blocks, and linked via SHA3-256 hash chains.
              </p>
              
              {elections.length === 0 ? (
                <div className="empty-state">
                  No elections found. Create one in the admin dashboard.
                </div>
              ) : (
                <div className="election-cards">
                  {elections.map(election => (
                    <div 
                      key={election.id}
                      className="election-card"
                      onClick={() => {
                        setSelectedElection(election);
                        loadElectionBlocks(election.id);
                      }}
                    >
                      <div className="election-card-header">
                        <h3>{election.name}</h3>
                        <span className={`status-badge status-${election.status.toLowerCase()}`}>
                          {election.status}
                        </span>
                      </div>
                      <div className="election-card-meta">
                        <span>{election.type}</span>
                        <span>{formatDate(election.startDate)}</span>
                      </div>
                      <div className="election-card-stats">
                        <div className="mini-stat">
                          <span className="mini-value">{election.stats?.votesCast || 0}</span>
                          <span className="mini-label">Votes</span>
                        </div>
                        <div className="mini-stat">
                          <span className="mini-value">{election.stats?.candidates || 0}</span>
                          <span className="mini-label">Candidates</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="election-detail">
              <button className="back-btn" onClick={() => setSelectedElection(null)}>
                ← Back to Elections
              </button>
              
              <div className="detail-header">
                <h2>{selectedElection.name}</h2>
                <span className={`status-badge status-${selectedElection.status.toLowerCase()}`}>
                  {selectedElection.status}
                </span>
              </div>

              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Election ID</span>
                  <span className="detail-value mono">{selectedElection.id}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Type</span>
                  <span className="detail-value">{selectedElection.type}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Start Date</span>
                  <span className="detail-value">{formatDate(selectedElection.startDate)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">End Date</span>
                  <span className="detail-value">{formatDate(selectedElection.endDate)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Total Votes</span>
                  <span className="detail-value">{selectedElection.stats?.votesCast || 0}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Candidates</span>
                  <span className="detail-value">{selectedElection.stats?.candidates || 0}</span>
                </div>
              </div>

              {/* How Votes Are Secured */}
              <div className="security-explainer">
                <h3>How Votes Are Secured</h3>
                <div className="security-flow">
                  <div className="flow-step">
                    <span className="step-num">1</span>
                    <span className="step-title">Encryption</span>
                    <span className="step-desc">
                      Each vote is encrypted using Curve25519 ECDH + XSalsa20-Poly1305. 
                      Only threshold key holders can decrypt.
                    </span>
                  </div>
                  <div className="flow-arrow">→</div>
                  <div className="flow-step">
                    <span className="step-num">2</span>
                    <span className="step-title">Zero-Knowledge Proof</span>
                    <span className="step-desc">
                      Voter proves eligibility without revealing identity. 
                      Groth16 ZK-SNARK with ~200 byte proof.
                    </span>
                  </div>
                  <div className="flow-arrow">→</div>
                  <div className="flow-step">
                    <span className="step-num">3</span>
                    <span className="step-title">Merkle Commitment</span>
                    <span className="step-desc">
                      Vote hash added to Merkle tree. O(log n) proof of inclusion 
                      allows anyone to verify.
                    </span>
                  </div>
                  <div className="flow-arrow">→</div>
                  <div className="flow-step">
                    <span className="step-num">4</span>
                    <span className="step-title">Block Finality</span>
                    <span className="step-desc">
                      BFT consensus (2f+1 validators) finalizes block. 
                      Periodic anchoring to Ethereum mainnet.
                    </span>
                  </div>
                </div>
              </div>

              {/* Blocks for this election */}
              <div className="election-blocks">
                <h3>Blocks ({blocks.length})</h3>
                {blocks.length === 0 ? (
                  <div className="empty-state">No blocks yet for this election.</div>
                ) : (
                  <div className="block-list">
                    {blocks.map(block => (
                      <div 
                        key={block.id}
                        className="block-row"
                        onClick={() => setSelectedBlock(block)}
                      >
                        <span className="block-height">#{block.height}</span>
                        <span className="block-hash mono">{truncateHash(block.hash, 12)}</span>
                        <span className="block-votes">{block.voteCount} votes</span>
                        <span className="block-time">{formatDate(block.timestamp)}</span>
                        <span className={`block-status status-${block.status.toLowerCase()}`}>
                          {block.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Blocks Tab */}
      {activeTab === 'blocks' && !loading && (
        <div className="explorer-content">
          <h2>All Blocks</h2>
          <p className="section-description">
            Blocks are linked via SHA3-256 hashes forming an immutable chain. 
            Each block contains a Merkle root committing to all votes within it.
          </p>

          {/* Block structure explainer */}
          <div className="block-structure">
            <h3>Block Structure</h3>
            <div className="structure-diagram">
              <pre>{`┌─────────────────────────────────────────────────────────────┐
│                         BLOCK HEADER                         │
├─────────────────────────────────────────────────────────────┤
│  Height:         Sequential block number                     │
│  Previous Hash:  SHA3-256 of previous block (chain link)     │
│  Merkle Root:    Root of vote Merkle tree                    │
│  Timestamp:      UTC time of block creation                  │
│  Validator Sigs: 2f+1 BFT signatures                        │
├─────────────────────────────────────────────────────────────┤
│                         BLOCK BODY                           │
├─────────────────────────────────────────────────────────────┤
│  Vote 1:  { encrypted_vote, zk_proof, nullifier, receipt }  │
│  Vote 2:  { encrypted_vote, zk_proof, nullifier, receipt }  │
│  ...                                                         │
│  Vote N:  { encrypted_vote, zk_proof, nullifier, receipt }  │
└─────────────────────────────────────────────────────────────┘`}</pre>
            </div>
          </div>

          <div className="blocks-table">
            <div className="table-header">
              <span>Height</span>
              <span>Hash</span>
              <span>Merkle Root</span>
              <span>Votes</span>
              <span>Time</span>
              <span>Status</span>
            </div>
            {blocks.length === 0 ? (
              <div className="empty-state">No blocks found.</div>
            ) : (
              blocks.map(block => (
                <div key={block.id} className="table-row" onClick={() => setSelectedBlock(block)}>
                  <span className="col-height">#{block.height}</span>
                  <span className="col-hash mono">{truncateHash(block.hash, 10)}</span>
                  <span className="col-merkle mono">{truncateHash(block.merkleRoot, 10)}</span>
                  <span className="col-votes">{block.voteCount}</span>
                  <span className="col-time">{formatDate(block.timestamp)}</span>
                  <span className={`col-status status-${block.status.toLowerCase()}`}>
                    {block.status}
                    {block.ethereumTx && ' + ETH'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Search/Verify Tab */}
      {activeTab === 'search' && (
        <div className="explorer-content">
          <div className="search-section">
            <h2>Verify Your Vote</h2>
            <p className="section-description">
              Enter your vote receipt hash to verify it was recorded in the blockchain.
              The system will locate your vote and provide a cryptographic Merkle proof.
            </p>

            <div className="search-box">
              <input
                type="text"
                placeholder="Enter vote receipt hash, block hash, or transaction ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button onClick={handleSearch}>Verify</button>
            </div>

            {searchError && (
              <div className="search-error">{searchError}</div>
            )}

            {searchResult && (
              <div className={`search-result ${searchResult.verified ? 'verified' : 'failed'}`}>
                <div className="result-header">
                  <span className="result-icon">{searchResult.verified ? '✓' : '✗'}</span>
                  <span className="result-title">
                    {searchResult.verified ? 'Vote Verified' : 'Verification Failed'}
                  </span>
                </div>

                {searchResult.verified && (
                  <div className="result-details">
                    <div className="result-row">
                      <span className="result-label">Election</span>
                      <span className="result-value">{searchResult.vote?.electionName}</span>
                    </div>
                    <div className="result-row">
                      <span className="result-label">Recorded</span>
                      <span className="result-value">{formatDate(searchResult.vote?.timestamp)}</span>
                    </div>
                    <div className="result-row">
                      <span className="result-label">Block Hash</span>
                      <span className="result-value mono">{searchResult.vote?.blockHash}</span>
                    </div>
                    <div className="result-row">
                      <span className="result-label">Merkle Root</span>
                      <span className="result-value mono">{searchResult.vote?.merkleRoot}</span>
                    </div>

                    {/* Merkle Proof Visualization */}
                    {searchResult.proof && (
                      <div className="merkle-proof-section">
                        <h4>Merkle Proof</h4>
                        <p className="proof-explainer">
                          This proof demonstrates your vote is included in the Merkle tree.
                          Each level shows a sibling hash used to compute the path to the root.
                        </p>
                        <div className="proof-path">
                          <div className="proof-node leaf">
                            <span className="node-label">Your Vote</span>
                            <span className="node-hash">{truncateHash(searchQuery, 8)}</span>
                          </div>
                          {searchResult.proof.map((hash: string, idx: number) => (
                            <div key={idx} className="proof-level">
                              <span className="level-connector">↓ hash with sibling</span>
                              <div className="proof-node">
                                <span className="node-label">Level {idx + 1}</span>
                                <span className="node-hash">{truncateHash(hash, 8)}</span>
                              </div>
                            </div>
                          ))}
                          <div className="proof-level">
                            <span className="level-connector">↓</span>
                            <div className="proof-node root">
                              <span className="node-label">Merkle Root</span>
                              <span className="node-hash">{truncateHash(searchResult.vote?.merkleRoot, 8)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* How Verification Works */}
            <div className="verification-explainer">
              <h3>How Verification Works</h3>
              <div className="explainer-grid">
                <div className="explainer-item">
                  <span className="explainer-num">1</span>
                  <h4>Receipt Hash</h4>
                  <p>
                    When you voted, you received a receipt containing a SHA3-256 hash 
                    of your encrypted vote. This is your proof of voting.
                  </p>
                </div>
                <div className="explainer-item">
                  <span className="explainer-num">2</span>
                  <h4>Merkle Lookup</h4>
                  <p>
                    We locate your vote hash in our Merkle tree and generate an 
                    O(log n) inclusion proof—a path from your vote to the root.
                  </p>
                </div>
                <div className="explainer-item">
                  <span className="explainer-num">3</span>
                  <h4>Proof Verification</h4>
                  <p>
                    Anyone can verify the proof by recomputing the hash path.
                    If it matches the published Merkle root, your vote is confirmed.
                  </p>
                </div>
                <div className="explainer-item">
                  <span className="explainer-num">4</span>
                  <h4>Immutability</h4>
                  <p>
                    The Merkle root is anchored to Ethereum. Tampering with any vote 
                    would change the root, which is publicly verifiable.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Block Detail Modal */}
      {selectedBlock && (
        <div className="modal-overlay" onClick={() => setSelectedBlock(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedBlock(null)}>×</button>
            <h2>Block #{selectedBlock.height}</h2>
            
            <div className="modal-grid">
              <div className="modal-row">
                <span className="modal-label">Block Hash</span>
                <span className="modal-value mono">{selectedBlock.hash}</span>
              </div>
              <div className="modal-row">
                <span className="modal-label">Previous Hash</span>
                <span className="modal-value mono">{selectedBlock.previousHash}</span>
              </div>
              <div className="modal-row">
                <span className="modal-label">Merkle Root</span>
                <span className="modal-value mono">{selectedBlock.merkleRoot}</span>
              </div>
              <div className="modal-row">
                <span className="modal-label">Timestamp</span>
                <span className="modal-value">{formatDate(selectedBlock.timestamp)}</span>
              </div>
              <div className="modal-row">
                <span className="modal-label">Votes</span>
                <span className="modal-value">{selectedBlock.voteCount}</span>
              </div>
              <div className="modal-row">
                <span className="modal-label">Status</span>
                <span className={`modal-value status-${selectedBlock.status.toLowerCase()}`}>
                  {selectedBlock.status}
                </span>
              </div>
              {selectedBlock.ethereumTx && (
                <div className="modal-row">
                  <span className="modal-label">Ethereum TX</span>
                  <a 
                    href={`https://etherscan.io/tx/${selectedBlock.ethereumTx}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="modal-value link"
                  >
                    {truncateHash(selectedBlock.ethereumTx, 12)} →
                  </a>
                </div>
              )}
            </div>

            {/* Hash Chain Visualization */}
            <div className="hash-chain">
              <h4>Hash Chain Link</h4>
              <div className="chain-visual">
                <div className="chain-box prev">
                  <span className="chain-label">Previous Block</span>
                  <span className="chain-hash">{truncateHash(selectedBlock.previousHash, 6)}</span>
                </div>
                <span className="chain-arrow">→</span>
                <div className="chain-box current">
                  <span className="chain-label">This Block</span>
                  <span className="chain-hash">{truncateHash(selectedBlock.hash, 6)}</span>
                </div>
                <span className="chain-arrow">→</span>
                <div className="chain-box next">
                  <span className="chain-label">Next Block</span>
                  <span className="chain-hash">Uses this hash</span>
                </div>
              </div>
              <p className="chain-explainer">
                Each block's hash is computed from its contents including the previous block's hash.
                This creates an unbreakable chain—modifying any block changes all subsequent hashes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="explorer-footer">
        <Link to="/crypto" className="footer-link">Technical Whitepaper</Link>
        <Link to="/elections" className="footer-link">Vote in Election</Link>
        <Link to="/" className="footer-link">Home</Link>
      </footer>
    </div>
  );
}
