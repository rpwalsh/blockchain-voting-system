import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { requireSeedAdminPassword } from '../src/utils/seed-credentials.ts';

test('requires an explicit seed administrator password', () => {
  assert.throws(() => requireSeedAdminPassword({}), /Set ADMIN_PASSWORD/);
  assert.throws(() => requireSeedAdminPassword({ ADMIN_PASSWORD: '' }), /Set ADMIN_PASSWORD/);
});

test('rejects short passwords and redaction/example placeholders', () => {
  for (const password of ['short', 'change-me-before-seeding', 'replace-with-a-password', 'REDACTED_USE_ENVIRONMENT_VARIABLE']) {
    assert.throws(() => requireSeedAdminPassword({ ADMIN_PASSWORD: password }), /Set ADMIN_PASSWORD/);
  }
});

test('preserves the supplied password without leaking it in validation errors', () => {
  const password = randomBytes(24).toString('base64url');
  assert.equal(requireSeedAdminPassword({ ADMIN_PASSWORD: password }), password);
  const rejected = randomBytes(4).toString('hex');
  assert.throws(() => requireSeedAdminPassword({ ADMIN_PASSWORD: rejected }), error => !error.message.includes(rejected));
});
