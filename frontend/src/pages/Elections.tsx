import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { electionService } from '../services/api';
import './Elections.css';

interface Election {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  status: string;
  stats: {
    candidates: number;
    registeredVoters: number;
    votesCast: number;
  };
}

export default function Elections() {
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    loadElections();
  }, []);
  
  const loadElections = async () => {
    try {
      setLoading(true);
      const response = await electionService.getElections();
      setElections(response.elections);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load elections');
    } finally {
      setLoading(false);
    }
  };
  
  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      SETUP: 'badge-info',
      REGISTRATION: 'badge-warning',
      VOTING: 'badge-success',
      TALLYING: 'badge-warning',
      COMPLETED: 'badge-info',
      CANCELLED: 'badge-danger',
    };
    return badges[status] || 'badge-info';
  };
  
  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading elections...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container">
        <div className="alert alert-danger">
          {error}
        </div>
      </div>
    );
  }
  
  return (
    <div className="container">
      <h1>Elections</h1>
      <p className="text-muted mb-3">
        Browse all elections and participate in active voting periods.
      </p>
      
      {elections.length === 0 ? (
        <div className="card text-center">
          <p className="text-muted">No elections found.</p>
        </div>
      ) : (
        <div className="grid grid-2">
          {elections.map((election) => (
            <div key={election.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <h3 style={{ marginBottom: 0 }}>{election.name}</h3>
                <span className={`badge ${getStatusBadge(election.status)}`}>
                  {election.status}
                </span>
              </div>
              
              {election.description && (
                <p className="text-muted mb-2">{election.description}</p>
              )}
              
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                <div>
                   Start: {new Date(election.startDate).toLocaleString()}
                </div>
                <div>
                   End: {new Date(election.endDate).toLocaleString()}
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                <div className="text-center">
                  <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--primary)' }}>
                    {election.stats.candidates}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Candidates
                  </div>
                </div>
                <div className="text-center">
                  <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--primary)' }}>
                    {election.stats.registeredVoters}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Registered
                  </div>
                </div>
                <div className="text-center">
                  <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--primary)' }}>
                    {election.stats.votesCast}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Votes
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {election.status === 'VOTING' && (
                  <Link to={`/vote/${election.id}`} className="btn btn-primary" style={{ flex: 1 }}>
                    Vote Now
                  </Link>
                )}
                {election.status === 'COMPLETED' && (
                  <Link to={`/vote/${election.id}`} className="btn btn-secondary" style={{ flex: 1 }}>
                    View Results
                  </Link>
                )}
                {(election.status === 'SETUP' || election.status === 'REGISTRATION') && (
                  <Link to={`/vote/${election.id}`} className="btn btn-secondary" style={{ flex: 1 }}>
                    View Details
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
