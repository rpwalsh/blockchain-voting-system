import { useState } from 'react';
import { Link } from 'react-router-dom';
import './WhyUs.css';

interface HistoricalElection {
  year: number;
  title: string;
  issues: string[];
  controversy: string;
  outcome: string;
}

const historicalElections: HistoricalElection[] = [
  {
    year: 2000,
    title: "Bush vs. Gore",
    issues: [
      "Hanging chads on punch-card ballots",
      "Manual recount disputes in Florida",
      "Supreme Court intervention (Bush v. Gore)",
      "537-vote margin decided presidency"
    ],
    controversy: "Paper ballot ambiguity and manual counting inconsistencies led to 36 days of legal battles and a Supreme Court decision.",
    outcome: "Undermined public confidence in election integrity"
  },
  {
    year: 2016,
    title: "Trump vs. Clinton",
    issues: [
      "Foreign interference allegations",
      "Social media manipulation campaigns",
      "Disinformation and propaganda networks",
      "No transparent vote verification system"
    ],
    controversy: "Questions about foreign influence, bot farms, and coordinated disinformation campaigns dominated post-election discourse.",
    outcome: "Deep partisan divide over election legitimacy"
  },
  {
    year: 2020,
    title: "Biden vs. Trump",
    issues: [
      "Mail-in ballot expansion during pandemic",
      "Competing narratives about election security",
      "Limited real-time verification for voters",
      "No cryptographic proof of vote integrity"
    ],
    controversy: "Unprecedented challenges to election results, despite lack of evidence of widespread fraud. Lack of transparent verification systems fueled speculation.",
    outcome: "Record-low trust in election systems among portions of electorate"
  },
  {
    year: 2024,
    title: "Recent Election",
    issues: [
      "Continued concerns about transparency",
      "No voter-verifiable cryptographic receipts",
      "Inability to prove vote was counted correctly",
      "No real-time public auditability"
    ],
    controversy: "Traditional voting systems lack cryptographic proof that votes were recorded and tallied correctly, leaving room for doubt.",
    outcome: "Voters want proof, not promises"
  }
];

const useCases = [
  {
    category: "Corporate Governance",
    icon: "🏢",
    examples: [
      "Board of Directors elections",
      "Shareholder proxy voting",
      "Union representation votes",
      "Executive compensation approval"
    ],
    problem: "Traditional systems lack transparency and real-time verification",
    solution: "Every stakeholder can cryptographically verify their vote was counted"
  },
  {
    category: "Academic Institutions",
    icon: "🎓",
    examples: [
      "Student government elections",
      "Faculty senate voting",
      "Academic award selections",
      "Department chair elections"
    ],
    problem: "Paper ballots are slow, manual counts are error-prone",
    solution: "Instant, verifiable results with full audit trail"
  },
  {
    category: "Government Elections",
    icon: "🏛️",
    examples: [
      "Municipal elections",
      "State propositions",
      "Federal elections",
      "Special district boards"
    ],
    problem: "No cryptographic proof votes were tallied correctly",
    solution: "End-to-end verifiable elections with post-quantum security"
  },
  {
    category: "Non-Profit Organizations",
    icon: "🤝",
    examples: [
      "Board member elections",
      "Budget approval votes",
      "Policy change referendums",
      "Membership decisions"
    ],
    problem: "Manual processes are expensive and lack transparency",
    solution: "Automated, transparent, and verifiable voting"
  }
];

export default function WhyUs() {
  const [selectedElection, setSelectedElection] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { title: "Historical Context", subtitle: "Why elections need cryptographic proof" },
    { title: "Use Cases", subtitle: "Who needs trustless voting" },
    { title: "The Solution", subtitle: "How our system proves integrity" },
    { title: "See It In Action", subtitle: "Experience the 2024 election verified" }
  ];

  return (
    <div className="why-us">
      {/* Progress Indicator */}
      <div className="progress-steps">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`step ${currentStep === index ? 'active' : ''} ${currentStep > index ? 'completed' : ''}`}
            onClick={() => setCurrentStep(index)}
          >
            <div className="step-number">{index + 1}</div>
            <div className="step-content">
              <div className="step-title">{step.title}</div>
              <div className="step-subtitle">{step.subtitle}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="step-content-area">
        {currentStep === 0 && (
          <section className="historical-elections">
            <h1>The Problem: Trust Without Proof</h1>
            <p className="intro">
              For decades, elections have relied on trust rather than cryptographic proof.
              This has led to repeated controversies and declining public confidence.
            </p>

            <div className="election-timeline">
              {historicalElections.map((election) => (
                <div
                  key={election.year}
                  className={`election-card ${selectedElection === election.year ? 'expanded' : ''}`}
                  onClick={() => setSelectedElection(selectedElection === election.year ? null : election.year)}
                >
                  <div className="election-header">
                    <span className="year">{election.year}</span>
                    <h2>{election.title}</h2>
                  </div>

                  {selectedElection === election.year && (
                    <div className="election-details">
                      <div className="section">
                        <h3>Key Issues</h3>
                        <ul>
                          {election.issues.map((issue, idx) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="section controversy">
                        <h3>The Controversy</h3>
                        <p>{election.controversy}</p>
                      </div>
                      <div className="section outcome">
                        <h3>Outcome</h3>
                        <p>{election.outcome}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="key-insight">
              <h3>The Common Thread</h3>
              <p>
                None of these elections provided voters with cryptographic proof that their vote was recorded 
                and tallied correctly. Without verifiable receipts and public auditability, disputes were 
                inevitable. Trust alone is not enough.
              </p>
            </div>

            <button className="next-btn" onClick={() => setCurrentStep(1)}>
              Next: Who Needs This →
            </button>
          </section>
        )}

        {currentStep === 1 && (
          <section className="use-cases">
            <h1>Who Needs Trustless Voting?</h1>
            <p className="intro">
              From corporate boardrooms to government elections, any organization that values 
              transparency, accountability, and verifiable integrity.
            </p>

            <div className="use-case-grid">
              {useCases.map((useCase, idx) => (
                <div key={idx} className="use-case-card">
                  <div className="use-case-header">
                    <span className="icon-text">[{useCase.category}]</span>
                    <h2>{useCase.category}</h2>
                  </div>
                  <div className="examples">
                    <h3>Common Applications</h3>
                    <ul>
                      {useCase.examples.map((example, i) => (
                        <li key={i}>{example}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="problem-solution">
                    <div className="problem">
                      <strong>Problem:</strong> {useCase.problem}
                    </div>
                    <div className="solution">
                      <strong>Solution:</strong> {useCase.solution}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="navigation-buttons">
              <button className="prev-btn" onClick={() => setCurrentStep(0)}>
                ← Previous
              </button>
              <button className="next-btn" onClick={() => setCurrentStep(2)}>
                Next: The Solution →
              </button>
            </div>
          </section>
        )}

        {currentStep === 2 && (
          <section className="solution-overview">
            <h1>How Trustless Voting Solves This</h1>

            <div className="solution-features">
              <div className="feature">
                <div className="feature-icon">[ENC]</div>
                <h3>End-to-End Encryption</h3>
                <p>Your vote is encrypted before it leaves your device using Curve25519-XSalsa20-Poly1305</p>
              </div>

              <div className="feature">
                <div className="feature-icon">[SIG]</div>
                <h3>Cryptographic Signatures</h3>
                <p>Every action is signed with Ed25519, creating an unforgeable audit trail</p>
              </div>

              <div className="feature">
                <div className="feature-icon">[MRK]</div>
                <h3>Merkle Tree Verification</h3>
                <p>Votes are organized in a cryptographic tree structure for efficient verification</p>
              </div>

              <div className="feature">
                <div className="feature-icon">[ZKP]</div>
                <h3>Zero-Knowledge Proofs</h3>
                <p>Prove your vote was counted without revealing how you voted (Groth16 zk-SNARKs)</p>
              </div>

              <div className="feature">
                <div className="feature-icon">[BCH]</div>
                <h3>Blockchain Anchoring</h3>
                <p>Vote batches are anchored to public blockchains for immutable timestamping</p>
              </div>

              <div className="feature">
                <div className="feature-icon">[KEY]</div>
                <h3>Threshold Cryptography</h3>
                <p>No single authority can decrypt results - requires 3 of 5 key holders (Shamir Secret Sharing)</p>
              </div>
            </div>

            <div className="security-guarantee">
              <h2>The Guarantee</h2>
              <p>
                With Trustless Voting, you receive a cryptographic receipt that proves your vote was included 
                in the tally. Anyone can verify the election integrity without compromising voter privacy. 
                The mathematics makes it impossible to tamper with votes without detection.
              </p>
            </div>

            <div className="navigation-buttons">
              <button className="prev-btn" onClick={() => setCurrentStep(1)}>
                ← Previous
              </button>
              <button className="next-btn" onClick={() => setCurrentStep(3)}>
                Next: See 2024 Verified →
              </button>
            </div>
          </section>
        )}

        {currentStep === 3 && (
          <section className="demo-section">
            <h1>See How It Would Have Worked</h1>
            <p className="intro">
              This demonstration shows how the 2024 election could have been verified in real-time 
              with cryptographic proof. This is <strong>not</strong> claiming anything untoward happened - 
              it's showing how our system would have provided <strong>proof</strong> that results were accurate.
            </p>

            <div className="demo-options">
              <Link to="/election-2024-player" className="demo-card primary">
                <h2>2024 Election Playback</h2>
                <p>Watch county-by-county tallying with cryptographic verification</p>
                <span className="demo-badge">Interactive</span>
              </Link>

              <Link to="/poll-demo" className="demo-card">
                <h2>Try It Yourself: Live Poll</h2>
                <p>Cast a real vote and get your cryptographic receipt</p>
                <span className="demo-badge">Hands-On</span>
              </Link>

              <Link to="/crypto-demo" className="demo-card">
                <h2>Deep Dive: Cryptography</h2>
                <p>Explore the underlying cryptographic operations</p>
                <span className="demo-badge">Technical</span>
              </Link>
            </div>

            <div className="navigation-buttons">
              <button className="prev-btn" onClick={() => setCurrentStep(2)}>
                ← Previous
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
