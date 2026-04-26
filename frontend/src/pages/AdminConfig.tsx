import { useState } from 'react';
import './AdminConfig.css';

interface SystemConfig {
  postQuantumCrypto: boolean;
  zkSnarkEnabled: boolean;
  blockchainAnchoring: boolean;
  thresholdKeyShares: number;
  requiredKeyShares: number;
  merkleTreeDepth: number;
  encryptionAlgorithm: string;
  signatureAlgorithm: string;
  hashAlgorithm: string;
}

export default function AdminConfig() {
  const [config, setConfig] = useState<SystemConfig>({
    postQuantumCrypto: false,
    zkSnarkEnabled: true,
    blockchainAnchoring: true,
    thresholdKeyShares: 5,
    requiredKeyShares: 3,
    merkleTreeDepth: 20,
    encryptionAlgorithm: 'Curve25519-XSalsa20-Poly1305',
    signatureAlgorithm: 'Ed25519',
    hashAlgorithm: 'SHA3-256'
  });

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // In production, this would call an API
    console.log('Saving config:', config);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const postQuantumAlgorithms = {
    encryption: 'CRYSTALS-Kyber (NIST PQC Standard)',
    signature: 'CRYSTALS-Dilithium (NIST PQC Standard)',
    hash: 'SHA3-512 (quantum-resistant)'
  };

  return (
    <div className="admin-config">
      <header className="config-header">
        <h1>System Configuration</h1>
        <p>Configure cryptographic parameters and security settings</p>
      </header>

      <div className="config-sections">
        {/* Post-Quantum Cryptography */}
        <section className="config-section highlight">
          <div className="section-header">
            <h2>Post-Quantum Cryptography</h2>
            <div className="section-badge">Critical Security Feature</div>
          </div>
          
          <div className="config-item">
            <div className="config-label">
              <h3>Enable Post-Quantum Cryptography</h3>
              <p>
                Use NIST-standardized post-quantum algorithms (CRYSTALS-Kyber, CRYSTALS-Dilithium)
                to protect against quantum computer attacks. <strong>This ensures votes remain secure
                even if quantum computers become available.</strong>
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={config.postQuantumCrypto}
                onChange={(e) => setConfig({ ...config, postQuantumCrypto: e.target.checked })}
                aria-label="Enable post-quantum cryptography"
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {config.postQuantumCrypto && (
            <div className="pq-info">
              <div className="pq-algorithm">
                <strong>Encryption:</strong> {postQuantumAlgorithms.encryption}
              </div>
              <div className="pq-algorithm">
                <strong>Signatures:</strong> {postQuantumAlgorithms.signature}
              </div>
              <div className="pq-algorithm">
                <strong>Hashing:</strong> {postQuantumAlgorithms.hash}
              </div>
              <div className="pq-warning">
                <strong>Note:</strong> Post-quantum algorithms have larger key sizes and may
                impact performance. Recommended for high-security elections.
              </div>
            </div>
          )}
        </section>

        {/* Cryptographic Features */}
        <section className="config-section">
          <div className="section-header">
            <h2>Cryptographic Features</h2>
          </div>

          <div className="config-item">
            <div className="config-label">
              <h3>Zero-Knowledge Proofs (zk-SNARKs)</h3>
              <p>Enable Groth16 zk-SNARKs for verifiable vote tallying without revealing individual votes</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={config.zkSnarkEnabled}
                onChange={(e) => setConfig({ ...config, zkSnarkEnabled: e.target.checked })}
                aria-label="Enable zero-knowledge proofs"
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="config-item">
            <div className="config-label">
              <h3>Blockchain Anchoring</h3>
              <p>Anchor vote batches to public blockchains for immutable timestamping</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={config.blockchainAnchoring}
                onChange={(e) => setConfig({ ...config, blockchainAnchoring: e.target.checked })}
                aria-label="Enable blockchain anchoring"
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </section>

        {/* Threshold Cryptography */}
        <section className="config-section">
          <div className="section-header">
            <h2>Threshold Cryptography (Shamir Secret Sharing)</h2>
          </div>

          <div className="config-item">
            <div className="config-label">
              <h3>Total Key Shares</h3>
              <p>Number of key shares to generate (N in K-of-N threshold)</p>
            </div>
            <input
              type="number"
              min="3"
              max="10"
              value={config.thresholdKeyShares}
              onChange={(e) => setConfig({ ...config, thresholdKeyShares: parseInt(e.target.value) })}
              className="config-input"
              aria-label="Total key shares"
            />
          </div>

          <div className="config-item">
            <div className="config-label">
              <h3>Required Key Shares</h3>
              <p>Minimum shares needed to decrypt results (K in K-of-N threshold)</p>
            </div>
            <input
              type="number"
              min="2"
              max={config.thresholdKeyShares}
              value={config.requiredKeyShares}
              onChange={(e) => setConfig({ ...config, requiredKeyShares: parseInt(e.target.value) })}
              className="config-input"
              aria-label="Required key shares"
            />
          </div>

          <div className="threshold-visual">
            <p>
              Current setting: <strong>{config.requiredKeyShares} of {config.thresholdKeyShares}</strong> key holders
              must cooperate to decrypt results
            </p>
          </div>
        </section>

        {/* Algorithm Selection */}
        <section className="config-section">
          <div className="section-header">
            <h2>Algorithm Selection</h2>
          </div>

          <div className="config-item">
            <div className="config-label">
              <h3>Encryption Algorithm</h3>
              <p>Algorithm for encrypting votes</p>
            </div>
            <select
              value={config.encryptionAlgorithm}
              onChange={(e) => setConfig({ ...config, encryptionAlgorithm: e.target.value })}
              className="config-select"
              disabled={config.postQuantumCrypto}
              aria-label="Encryption algorithm"
            >
              <option value="Curve25519-XSalsa20-Poly1305">Curve25519-XSalsa20-Poly1305 (Default)</option>
              <option value="AES-256-GCM">AES-256-GCM</option>
              <option value="ChaCha20-Poly1305">ChaCha20-Poly1305</option>
            </select>
            {config.postQuantumCrypto && (
              <small className="config-note">Using CRYSTALS-Kyber (post-quantum enabled)</small>
            )}
          </div>

          <div className="config-item">
            <div className="config-label">
              <h3>Signature Algorithm</h3>
              <p>Algorithm for signing votes and audit trails</p>
            </div>
            <select
              value={config.signatureAlgorithm}
              onChange={(e) => setConfig({ ...config, signatureAlgorithm: e.target.value })}
              className="config-select"
              disabled={config.postQuantumCrypto}
              aria-label="Signature algorithm"
            >
              <option value="Ed25519">Ed25519 (Default)</option>
              <option value="ECDSA">ECDSA P-256</option>
              <option value="RSA">RSA-4096</option>
            </select>
            {config.postQuantumCrypto && (
              <small className="config-note">Using CRYSTALS-Dilithium (post-quantum enabled)</small>
            )}
          </div>

          <div className="config-item">
            <div className="config-label">
              <h3>Hash Algorithm</h3>
              <p>Algorithm for Merkle trees and vote receipts</p>
            </div>
            <select
              value={config.hashAlgorithm}
              onChange={(e) => setConfig({ ...config, hashAlgorithm: e.target.value })}
              className="config-select"
              aria-label="Hash algorithm"
            >
              <option value="SHA3-256">SHA3-256 (Default)</option>
              <option value="SHA3-512">SHA3-512 (Post-quantum recommended)</option>
              <option value="BLAKE2b">BLAKE2b</option>
            </select>
          </div>
        </section>

        {/* Advanced Settings */}
        <section className="config-section">
          <div className="section-header">
            <h2>Advanced Settings</h2>
          </div>

          <div className="config-item">
            <div className="config-label">
              <h3>Merkle Tree Depth</h3>
              <p>Maximum depth of Merkle trees (higher = more votes per tree)</p>
            </div>
            <input
              type="number"
              min="10"
              max="30"
              value={config.merkleTreeDepth}
              onChange={(e) => setConfig({ ...config, merkleTreeDepth: parseInt(e.target.value) })}
              className="config-input"
              aria-label="Merkle tree depth"
            />
            <small className="config-note">
              Current capacity: up to {Math.pow(2, config.merkleTreeDepth).toLocaleString()} votes per tree
            </small>
          </div>
        </section>
      </div>

      {/* Save Section */}
      <div className="config-actions">
        <button className="save-btn" onClick={handleSave}>
          Save Configuration
        </button>
        {saved && (
          <div className="save-success">
            ✓ Configuration saved successfully
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div className="security-notice">
        <h3>🔒 Security Notice</h3>
        <p>
          Changing cryptographic parameters requires careful consideration and may require
          re-encryption of existing votes. Consult with your security team before enabling
          post-quantum cryptography in production systems.
        </p>
        <p>
          <strong>Post-quantum cryptography</strong> is recommended for elections that need
          to remain secure for decades, as quantum computers capable of breaking current
          encryption may become available in the future.
        </p>
      </div>
    </div>
  );
}
