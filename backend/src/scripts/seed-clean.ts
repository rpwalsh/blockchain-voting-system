/**
 * SPDX-License-Identifier: LicenseRef-Proprietary
 * Copyright (c) 2026 blockchain-voting-system.
 * Proprietary and confidential. Unauthorized use, copying, or distribution is prohibited.
 *
 * PRODUCTION SEED SCRIPT
 * Clean database seed with proper CRUD operations
 * No shortcuts, no upserts, just proper CREATE operations
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from '../crypto/engine';

const prisma = new PrismaClient();

interface GeographicData {
  state: string;
  county: string;
  district: string;
  lat: number;
  lng: number;
}

const BATTLEGROUND_STATES: GeographicData[] = [
  // Pennsylvania
  { state: 'PA', county: 'Philadelphia', district: 'PA-01', lat: 39.9526, lng: -75.1652 },
  { state: 'PA', county: 'Allegheny', district: 'PA-12', lat: 40.4406, lng: -79.9959 },
  { state: 'PA', county: 'Montgomery', district: 'PA-04', lat: 40.1584, lng: -75.2735 },
  { state: 'PA', county: 'Bucks', district: 'PA-01', lat: 40.3382, lng: -75.1329 },
  // Georgia
  { state: 'GA', county: 'Fulton', district: 'GA-05', lat: 33.7490, lng: -84.3880 },
  { state: 'GA', county: 'Gwinnett', district: 'GA-07', lat: 33.9560, lng: -83.9780 },
  { state: 'GA', county: 'Cobb', district: 'GA-11', lat: 33.9605, lng: -84.5502 },
  // Arizona
  { state: 'AZ', county: 'Maricopa', district: 'AZ-01', lat: 33.4484, lng: -112.0740 },
  { state: 'AZ', county: 'Pima', district: 'AZ-03', lat: 32.2226, lng: -110.9747 },
  // Michigan
  { state: 'MI', county: 'Wayne', district: 'MI-13', lat: 42.3314, lng: -83.0458 },
  { state: 'MI', county: 'Oakland', district: 'MI-11', lat: 42.6389, lng: -83.2910 },
  // Wisconsin
  { state: 'WI', county: 'Milwaukee', district: 'WI-04', lat: 43.0389, lng: -87.9065 },
  { state: 'WI', county: 'Dane', district: 'WI-02', lat: 43.0731, lng: -89.4012 },
  // Nevada
  { state: 'NV', county: 'Clark', district: 'NV-01', lat: 36.1699, lng: -115.1398 },
  { state: 'NV', county: 'Washoe', district: 'NV-02', lat: 39.5296, lng: -119.8138 },
  // North Carolina
  { state: 'NC', county: 'Mecklenburg', district: 'NC-12', lat: 35.2271, lng: -80.8431 },
  { state: 'NC', county: 'Wake', district: 'NC-02', lat: 35.7796, lng: -78.6382 },
];

async function main() {
  console.log('\n🚀 PRODUCTION SEED - Trustless Voting Platform\n');

  // 0. DELETE ALL DATA (clean slate)
  console.log('🗑️  Cleaning database...');
  await prisma.ledgerEntry.deleteMany({});
  await prisma.tallyResult.deleteMany({});
  await prisma.vote.deleteMany({});
  await prisma.voter.deleteMany({});
  await prisma.candidate.deleteMany({});
  await prisma.election.deleteMany({});
  await prisma.securityEvent.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.organization.deleteMany({});
  console.log('✅ Database cleaned\n');

  // 1. CREATE Organization
  console.log('🏢 Creating organization...');
  const apiKey = crypto.generateChallenge(); // Random API key
  const orgKeyPair = crypto.generateKeyPair();
  
  const org = await prisma.organization.create({
    data: {
      name: 'US Federal Election Commission',
      slug: 'us-fec',
      type: 'FEDERAL',
      primaryContact: 'Director of Elections',
      email: 'elections@fec.gov',
      phone: '+1-202-694-1000',
      website: 'https://www.fec.gov',
      publicKey: orgKeyPair.publicKey,
      apiKey: crypto.hashVotingToken(apiKey)
    }
  });
  console.log(`✅ Organization created: ${org.name}`);

  // 2. CREATE Admin User
  console.log('\n👤 Creating admin user...');
  const adminPassword = 'Admin123!';
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const adminKeyPair = crypto.generateKeyPair();
  
  const admin = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'admin@blockchain-voting-system.com',
      username: 'admin',
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'ORG_ADMIN',
      publicKey: adminKeyPair.publicKey,
      isActive: true
    }
  });
  console.log(`✅ Admin user created: ${admin.email}`);
  console.log(`   📧 Email: ${admin.email}`);
  console.log(`   🔑 Password: ${adminPassword}`);
  console.log(`   🚨 CHANGE THIS PASSWORD IN PRODUCTION!`);

  // 3. CREATE Election
  console.log('\n🗳️  Creating election...');
  const startDate = new Date('2024-01-01T00:00:00Z');
  const endDate = new Date('2024-11-05T23:59:59Z');
  const electionKeyPair = crypto.generateKeyPair();
  const privateKeyHash = crypto.hashVotingToken(electionKeyPair.privateKey);
  
  const election = await prisma.election.create({
    data: {
      organizationId: org.id,
      name: '2024 U.S. Presidential Election',
      description: 'United States Presidential Election for the 2024-2028 term',
      type: 'FEDERAL',
      status: 'COMPLETED',
      startDate,
      endDate,
      publicKey: electionKeyPair.publicKey,
      privateKey: electionKeyPair.privateKey,
      privateKeyHash,
      allowAnonymous: true,
      requireId: true,
      multipleChoice: false,
      ranked: false,
      weighted: false
    }
  });
  console.log(`✅ Election created: ${election.name}`);
  console.log(`   ID: ${election.id}`);

  // 4. CREATE Candidates
  console.log('\n🎯 Creating candidates...');
  const candidateData = [
    { name: 'Donald J. Trump', party: 'Republican', color: '#E81B23', order: 0 },
    { name: 'Kamala Harris', party: 'Democrat', color: '#0015BC', order: 1 },
    { name: 'Robert F. Kennedy Jr.', party: 'Independent', color: '#FFA500', order: 2 },
    { name: 'Jill Stein', party: 'Green', color: '#17aa5c', order: 3 },
    { name: 'Chase Oliver', party: 'Libertarian', color: '#FED105', order: 4 }
  ];
  
  const candidates = [];
  for (const data of candidateData) {
    const candidate = await prisma.candidate.create({
      data: {
        electionId: election.id,
        name: data.name,
        party: data.party,
        weight: 1.0,
        order: data.order,
        metadata: JSON.stringify({ color: data.color })
      }
    });
    candidates.push(candidate);
    console.log(`  ✅ ${candidate.name} (${candidate.party})`);
  }

  // 5. CREATE Voters and Votes
  console.log('\n🗳️  Creating 1000 voters and votes...');
  console.log('This will take about 30 seconds...\n');
  
  const voteCount = 1000;
  let voteResults: { [key: string]: number } = {};
  candidates.forEach(c => voteResults[c.id] = 0);

  for (let i = 0; i < voteCount; i++) {
    // Select random location
    const location = BATTLEGROUND_STATES[i % BATTLEGROUND_STATES.length];
    
    // Generate voter identity
    const voterId = `VOTER-${i.toString().padStart(6, '0')}`;
    const identityHash = crypto.createIdentityHash(voterId, crypto.generateChallenge());
    const votingToken = crypto.generateChallenge();
    const votingTokenHash = crypto.hashVotingToken(votingToken);
    const voterKeyPair = crypto.generateKeyPair();
    
    // CREATE Voter (don't store token - only hash)
    const voter = await prisma.voter.create({
      data: {
        electionId: election.id,
        identityHash,
        votingTokenHash, // Only store hash
        publicKey: voterKeyPair.publicKey,
        registrationProof: JSON.stringify({ verified: true, timestamp: new Date().toISOString() }),
        hasVoted: false
      }
    });

    // Select candidate (weighted distribution)
    let selectedCandidate;
    const rand = Math.random();
    if (rand < 0.51) {
      selectedCandidate = candidates[0]; // Trump 51%
    } else if (rand < 0.98) {
      selectedCandidate = candidates[1]; // Harris 47%
    } else if (rand < 0.99) {
      selectedCandidate = candidates[2]; // RFK 1%
    } else if (rand < 0.995) {
      selectedCandidate = candidates[3]; // Stein 0.5%
    } else {
      selectedCandidate = candidates[4]; // Oliver 0.5%
    }

    // Encrypt vote
    const voteData = {
      candidateId: selectedCandidate.id,
      candidateName: selectedCandidate.name,
      timestamp: new Date().toISOString()
    };
    const encryptedVote = crypto.encryptVote(JSON.stringify(voteData), election.publicKey);
    
    // Generate receipt
    const receiptData = {
      votingTokenHash,
      candidateId: selectedCandidate.id,
      timestamp: new Date().toISOString()
    };
    const receiptHash = crypto.createReceiptHash(JSON.stringify(receiptData));
    
    // CREATE Vote with geographic metadata
    const metadata = JSON.stringify({
      state: location.state,
      county: location.county,
      district: location.district,
      lat: location.lat,
      lng: location.lng
    });
    
    const ledgerEntryHash = crypto.createReceiptHash(`${receiptHash}-${new Date().toISOString()}`);
    const merkleRoot = crypto.createReceiptHash(`election-${election.id}-root`);
    
    const vote = await prisma.vote.create({
      data: {
        electionId: election.id,
        candidateId: selectedCandidate.id,
        votingTokenHash, // Link to voter via hash
        encryptedVote: JSON.stringify(encryptedVote),
        voteProof: JSON.stringify({ verified: true }),
        receiptHash,
        ledgerEntryHash,
        merkleRoot,
        merkleProof: JSON.stringify({ path: [], root: merkleRoot }),
        dagParents: metadata // Store geographic data here
      }
    });

    // UPDATE Voter to mark as voted
    await prisma.voter.update({
      where: { id: voter.id },
      data: {
        hasVoted: true,
        votedAt: new Date()
      }
    });

    voteResults[selectedCandidate.id]++;

    if ((i + 1) % 100 === 0) {
      console.log(`  ⏳ ${i + 1}/${voteCount} votes cast...`);
    }
  }

  console.log(`\n✅ All ${voteCount} votes cast successfully!`);

  // 6. CREATE Tally Results
  console.log('\n📊 Creating tally results...');
  
  for (const candidate of candidates) {
    const count = voteResults[candidate.id];
    const percentage = (count / voteCount) * 100;
    const tallyMerkleRoot = crypto.createReceiptHash(`tally-${election.id}-${candidate.id}`);
    
    await prisma.tallyResult.create({
      data: {
        electionId: election.id,
        candidateId: candidate.id,
        voteCount: count,
        percentage,
        proof: JSON.stringify({ merkleRoot: tallyMerkleRoot, valid: true }),
        merkleRoot: tallyMerkleRoot
      }
    });
    
    console.log(`  ✅ ${candidate.name}: ${count} votes (${percentage.toFixed(1)}%)`);
  }

  // 7. CREATE Ledger Entry
  console.log('\n📚 Creating ledger entry...');
  
  const ledgerData = {
    electionId: election.id,
    totalVotes: voteCount,
    results: voteResults,
    timestamp: new Date().toISOString()
  };
  const dataHash = crypto.createReceiptHash(JSON.stringify(ledgerData));
  
  await prisma.ledgerEntry.create({
    data: {
      electionId: election.id,
      entryType: 'TALLY',
      data: JSON.stringify(ledgerData),
      dataHash,
      previousEntryHash: null, // First entry
      signature: crypto.signData(dataHash, adminKeyPair.privateKey),
      signerPublicKey: adminKeyPair.publicKey
    }
  });
  
  console.log(`✅ Ledger entry created`);

  // Final Summary
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                    SEED COMPLETED SUCCESSFULLY                ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('\n📋 IMPORTANT INFORMATION:');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`🏢 Organization: ${org.name}`);
  console.log(`   Slug: ${org.slug}`);
  console.log(`   API Key: ${apiKey}`);
  console.log('');
  console.log(`👤 Admin Login:`);
  console.log(`   Email: ${admin.email}`);
  console.log(`   Password: ${adminPassword}`);
  console.log(`   🚨 CHANGE THIS IN PRODUCTION!`);
  console.log('');
  console.log(`🗳️  Election:`);
  console.log(`   ID: ${election.id}`);
  console.log(`   Name: ${election.name}`);
  console.log(`   Total Votes: ${voteCount}`);
  console.log('');
  console.log(`🎬 Demo URLs:`);
  console.log(`   Election Player: http://localhost:5173/player/${election.id}`);
  console.log(`   Admin Login: http://localhost:5173/login`);
  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
