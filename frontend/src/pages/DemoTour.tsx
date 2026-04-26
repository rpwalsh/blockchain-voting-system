import { Link } from 'react-router-dom';
import './DemoTour.css';

export default function DemoTour() {
  return (
    <div className="container">
      <div className="card">
        <h1>🎯 Interactive Demo Tour</h1>
        <p className="subtitle">
          Experience the complete cryptographic voting workflow in 5 minutes.
        </p>

        <div className="demo-step">
          <div className="step-number">1</div>
          <div className="step-content">
            <h3>Watch the 2024 Election Replay</h3>
            <p>
              See real election data replayed with cryptographic guarantees, county-level granularity,
              and full geographic visualization.
            </p>
            <Link
              to="/player/f20109ec-a798-4b71-9579-9032088010b9"
              className="btn btn-primary"
            >
              Launch Election Player
            </Link>
          </div>
        </div>

        <div className="demo-step">
          <div className="step-number">2</div>
          <div className="step-content">
            <h3>Browse Elections</h3>
            <p>
              View how election officials manage multiple simultaneous elections with status tracking,
              participation metrics, and real-time statistics.
            </p>
            <Link to="/elections" className="btn btn-secondary">
              View Elections List
            </Link>
          </div>
        </div>

        <div className="demo-step">
          <div className="step-number">3</div>
          <div className="step-content">
            <h3>Cast a Vote</h3>
            <p>
              Use an anonymous voting token to cast an encrypted ballot. Receive a cryptographic
              receipt proving your vote was recorded without revealing your choice.
            </p>
            <Link
              to="/vote/f20109ec-a798-4b71-9579-9032088010b9"
              className="btn btn-secondary"
            >
              Go to Voting Screen
            </Link>
          </div>
        </div>

        <div className="demo-step">
          <div className="step-number">4</div>
          <div className="step-content">
            <h3>Verify Your Vote</h3>
            <p>
              Use your receipt hash to verify inclusion in the immutable public ledger.
              Your vote content remains encrypted and private.
            </p>
            <Link to="/verify" className="btn btn-secondary">
              Verify Vote
            </Link>
          </div>
        </div>

        <div className="demo-step">
          <div className="step-number">5</div>
          <div className="step-content">
            <h3>Inspect the Cryptography</h3>
            <p>
              Explore the public audit trail and cryptographic live demo to see end-to-end
              verifiability and zero-trust design in action.
            </p>
            <div className="button-group">
              <Link to="/audit" className="btn btn-secondary">
                Public Audit
              </Link>
              <Link to="/crypto-demo" className="btn btn-secondary">
                Crypto Live Demo
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="card mt-3 card-info">
        <h3>🔐 Key Security Features</h3>
        <ul className="feature-list">
          <li>
            <strong>End-to-end encryption</strong> with Curve25519-XSalsa20-Poly1305
          </li>
          <li>
            <strong>Voter anonymity</strong> through unlinkable voting tokens
          </li>
          <li>
            <strong>Public verifiability</strong> with Merkle tree proofs
          </li>
          <li>
            <strong>Zero-knowledge proofs</strong> for eligibility without identity disclosure
          </li>
          <li>
            <strong>Threshold cryptography</strong> prevents single-point decryption
          </li>
          <li>
            <strong>Immutable audit trail</strong> with cryptographic signatures
          </li>
        </ul>
      </div>
    </div>
  );
}
