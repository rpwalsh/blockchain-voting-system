import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { electionService, voterService } from '../services/api';

export default function Vote() {
  const { electionId } = useParams();
  const [election, setElection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [votingToken, setVotingToken] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [receipt, setReceipt] = useState<any>(null);
  const [voting, setVoting] = useState(false);
  
  useEffect(() => {
    loadElection();
  }, [electionId]);
  
  const loadElection = async () => {
    try {
      setLoading(true);
      const response = await electionService.getElection(electionId!);
      setElection(response.election);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load election');
    } finally {
      setLoading(false);
    }
  };
  
  const handleVote = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!votingToken || !selectedCandidate) {
      setError('Please enter your voting token and select a candidate');
      return;
    }
    
    try {
      setVoting(true);
      setError('');
      const response = await voterService.vote(electionId!, votingToken, selectedCandidate);
      setReceipt(response);
      setVotingToken('');
      setSelectedCandidate('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to cast vote');
    } finally {
      setVoting(false);
    }
  };
  
  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading election...</p>
        </div>
      </div>
    );
  }
  
  if (error && !election) {
    return (
      <div className="container">
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }
  
  if (receipt) {
    return (
      <div className="container">
        <div className="card">
          <div className="alert alert-success">
            <h3> Vote Successfully Cast!</h3>
            <p>Your vote has been encrypted and recorded in the immutable public ledger.</p>
          </div>
          
          <h3>Your Receipt</h3>
          <p className="text-muted mb-2">
            Save this information to verify your vote later:
          </p>
          
          <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '6px', marginBottom: '1rem', fontFamily: 'monospace', fontSize: '0.875rem', wordBreak: 'break-all' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Receipt Hash:</strong><br />
              {receipt.receiptHash}
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Ledger Entry:</strong><br />
              {receipt.ledgerEntryHash}
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Merkle Root:</strong><br />
              {receipt.merkleRoot}
            </div>
            <div>
              <strong>Timestamp:</strong><br />
              {new Date(receipt.timestamp).toLocaleString()}
            </div>
          </div>
          
          <div className="alert alert-warning">
            <strong> Important:</strong> Save your receipt hash. You can use it to verify
            your vote was counted in the public ledger. Your vote content remains encrypted and private.
          </div>
          
          <button onClick={() => window.location.href = '/verify'} className="btn btn-primary">
            Verify Your Vote
          </button>
        </div>
      </div>
    );
  }
  
  if (election.status === 'COMPLETED') {
    return (
      <div className="container">
        <h1>{election.name}</h1>
        <div className="card">
          <h3>Election Results</h3>
          <p className="text-muted mb-3">
            This election has been completed and tallied.
          </p>
        </div>
      </div>
    );
  }
  
  if (election.status !== 'VOTING') {
    return (
      <div className="container">
        <h1>{election.name}</h1>
        <div className="card">
          <div className="alert alert-warning">
            This election is not currently accepting votes. Status: {election.status}
          </div>
          <p className="text-muted">
            Start: {new Date(election.startDate).toLocaleString()}<br />
            End: {new Date(election.endDate).toLocaleString()}
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container">
      <h1>{election.name}</h1>
      <p className="text-muted mb-3">{election.description}</p>
      
      {error && (
        <div className="alert alert-danger">{error}</div>
      )}
      
      <div className="card">
        <h3>Cast Your Vote</h3>
        
        <div className="alert alert-info">
          <strong> Your vote is anonymous and encrypted.</strong><br />
          Enter your voting token below. Your vote will be recorded in the public ledger,
          but your choice remains private.
        </div>
        
        <form onSubmit={handleVote}>
          <div className="form-group">
            <label>Voting Token</label>
            <input
              type="password"
              className="form-control"
              placeholder="Enter your anonymous voting token"
              value={votingToken}
              onChange={(e) => setVotingToken(e.target.value)}
              required
            />
            <small className="text-muted">
              This was provided when you registered. It cannot be recovered.
            </small>
          </div>
          
          <div className="form-group">
            <label>Select Candidate</label>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {election.candidates.map((candidate: any) => (
                <div
                  key={candidate.id}
                  onClick={() => setSelectedCandidate(candidate.id)}
                  style={{
                    padding: '1rem',
                    border: `2px solid ${selectedCandidate === candidate.id ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: selectedCandidate === candidate.id ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input
                      type="radio"
                      checked={selectedCandidate === candidate.id}
                      onChange={() => setSelectedCandidate(candidate.id)}
                      style={{ width: '20px', height: '20px' }}
                    />
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '1.125rem' }}>
                        {candidate.name}
                      </div>
                      {candidate.party && (
                        <div className="text-muted" style={{ fontSize: '0.875rem' }}>
                          {candidate.party}
                        </div>
                      )}
                      {candidate.description && (
                        <div className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                          {candidate.description}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <button
            type="submit"
            className="btn btn-primary"
            disabled={voting || !votingToken || !selectedCandidate}
            style={{ width: '100%', fontSize: '1.125rem', padding: '1rem' }}
          >
            {voting ? 'Casting Vote...' : 'Cast Vote'}
          </button>
        </form>
      </div>
    </div>
  );
}
