/** Read seed administrator credentials before any database changes occur. */
export function requireSeedAdminPassword(
  env: Record<string, string | undefined> = process.env,
): string {
  const password = env.ADMIN_PASSWORD;
  if (!password || password.length < 12 || /^(?:change[-_ ]?me|replace[-_ ]|redacted)/i.test(password)) {
    throw new Error('Set ADMIN_PASSWORD to a unique password of at least 12 characters before seeding.');
  }
  return password;
}
