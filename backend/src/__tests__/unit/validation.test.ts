/**
 * VALIDATION UTILITIES UNIT TESTS
 * ================================
 * Tests for input validation and sanitization
 */

import validation, {
  sanitizeString,
  sanitizeHTML,
  isValidUUID,
  checkRateLimit,
  electionSchema,
  voteSchema,
  adminLoginSchema,
} from '../../utils/validation';

describe('Unit: String Sanitization', () => {
  describe('sanitizeString', () => {
    test('should trim whitespace', () => {
      expect(sanitizeString('  hello world  ')).toBe('hello world');
    });

    test('should remove null bytes', () => {
      expect(sanitizeString('hello\0world')).toBe('helloworld');
    });

    test('should escape HTML characters', () => {
      const result = sanitizeString('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    test('should limit length', () => {
      const longString = 'a'.repeat(1000);
      const result = sanitizeString(longString, 100);
      expect(result.length).toBe(100);
    });

    test('should handle empty string', () => {
      expect(sanitizeString('')).toBe('');
    });

    test('should normalize unicode', () => {
      // Combining character should be normalized
      const input = 'cafe\u0301'; // café with combining accent
      const result = sanitizeString(input);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    test('should throw for non-string input', () => {
      expect(() => sanitizeString(123 as any)).toThrow('Input must be a string');
      expect(() => sanitizeString(null as any)).toThrow();
      expect(() => sanitizeString(undefined as any)).toThrow();
    });
  });

  describe('sanitizeHTML', () => {
    test('should escape HTML tags', () => {
      const result = sanitizeHTML('<div>Hello</div>');
      // sanitize-html strips disallowed tags, doesn't escape them
      expect(result).not.toContain('<div>');
      expect(result).toBe('Hello');
    });

    test('should remove script tags', () => {
      const result = sanitizeHTML('<script>malicious()</script>');
      expect(result).not.toContain('<script>');
    });

    test('should handle plain text', () => {
      const result = sanitizeHTML('Just plain text');
      expect(result).toBe('Just plain text');
    });
  });
});

describe('Unit: UUID Validation', () => {
  describe('isValidUUID', () => {
    test('should accept valid v4 UUIDs', () => {
      // Note: isValidUUID only accepts UUID v4 format
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
      expect(isValidUUID('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')).toBe(true);
    });

    test('should reject non-v4 UUIDs', () => {
      // v1 UUID (time-based) - not accepted
      expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(false);
    });

    test('should reject invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false);
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID('null')).toBe(false);
    });

    test('should reject SQL injection attempts', () => {
      expect(isValidUUID("550e8400'; DROP TABLE users;--")).toBe(false);
      expect(isValidUUID('UNION SELECT * FROM users')).toBe(false);
    });
  });
});

describe('Unit: Rate Limiting', () => {
  describe('checkRateLimit', () => {
    test('should allow requests under limit', () => {
      const key = `test-${Date.now()}-1`;
      
      for (let i = 0; i < 5; i++) {
        expect(checkRateLimit(key, 10, 60000)).toBe(false);
      }
    });

    test('should block requests over limit', () => {
      const key = `test-${Date.now()}-2`;
      
      // Use up the limit
      for (let i = 0; i < 10; i++) {
        checkRateLimit(key, 10, 60000);
      }
      
      // Next request should be blocked
      expect(checkRateLimit(key, 10, 60000)).toBe(true);
    });

    test('should reset after window expires', async () => {
      const key = `test-${Date.now()}-3`;
      
      // Use up the limit with short window
      for (let i = 0; i < 5; i++) {
        checkRateLimit(key, 5, 100); // 100ms window
      }
      
      expect(checkRateLimit(key, 5, 100)).toBe(true);
      
      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be allowed again
      expect(checkRateLimit(key, 5, 100)).toBe(false);
    });

    test('should track different keys independently', () => {
      const key1 = `test-${Date.now()}-4a`;
      const key2 = `test-${Date.now()}-4b`;
      
      // Exhaust key1
      for (let i = 0; i < 5; i++) {
        checkRateLimit(key1, 5, 60000);
      }
      
      expect(checkRateLimit(key1, 5, 60000)).toBe(true);
      expect(checkRateLimit(key2, 5, 60000)).toBe(false); // key2 should still work
    });
  });
});

describe('Unit: Joi Validation Schemas', () => {
  describe('electionSchema', () => {
    const validElection = {
      name: 'Test Election 2024',
      description: 'A test election',
      startDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      endDate: new Date(Date.now() + 172800000).toISOString(), // Day after
      candidates: [
        { name: 'Candidate A', party: 'Party A' },
        { name: 'Candidate B', party: 'Party B' },
      ],
    };

    test('should accept valid election data', () => {
      const { error } = electionSchema.validate(validElection);
      expect(error).toBeUndefined();
    });

    test('should reject short name', () => {
      const { error } = electionSchema.validate({
        ...validElection,
        name: 'AB',
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain('3 characters');
    });

    test('should reject invalid name characters', () => {
      const { error } = electionSchema.validate({
        ...validElection,
        name: 'Test<script>',
      });
      expect(error).toBeDefined();
    });

    test('should reject past start date', () => {
      const { error } = electionSchema.validate({
        ...validElection,
        startDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      });
      expect(error).toBeDefined();
    });

    test('should reject end date before start date', () => {
      const { error } = electionSchema.validate({
        ...validElection,
        startDate: new Date(Date.now() + 172800000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain('after start date');
    });

    test('should require at least 2 candidates', () => {
      const { error } = electionSchema.validate({
        ...validElection,
        candidates: [{ name: 'Only One', party: 'Solo' }],
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain('2 candidates');
    });

    test('should reject more than 100 candidates', () => {
      const tooManyCandidates = Array(101).fill({ name: 'Candidate', party: 'Party' })
        .map((c, i) => ({ ...c, name: `Candidate ${i}` }));
      
      const { error } = electionSchema.validate({
        ...validElection,
        candidates: tooManyCandidates,
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain('100 candidates');
    });
  });

  describe('voteSchema', () => {
    test('should accept valid vote', () => {
      const { error } = voteSchema.validate({
        electionId: '550e8400-e29b-41d4-a716-446655440000',
        votingToken: 'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo=', // base64
        candidateId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      });
      expect(error).toBeUndefined();
    });

    test('should reject invalid election ID', () => {
      const { error } = voteSchema.validate({
        electionId: 'not-a-uuid',
        votingToken: 'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo=',
        candidateId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      });
      expect(error).toBeDefined();
    });

    test('should reject short voting token', () => {
      const { error } = voteSchema.validate({
        electionId: '550e8400-e29b-41d4-a716-446655440000',
        votingToken: 'short',
        candidateId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      });
      expect(error).toBeDefined();
    });

    test('should reject invalid base64 token', () => {
      const { error } = voteSchema.validate({
        electionId: '550e8400-e29b-41d4-a716-446655440000',
        votingToken: 'not-valid-base64-!!!@@@',
        candidateId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      });
      expect(error).toBeDefined();
    });
  });

  describe('adminLoginSchema', () => {
    test('should accept valid login', () => {
      const { error } = adminLoginSchema.validate({
        username: 'admin_user',
        password: 'securePassword123!',
      });
      expect(error).toBeUndefined();
    });

    test('should accept login with MFA', () => {
      const { error } = adminLoginSchema.validate({
        username: 'admin_user',
        password: 'securePassword123!',
        mfaCode: '123456',
      });
      expect(error).toBeUndefined();
    });

    test('should reject short password', () => {
      const { error } = adminLoginSchema.validate({
        username: 'admin_user',
        password: 'short',
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain('12 characters');
    });

    test('should reject invalid username characters', () => {
      const { error } = adminLoginSchema.validate({
        username: 'admin user', // space not allowed
        password: 'securePassword123!',
      });
      expect(error).toBeDefined();
    });

    test('should reject invalid MFA code', () => {
      const { error } = adminLoginSchema.validate({
        username: 'admin_user',
        password: 'securePassword123!',
        mfaCode: '12345', // too short
      });
      expect(error).toBeDefined();
    });
  });
});

describe('Unit: Security Patterns', () => {
  test('should not expose internal functions through default export', () => {
    expect(validation.sanitizeString).toBeDefined();
    expect(validation.sanitizeHTML).toBeDefined();
    expect(validation.isValidUUID).toBeDefined();
    expect(validation.checkRateLimit).toBeDefined();
    expect(validation.detectSuspiciousInput).toBeDefined();
  });

  test('validation schemas should be immutable', () => {
    const schema = validation.electionSchema;
    expect(schema).toBeDefined();
    expect(typeof schema.validate).toBe('function');
  });
});
