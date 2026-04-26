import { useState, useEffect } from 'react';
import { auditService, electionService } from '../services/api';

export default function Audit() {
  const [elections, setElections] = useState<any[]>([]);
  const [selectedElection, setSelectedElection] = useState('');
  const [integrity, setIntegrity] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    loadElections();
  }, []);
  
  const loadElections = async () => {
    try {
      const response = await electionService.getElections();
      setElections(response.elections);
    } catch (err) {
      console.error('Failed to load elections:', err);
    }
  };
  
  const handleAudit = async () => {
    if (!selectedElection) return;
    
    try {
      setLoading(true);
      const [integrityResponse, statsResponse] = await Promise.all([
        auditService.getElectionIntegrity(selectedElection),
        auditService.getStatistics(selectedElection),
      ]);
      setIntegrity(integrityResponse);
      setStats(statsResponse);
    } catch (err) {
      console.error('Failed to audit election:', err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container">
      <h1>Public Audit Trail</h1>
      <p className="text-muted mb-3">
        Verify the integrity of any election. All data is publicly accessible and verifiable.
      </p>
      
      <div className="card">
        <h3>Select Election to Audit</h3>
        <div className="form-group">
          <select
            className="form-control"
            value={selectedElection}
            onChange={(e) => setSelectedElection(e.target.value)}
          >
            <option value="">-- Select an election --</option>
            {elections.map((election) => (
              <option key={election.id} value={election.id}>
                {election.name} ({election.status})
              </option>
            ))}
          </select>
        </div>
        
        <button
          className="btn btn-primary"
          onClick={handleAudit}
          disabled={!selectedElection || loading}
        >
          {loading ? 'Auditing...' : 'Audit Election'}
        </button>
      </div>
      
      {integrity && (
        <div className="card mt-3">
          <h3>Integrity Report</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: '600', color: 'var(--primary)' }}>
                {integrity.integrity.totalVotes}
              </div>
              <div className="text-muted">Total Votes</div>
            </div>
            
            <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: '600', color: 'var(--success)' }}>
                {integrity.integrity.validProofs}
              </div>
              <div className="text-muted">Valid Proofs</div>
            </div>
            
            <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: '600', color: integrity.integrity.invalidProofs > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {integrity.integrity.invalidProofs}
              </div>
              <div className="text-muted">Invalid Proofs</div>
            </div>
            
            <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: '600', color: 'var(--primary)' }}>
                {integrity.integrity.integrityScore}
              </div>
              <div className="text-muted">Integrity Score</div>
            </div>
          </div>
          
          {integrity.integrity.invalidProofs === 0 ? (
            <div className="alert alert-success">
              <strong> Perfect Integrity:</strong> {integrity.message}
            </div>
          ) : (
            <div className="alert alert-danger">
              <strong> Integrity Issues Detected:</strong> {integrity.message}
            </div>
          )}
          
          <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.875rem', wordBreak: 'break-all' }}>
            <strong>Current Merkle Root:</strong><br />
            {integrity.integrity.currentMerkleRoot}
          </div>
        </div>
      )}
      
      {stats && (
        <div className="card mt-3">
          <h3>Election Statistics</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--primary)' }}>
                {stats.statistics.candidates}
              </div>
              <div className="text-muted">Candidates</div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--primary)' }}>
                {stats.statistics.registeredVoters}
              </div>
              <div className="text-muted">Registered Voters</div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--primary)' }}>
                {stats.statistics.votesCast}
              </div>
              <div className="text-muted">Votes Cast</div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--primary)' }}>
                {stats.statistics.turnoutRate}
              </div>
              <div className="text-muted">Turnout Rate</div>
            </div>
          </div>
        </div>
      )}
      
      <div className="card mt-3">
        <h3>What You Can Audit</h3>
        <ul style={{ marginTop: '1rem', paddingLeft: '1.5rem' }}>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Integrity Verification:</strong> Check that all votes have valid Merkle proofs
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Vote Counting:</strong> Verify the total number of votes matches the tally
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Turnout Statistics:</strong> View voter registration and participation rates
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong>Ledger Entries:</strong> Browse the complete public ledger of all votes
          </li>
          <li>
            <strong>Cryptographic Proofs:</strong> Independently verify all cryptographic signatures
          </li>
        </ul>
        
        <div className="alert alert-info mt-2">
          <strong> Fully Transparent:</strong> All audit data is publicly accessible.
          Anyone can verify the election results without requiring special access or permissions.
        </div>
      </div>
    </div>
  );
}
