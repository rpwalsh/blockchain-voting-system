/**
 * Validation Utility Tests
 * Tests for input validation and sanitization
 */

import {
  sanitizeString,
  sanitizeHTML,
  isValidUUID,
  detectSuspiciousInput,
  checkRateLimit,
  electionSchema,
  voterRegistrationSchema,
  voteSchema,
  adminLoginSchema,
  statusChangeSchema,
  tallySchema,
} from '../../utils/validation';

// Mock audit utility
jest.mock('../../utils/audit', () => ({
  createSecurityEvent: jest.fn(),
  SecuritySeverity: {
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW',
  },
}));

describe('Validation Utilities', () => {
  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('should remove null bytes', () => {
      expect(sanitizeString('hello\0world')).toBe('helloworld');
    });

    it('should escape HTML', () => {
      const result = sanitizeString('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;');
    });

    it('should limit length', () => {
      const longString = 'a'.repeat(1000);
      expect(sanitizeString(longString, 100).length).toBe(100);
    });

    it('should throw for non-string input', () => {
      expect(() => sanitizeString(123 as any)).toThrow('Input must be a string');
    });

    it('should normalize unicode', () => {
      // Combined character vs decomposed
      const combined = '\u00e9'; // é
      const decomposed = 'e\u0301'; // e + combining accent
      expect(sanitizeString(combined)).toBe(sanitizeString(decomposed));
    });
  });

  describe('sanitizeHTML', () => {
    it('should strip scripts', () => {
      const result = sanitizeHTML('<script>alert("xss")</script>');
      expect(result).not.toContain('script');
      expect(result).not.toContain('alert');
    });

    it('should escape HTML tags', () => {
      const result = sanitizeHTML('<div onclick="evil()">content</div>');
      // DOMPurify removes disallowed tags entirely
      expect(result).toBe('content');
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUID', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should reject invalid UUID', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
    });

    it('should reject UUID with wrong format', () => {
      expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false);
    });
  });

  describe('detectSuspiciousInput', () => {
    it('should detect SQL injection patterns', async () => {
      const result = await detectSuspiciousInput(
        { query: 'SELECT * FROM users' },
        { ip: '127.0.0.1', action: 'test' }
      );
      expect(result).toBe(true);
    });

    it('should detect XSS patterns', async () => {
      const result = await detectSuspiciousInput(
        { input: '<script>alert("xss")</script>' },
        { ip: '127.0.0.1', action: 'test' }
      );
      expect(result).toBe(true);
    });

    it('should detect javascript: URI', async () => {
      const result = await detectSuspiciousInput(
        { url: 'javascript:alert(1)' },
        { ip: '127.0.0.1', action: 'test' }
      );
      expect(result).toBe(true);
    });

    it('should detect path traversal', async () => {
      const result = await detectSuspiciousInput(
        { path: '../../../etc/passwd' },
        { ip: '127.0.0.1', action: 'test' }
      );
      expect(result).toBe(true);
    });

    it('should allow safe input', async () => {
      const result = await detectSuspiciousInput(
        { name: 'John Doe', age: 25 },
        { ip: '127.0.0.1', action: 'test' }
      );
      expect(result).toBe(false);
    });

    it('should detect DROP TABLE', async () => {
      const result = await detectSuspiciousInput(
        { comment: 'DROP TABLE users' },
        { ip: '127.0.0.1', action: 'test' }
      );
      expect(result).toBe(true);
    });

    it('should detect event handlers', async () => {
      const result = await detectSuspiciousInput(
        { html: '<img onerror=alert(1)>' },
        { ip: '127.0.0.1', action: 'test' }
      );
      expect(result).toBe(true);
    });
  });

  describe('checkRateLimit', () => {
    beforeEach(() => {
      // Clear rate limit store between tests
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should allow requests under limit', () => {
      const key = 'test-key-1';
      expect(checkRateLimit(key, 5, 60000)).toBe(false);
      expect(checkRateLimit(key, 5, 60000)).toBe(false);
      expect(checkRateLimit(key, 5, 60000)).toBe(false);
    });

    it('should block requests over limit', () => {
      const key = 'test-key-2';
      for (let i = 0; i < 10; i++) {
        checkRateLimit(key, 5, 60000);
      }
      expect(checkRateLimit(key, 5, 60000)).toBe(true);
    });

    it('should reset after window expires', () => {
      const key = 'test-key-3';
      for (let i = 0; i < 5; i++) {
        checkRateLimit(key, 5, 60000);
      }
      expect(checkRateLimit(key, 5, 60000)).toBe(true);
      
      // Advance time past window
      jest.advanceTimersByTime(70000);
      
      expect(checkRateLimit(key, 5, 60000)).toBe(false);
    });
  });

  describe('electionSchema', () => {
    it('should validate valid election', () => {
      const futureDate = new Date(Date.now() + 86400000);
      const endDate = new Date(Date.now() + 172800000);
      
      const { error } = electionSchema.validate({
        name: 'Test Election',
        description: 'A test election',
        startDate: futureDate.toISOString(),
        endDate: endDate.toISOString(),
        candidates: [
          { name: 'Candidate A', party: 'Party A' },
          { name: 'Candidate B', party: 'Party B' },
        ],
      });
      expect(error).toBeUndefined();
    });

    it('should reject election with too few candidates', () => {
      const { error } = electionSchema.validate({
        name: 'Test Election',
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 172800000).toISOString(),
        candidates: [{ name: 'Only One' }],
      });
      expect(error).toBeDefined();
      expect(error!.message).toContain('at least 2 candidates');
    });

    it('should reject invalid name characters', () => {
      const { error } = electionSchema.validate({
        name: 'Test<script>Election',
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 172800000).toISOString(),
        candidates: [
          { name: 'A' },
          { name: 'B' },
        ],
      });
      expect(error).toBeDefined();
    });
  });

  describe('voterRegistrationSchema', () => {
    it('should validate valid registration', () => {
      const { error } = voterRegistrationSchema.validate({
        electionId: '550e8400-e29b-41d4-a716-446655440000',
        voterId: 'voter12345',
        voterData: { county: 'Test County' },
      });
      expect(error).toBeUndefined();
    });

    it('should reject invalid election ID', () => {
      const { error } = voterRegistrationSchema.validate({
        electionId: 'not-a-uuid',
        voterId: 'voter12345',
      });
      expect(error).toBeDefined();
    });

    it('should reject short voter ID', () => {
      const { error } = voterRegistrationSchema.validate({
        electionId: '550e8400-e29b-41d4-a716-446655440000',
        voterId: 'ab',
      });
      expect(error).toBeDefined();
    });
  });

  describe('voteSchema', () => {
    it('should validate valid vote', () => {
      const { error } = voteSchema.validate({
        electionId: '550e8400-e29b-41d4-a716-446655440000',
        votingToken: 'dGVzdHRva2VuMTIzNDU2Nzg5MA==',
        candidateId: '550e8400-e29b-41d4-a716-446655440001',
      });
      expect(error).toBeUndefined();
    });

    it('should reject invalid token format', () => {
      const { error } = voteSchema.validate({
        electionId: '550e8400-e29b-41d4-a716-446655440000',
        votingToken: 'invalid token with spaces!',
        candidateId: '550e8400-e29b-41d4-a716-446655440001',
      });
      expect(error).toBeDefined();
    });
  });

  describe('adminLoginSchema', () => {
    it('should validate valid login', () => {
      const { error } = adminLoginSchema.validate({
        username: 'admin_user',
        password: 'SecurePassword123!',
        mfaCode: '123456',
      });
      expect(error).toBeUndefined();
    });

    it('should reject short password', () => {
      const { error } = adminLoginSchema.validate({
        username: 'admin',
        password: 'short',
      });
      expect(error).toBeDefined();
      expect(error!.message).toContain('at least 12 characters');
    });

    it('should reject invalid username characters', () => {
      const { error } = adminLoginSchema.validate({
        username: 'admin@user',
        password: 'SecurePassword123!',
      });
      expect(error).toBeDefined();
    });
  });

  describe('statusChangeSchema', () => {
    it('should validate valid status', () => {
      const { error } = statusChangeSchema.validate({ status: 'VOTING' });
      expect(error).toBeUndefined();
    });

    it('should reject invalid status', () => {
      const { error } = statusChangeSchema.validate({ status: 'INVALID' });
      expect(error).toBeDefined();
    });
  });

  describe('tallySchema', () => {
    it('should validate valid tally request', () => {
      const { error } = tallySchema.validate({
        privateKey: 'dGVzdHByaXZhdGVrZXk=',
      });
      expect(error).toBeUndefined();
    });

    it('should reject invalid private key format', () => {
      const { error } = tallySchema.validate({
        privateKey: 'invalid key with spaces!',
      });
      expect(error).toBeDefined();
    });
  });
});
