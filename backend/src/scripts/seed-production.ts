/**
 * SPDX-License-Identifier: LicenseRef-Proprietary
 * Copyright (c) 2026 blockchain-voting-system.
 * Proprietary and confidential. Unauthorized use, copying, or distribution is prohibited.
 *
 * PRODUCTION SEED SCRIPT
 * ======================
 * Creates production-ready demo data:
 * - 1 Organization (US Federal Government)
 * - 1 Admin user with login credentials
 * - 1 Presidential election with 5 candidates
 * - 1000 geographically distributed votes
 * 
 * Run: npx tsx src/scripts/seed-production.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from '../crypto/engine';

const prisma = new PrismaClient();

// Battleground states with counties
const GEOGRAPHIC_DATA = {
  PA: { name: 'Pennsylvania', counties: ['Philadelphia', 'Allegheny', 'Montgomery', 'Bucks', 'Delaware'], districts: ['PA-01', 'PA-02', 'PA-03', 'PA-04', 'PA-05'] },
  GA: { name: 'Georgia', counties: ['Fulton', 'Gwinnett', 'Cobb', 'DeKalb', 'Clayton'], districts: ['GA-01', 'GA-02', 'GA-03', 'GA-04', 'GA-05'] },
  AZ: { name: 'Arizona', counties: ['Maricopa', 'Pima', 'Pinal', 'Yuma', 'Mohave'], districts: ['AZ-01', 'AZ-02', 'AZ-03', 'AZ-04', 'AZ-05'] },
  MI: { name: 'Michigan', counties: ['Wayne', 'Oakland', 'Macomb', 'Kent', 'Genesee'], districts: ['MI-01', 'MI-02', 'MI-03', 'MI-04', 'MI-05'] },
  WI: { name: 'Wisconsin', counties: ['Milwaukee', 'Dane', 'Waukesha', 'Brown', 'Racine'], districts: ['WI-01', 'WI-02', 'WI-03', 'WI-04', 'WI-05'] },
  NV: { name: 'Nevada', counties: ['Clark', 'Washoe', 'Carson City', 'Lyon', 'Elko'], districts: ['NV-01', 'NV-02', 'NV-03', 'NV-04'] },
  NC: { name: 'North Carolina', counties: ['Mecklenburg', 'Wake', 'Guilford', 'Forsyth', 'Cumberland'], districts: ['NC-01', 'NC-02', 'NC-03', 'NC-04', 'NC-05'] }
};

async function main() {
  console.log('🗳️  PRODUCTION SEED - Trustless Voting Platform\n');
  
  // 1. Create Organization
  console.log('📋 Creating organization...');
  const keyPair = crypto.generateKeyPair();
  const apiKey = crypto.generateChallenge(); // Random API key
  
  const org = await prisma.organization.upsert({
    where: { slug: 'us-fec' },
    update: {},
    create: {
      name: 'US Federal Election Commission',
      slug: 'us-fec',
      type: 'FEDERAL',
      tier: 'UNLIMITED',
      status: 'ACTIVE',
      primaryContact: 'admin@fec.gov',
      email: 'contact@fec.gov',
      phone: '+1-202-694-1000',
      website: 'https://www.fec.gov',
      publicKey: keyPair.publicKey,
      apiKey,
      maxVoters: 1000000,
      monthlyVoters: 0
    }
  });
  console.log(`✅ Organization created: ${org.name}`);
  
  // 2. Create Admin User
  console.log('\n👤 Creating admin user...');
  const adminPassword = 'Admin123!'; // Change in production!
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const adminKeyPair = crypto.generateKeyPair();
  
  const admin = await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: org.id,
        email: 'admin@blockchain-voting-system.com',
      },
    },
    update: {
      passwordHash,
      publicKey: adminKeyPair.publicKey,
    },
    create: {
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
  console.log(`   ⚠️  CHANGE THIS PASSWORD IN PRODUCTION!`);
  
  // 3. Create Election
  console.log('\n🗳️  Creating election...');
  const electionKeyPair = crypto.generateKeyPair();
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-12-31');
  const privateKeyHash = crypto.hashVotingToken(electionKeyPair.privateKey); // SHA3-256
  
  const election = await prisma.election.create({
    data: {
      organizationId: org.id,
      name: '2024 U.S. Presidential Election',
      description: 'Demo election with 1000 votes across 7 battleground states',
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
  console.log(`✅ Election created: ${election.name} (ID: ${election.id})`);
  
  // 4. Create Candidates
  console.log('\n🎯 Creating candidates...');
  const candidates = [
    { name: 'Donald J. Trump', party: 'Republican', color: '#E81B23', weight: 1.0, order: 0 },
    { name: 'Kamala Harris', party: 'Democrat', color: '#0015BC', weight: 1.0, order: 1 },
    { name: 'Robert F. Kennedy Jr.', party: 'Independent', color: '#FFA500', weight: 1.0, order: 2 },
    { name: 'Jill Stein', party: 'Green', color: '#17aa5c', weight: 1.0, order: 3 },
    { name: 'Chase Oliver', party: 'Libertarian', color: '#FED105', weight: 1.0, order: 4 }
  ];
  
  const createdCandidates = [];
  for (const candidate of candidates) {
    const c = await prisma.candidate.create({
      data: {
        electionId: election.id,
        ...candidate
      }
    });
    createdCandidates.push(c);
    console.log(`  ✅ ${c.name} (${c.party})`);
  }
  
  // 5. Create 1000 Voters and Votes
  console.log('\n📊 Creating 1000 votes with geographic distribution...');
  const states = Object.keys(GEOGRAPHIC_DATA);
  const voteCounts = { Trump: 0, Harris: 0, Kennedy: 0, Stein: 0, Oliver: 0 };
  
  for (let i = 0; i < 1000; i++) {
    // Random state and county
    const state = states[i % states.length];
    const stateData = GEOGRAPHIC_DATA[state as keyof typeof GEOGRAPHIC_DATA];
    const county = stateData.counties[i % stateData.counties.length];
    const district = stateData.districts[i % stateData.districts.length];
    
    // Generate voter identity
    const voterId = `VOTER_${i.toString().padStart(4, '0')}`;
    const salt = crypto.generateChallenge();
    const identityHash = crypto.createIdentityHash(voterId, salt);
    const votingToken = crypto.generateChallenge();
    const votingTokenHash = crypto.hashVotingToken(votingToken);
    const voterKeyPair = crypto.generateKeyPair();
    
    // Geographic metadata
    const metadata = JSON.stringify({
      state,
      stateName: stateData.name,
      county,
      district,
      lat: 40.0 + Math.random() * 10 - 5,
      lng: -80.0 + Math.random() * 20 - 10
    });
    
    // Create voter
    const voter = await prisma.voter.create({
      data: {
        electionId: election.id,
        identityHash,
        votingTokenHash,
        publicKey: voterKeyPair.publicKey,
        registrationProof: crypto.generateChallenge(), // Simplified for demo
        hasVoted: true,
        votedAt: new Date(Date.now() - Math.random() * 86400000 * 30), // Random time in last 30 days
        metadata
      }
    });
    
    const voteTimestamp = voter.votedAt || new Date();
    
    // Select candidate (weighted distribution: Trump 51%, Harris 47%, Others 2%)
    let selected;
    const rand = Math.random();
    if (rand < 0.51) {
      selected = createdCandidates[0]; // Trump
      voteCounts.Trump++;
    } else if (rand < 0.98) {
      selected = createdCandidates[1]; // Harris
      voteCounts.Harris++;
    } else if (rand < 0.99) {
      selected = createdCandidates[2]; // Kennedy
      voteCounts.Kennedy++;
    } else if (rand < 0.995) {
      selected = createdCandidates[3]; // Stein
      voteCounts.Stein++;
    } else {
      selected = createdCandidates[4]; // Oliver
      voteCounts.Oliver++;
    }
    
    // Encrypt vote
    const voteData = { candidateId: selected.id, timestamp: Date.now() };
    const encryptedVote = crypto.encryptVote(JSON.stringify(voteData), election.publicKey);
    
    // Generate receipt and merkle proof
    const receiptData = {
      electionId: election.id,
      votingToken: votingTokenHash,
      candidateId: selected.id,
      timestamp: voteTimestamp
    };
    const receiptHash = crypto.createReceiptHash(JSON.stringify(receiptData));
    const ledgerEntryHash = crypto.generateChallenge();
    const merkleProof = JSON.stringify({ path: [], siblings: [] }); // Simplified for demo
    
    // Create vote
    await prisma.vote.create({
      data: {
        electionId: election.id,
        candidateId: selected.id,
        encryptedVote: JSON.stringify(encryptedVote),
        votingTokenHash,
        voteProof: '{}', // Simplified ZK proof
        receiptHash,
        ledgerEntryHash,
        merkleRoot: crypto.generateChallenge(),
        merkleProof,
        dagParents: metadata, // Store geographic data here
        ledgerTimestamp: voteTimestamp
      }
    });
    
    if ((i + 1) % 100 === 0) {
      console.log(`  ✅ ${i + 1}/1000 votes created`);
    }
  }
  
  console.log('\n📈 Vote distribution:');
  console.log(`  🔴 Trump (R): ${voteCounts.Trump} (${(voteCounts.Trump / 10).toFixed(1)}%)`);
  console.log(`  🔵 Harris (D): ${voteCounts.Harris} (${(voteCounts.Harris / 10).toFixed(1)}%)`);
  console.log(`  🟠 Kennedy (I): ${voteCounts.Kennedy} (${(voteCounts.Kennedy / 10).toFixed(1)}%)`);
  console.log(`  🟢 Stein (G): ${voteCounts.Stein} (${(voteCounts.Stein / 10).toFixed(1)}%)`);
  console.log(`  🟡 Oliver (L): ${voteCounts.Oliver} (${(voteCounts.Oliver / 10).toFixed(1)}%)`);
  
  // 6. Create Tally Results
  console.log('\n📊 Creating tally results...');
  for (const candidate of createdCandidates) {
    const voteCount = Object.entries(voteCounts).find(([name]) => 
      candidate.name.includes(name.split(' ')[0])
    )?.[1] || 0;
    
    await prisma.tallyResult.create({
      data: {
        electionId: election.id,
        candidateId: candidate.id,
        voteCount,
        percentage: (voteCount / 1000) * 100,
        proof: crypto.generateChallenge(),
        merkleRoot: crypto.generateChallenge()
      }
    });
  }
  console.log('✅ Tally results created');
  
  console.log('\n🎉 PRODUCTION SEED COMPLETE!\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('📋 IMPORTANT INFORMATION:');
  console.log('═══════════════════════════════════════════════════════');
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
  console.log(`   Total Votes: 1000`);
  console.log('');
  console.log(`🎬 Demo URL:`);
  console.log(`   http://localhost:5173/player/${election.id}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
