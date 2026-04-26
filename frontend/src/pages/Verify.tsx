import { useState } from 'react';
import { voterService } from '../services/api';

export default function Verify() {
  const [receiptHash, setReceiptHash] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!receiptHash) {
      setError('Please enter your receipt hash');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      const response = await voterService.verifyVote(receiptHash);
      setResult(response);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to verify vote');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container">
      <h1>Verify Your Vote</h1>
      <p className="text-muted mb-3">
        Enter your receipt hash to verify your vote was recorded in the public ledger.
      </p>
      
      <div className="card">
        <form onSubmit={handleVerify}>
          <div className="form-group">
            <label>Receipt Hash</label>
            <input
              type="text"
              className="form-control"
              placeholder="Enter your receipt hash"
              value={receiptHash}
              onChange={(e) => setReceiptHash(e.target.value)}
              required
              style={{ fontFamily: 'monospace' }}
            />
            <small className="text-muted">
              This was provided when you cast your vote. Your vote content remains private.
            </small>
          </div>
          
          {error && (
            <div className="alert alert-danger">{error}</div>
          )}
          
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify Vote'}
          </button>
        </form>
        
        {result && (
          <div style={{ marginTop: '2rem' }}>
            {result.verified ? (
              <div className="alert alert-success">
                <h3> Vote Verified!</h3>
                <p>{result.message}</p>
              </div>
            ) : (
              <div className="alert alert-danger">
                <h3> Verification Failed</h3>
                <p>{result.message}</p>
              </div>
            )}
            
            <h3>Verification Details</h3>
            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.875rem', wordBreak: 'break-all' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Ledger Entry Hash:</strong><br />
                {result.vote.ledgerEntryHash}
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Merkle Root:</strong><br />
                {result.vote.merkleRoot}
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Timestamp:</strong><br />
                {new Date(result.vote.timestamp).toLocaleString()}
              </div>
              <div>
                <strong>Election:</strong><br />
                {result.vote.election.name} (Status: {result.vote.election.status})
              </div>
            </div>
            
            <div className="alert alert-info mt-2">
              <strong> Privacy Protected:</strong> This verification proves your vote was counted
              without revealing how you voted. Your vote content remains encrypted.
            </div>
          </div>
        )}
      </div>
      
      <div className="card mt-3">
        <h3>How Verification Works</h3>
        <p className="text-muted">
          When you cast your vote, you received a unique receipt hash. This hash acts as a
          cryptographic proof that your vote exists in the public ledger.
        </p>
        
        <ul style={{ marginTop: '1rem', paddingLeft: '1.5rem' }}>
          <li style={{ marginBottom: '0.5rem' }}>
            Your receipt hash links to a specific entry in the immutable ledger
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            Each ledger entry includes a Merkle proof for independent verification
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            Your vote content remains encrypted and cannot be revealed by verification
          </li>
          <li>
            Anyone can verify the integrity of the election without compromising voter privacy
          </li>
        </ul>
      </div>
    </div>
  );
}
