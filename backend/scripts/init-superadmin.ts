/**
 * DATABASE INITIALIZATION SCRIPT
 * ===============================
 * Creates Level 12 Super Admin account
 * Run once during initial setup
 * 
 * Usage: npx tsx scripts/init-superadmin.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import * as readline from 'readline';
import crypto from '../src/crypto/engine';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('\\n==============================================');
  console.log('  TRUSTLESS VOTING - LEVEL 12 SUPER ADMIN');
  console.log('  Initial Setup');
  console.log('==============================================\\n');
  
  // Check if super admin already exists
  const existing = await prisma.superAdmin.findFirst();
  if (existing) {
    console.log('Super Admin already exists!');
    const overwrite = await question('Overwrite? (yes/no): ');
    if (overwrite.toLowerCase() !== 'yes') {
      console.log('Setup cancelled.');
      process.exit(0);
    }
    await prisma.superAdmin.delete({ where: { id: existing.id } });
  }
  
  const username = await question('Username [admin]: ') || 'admin';
  const password = await question('Password (min 16 chars): ');
  
  if (password.length < 16) {
    console.log('Password must be at least 16 characters');
    process.exit(1);
  }
  
  console.log('\\nGenerating TOTP secret...');
  const totpSecret = crypto.generateChallenge().substring(0, 32);
  console.log(\TOTP Secret: \\);
  console.log('SAVE THIS - Add to your authenticator app\\n');
  
  const totpCode = await question('Enter 6-digit code from authenticator: ');
  if (!/^\\d{6}ASCII/.test(totpCode)) {
    console.log('Invalid TOTP code');
    process.exit(1);
  }
  
  console.log('\\nGenerating keys...');
  const keyPair = crypto.generateKeyPair();
  
  console.log('Hashing password...');
  const passwordHash = await bcrypt.hash(password, 12);
  
  await prisma.superAdmin.create({
    data: {
      username,
      passwordHash,
      totpSecret,
      publicKey: keyPair.publicKey,
      accessLog: JSON.stringify([{
        action: 'CREATED',
        timestamp: new Date().toISOString(),
      }]),
    },
  });
  
  console.log('\\n==============================================');
  console.log('Level 12 Super Admin Created!');
  console.log('==============================================');
  console.log(\Username: \\);
  console.log(\TOTP: \\);
  console.log(\Public Key: \\);
  console.log('\\nAll actions are audited. Use responsibly.');
  console.log('==============================================\\n');
  
  rl.close();
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.\();
  });
