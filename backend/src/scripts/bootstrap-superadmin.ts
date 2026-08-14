/**
 * Creates the first SuperAdmin account out-of-band, with a real random
 * password generated on the machine running this script and printed
 * exactly once to stdout - never over HTTP, never stored in plaintext.
 *
 * This replaces the previous behavior in routes/auth.ts, where POSTing
 * {username: "admin", password: "admin"} to the public login endpoint
 * would silently create (or authenticate as) a level-12 super admin
 * account with that literal, publicly-known password. That was a real,
 * exploitable backdoor, not a demo shortcut - see the fix in
 * routes/auth.ts for the corrected login flow, which now only ever
 * bcrypt-compares against a real stored hash and never creates an account
 * as a side effect of a login attempt.
 *
 * Usage:
 *   npx tsx src/scripts/bootstrap-superadmin.ts <username>
 *
 * Refuses to run if a SuperAdmin with that username already exists -
 * rotate a password by other means (out of scope here), not by re-running
 * this script.
 */

import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import { PrismaClient } from '@prisma/client';
import crypto from '../crypto/engine';

const prisma = new PrismaClient();

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error('Usage: npx tsx src/scripts/bootstrap-superadmin.ts <username>');
    process.exit(1);
  }

  const existing = await prisma.superAdmin.findUnique({ where: { username } });
  if (existing) {
    console.error(`SuperAdmin "${username}" already exists. Refusing to overwrite.`);
    process.exit(1);
  }

  const password = randomBytes(24).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 12);
  const keyPair = crypto.generateKeyPair();

  // Real TOTP enrollment (speakeasy), not a placeholder - routes/superadmin.ts
  // enforces this secret with a real speakeasy.totp.verify() check now.
  const totp = speakeasy.generateSecret({ name: `blockchain-voting-system (${username})`, length: 20 });
  const totpSecret = totp.base32;
  const otpauthUrl = totp.otpauth_url!;

  const superAdmin = await prisma.superAdmin.create({
    data: {
      username,
      passwordHash,
      totpSecret,
      publicKey: keyPair.publicKey,
    },
  });

  console.log('SuperAdmin account created.');
  console.log(`  id:       ${superAdmin.id}`);
  console.log(`  username: ${username}`);
  console.log(`  password: ${password}`);
  console.log(`  totp secret: ${totpSecret}`);
  console.log(`  totp enrollment URI (scan with an authenticator app): ${otpauthUrl}`);
  console.log('The password and TOTP secret are shown once and are not recoverable from the database. Store them in a real secrets manager / authenticator app now.');
}

main()
  .catch(err => {
    console.error('Failed to bootstrap super admin:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
