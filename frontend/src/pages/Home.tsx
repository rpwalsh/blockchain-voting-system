import { Link } from 'react-router-dom';
import './Home.css';

export default function Home() {
  return (
    <div className="container">
      <div className="card text-center">
        <h1>Trustless Voting System</h1>
        <p className="text-muted home-hero">
          A cryptographically secure, tamper-proof voting platform designed for government elections.
          Every vote is encrypted, verifiable, and recorded in an immutable public ledger.
        </p>
        <div className="home-actions">
          <Link to="/player/f20109ec-a798-4b71-9579-9032088010b9" className="btn btn-primary">
            🎬 Watch Live Demo
          </Link>
          <Link to="/demo" className="btn btn-primary">
            🎯 Interactive Tour
          </Link>
          <Link to="/elections" className="btn btn-primary">
            🗳️ View Elections
          </Link>
          <Link to="/verify" className="btn btn-secondary">
            ✓ Verify Your Vote
          </Link>
          <Link to="/audit" className="btn btn-secondary">
            📋 Public Audit Trail
          </Link>
        </div>
      </div>
      
      <div className="grid grid-3 mt-3">
        <div className="card">
          <h3> End-to-End Encryption</h3>
          <p className="text-muted">
            Every vote is encrypted from the moment you cast it until the final tally.
            Your choice remains completely private.
          </p>
        </div>
        
        <div className="card">
          <h3> Public Verifiability</h3>
          <p className="text-muted">
            Anyone can verify the election results without compromising voter privacy.
            All votes are recorded in a tamper-proof public ledger.
          </p>
        </div>
        
        <div className="card">
          <h3> Zero-Knowledge Proofs</h3>
          <p className="text-muted">
            Your voting eligibility is verified without revealing your identity.
            Cryptographic proofs ensure only eligible voters can participate.
          </p>
        </div>
        
        <div className="card">
          <h3> Anonymous Voting Tokens</h3>
          <p className="text-muted">
            Receive an unlinkable voting token during registration.
            Your identity is cryptographically separated from your vote.
          </p>
        </div>
        
        <div className="card">
          <h3> Immutable Audit Trail</h3>
          <p className="text-muted">
            Every action creates a signed, timestamped ledger entry.
            The audit trail cannot be altered or deleted.
          </p>
        </div>
        
        <div className="card">
          <h3> Merkle Tree Verification</h3>
          <p className="text-muted">
            Each vote includes a Merkle proof allowing independent verification
            that it was counted in the election.
          </p>
        </div>
      </div>
      
      <div className="card mt-3">
        <h2>How It Works</h2>
        <div className="how-step">
          <div className="how-step-item">
            <h4 className="how-step-title">
              1. Voter Registration
            </h4>
            <p className="text-muted">
              Register with your government ID. Receive an anonymous voting token
              that is cryptographically unlinkable to your identity. This token is
              your key to voting and must be kept secure.
            </p>
          </div>
          
          <div className="how-step-item">
            <h4 className="how-step-title">
              2. Cast Your Vote
            </h4>
            <p className="text-muted">
              During the voting period, use your voting token to cast an encrypted ballot.
              Your vote is encrypted with the election public key and recorded in the
              immutable ledger. You receive a receipt hash for verification.
            </p>
          </div>
          
          <div className="how-step-item">
            <h4 className="how-step-title">
              3. Verify Your Vote
            </h4>
            <p className="text-muted">
              Use your receipt hash to verify your vote was recorded in the public ledger.
              The system provides a Merkle proof showing your vote is part of the election
              without revealing how you voted.
            </p>
          </div>
          
          <div className="how-step-item">
            <h4 className="how-step-title">
              4. Tallying & Results
            </h4>
            <p className="text-muted">
              Election officials use threshold decryption to tally votes without revealing
              individual choices. The system generates cryptographic proofs that the
              tally is correct. Results are publicly verifiable.
            </p>
          </div>
        </div>
      </div>
      
      <div className="card mt-3 alert-info">
        <h3>🔒 Security Guarantees</h3>
        <ul className="security-list">
          <li>
            <strong>Voter Anonymity:</strong> Your identity is cryptographically separated from your vote
          </li>
          <li>
            <strong>Vote Integrity:</strong> Tamper-proof ledger with cryptographic signatures
          </li>
          <li>
            <strong>Public Verifiability:</strong> Anyone can audit the election without special access
          </li>
          <li>
            <strong>No Single Point of Failure:</strong> Distributed trust model with threshold cryptography
          </li>
          <li>
            <strong>Coercion Resistance:</strong> No way to prove how you voted to a third party
          </li>
        </ul>
      </div>
    </div>
  );
}
