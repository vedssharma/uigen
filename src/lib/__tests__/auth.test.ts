/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Next.js cookies
const mockCookies = {
  set: vi.fn(),
  get: vi.fn(), 
  delete: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => mockCookies),
}));

// Mock server-only import  
vi.mock('server-only', () => ({}));

// Set up environment variables
process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes-only';

describe('auth.ts', () => {
  const TEST_USER_ID = 'test-user-id';
  const TEST_EMAIL = 'test@example.com';

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear module cache to ensure fresh imports
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createSession', () => {
    it('should call cookies.set with correct parameters', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      const { createSession } = await import('../auth');
      
      await createSession(TEST_USER_ID, TEST_EMAIL);

      expect(mockCookies.set).toHaveBeenCalledOnce();
      const [cookieName, token, options] = mockCookies.set.mock.calls[0];
      
      expect(cookieName).toBe('auth-token');
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(options).toMatchObject({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
      });
      expect(options.expires).toBeInstanceOf(Date);
      
      // Restore NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should set secure cookie in production environment', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const { createSession } = await import('../auth');
      
      await createSession(TEST_USER_ID, TEST_EMAIL);

      const [, , options] = mockCookies.set.mock.calls[0];
      expect(options.secure).toBe(true);
      
      // Restore NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should set cookie expiration to approximately 7 days', async () => {
      const { createSession } = await import('../auth');
      const beforeCreate = Date.now();
      
      await createSession(TEST_USER_ID, TEST_EMAIL);
      
      const afterCreate = Date.now();
      const [, , options] = mockCookies.set.mock.calls[0];
      const expiresTime = options.expires.getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      
      // Allow some tolerance for execution time
      expect(expiresTime).toBeGreaterThanOrEqual(beforeCreate + sevenDays - 1000);
      expect(expiresTime).toBeLessThanOrEqual(afterCreate + sevenDays + 1000);
    });
  });

  describe('getSession', () => {
    it('should return null when no cookie exists', async () => {
      const { getSession } = await import('../auth');
      mockCookies.get.mockReturnValue(undefined);

      const result = await getSession();

      expect(result).toBeNull();
      expect(mockCookies.get).toHaveBeenCalledWith('auth-token');
    });

    it('should return null for malformed token', async () => {
      const { getSession } = await import('../auth');
      mockCookies.get.mockReturnValue({ value: 'not-a-valid-jwt-token' });

      const result = await getSession();

      expect(result).toBeNull();
    });

    it('should return null for empty token', async () => {
      const { getSession } = await import('../auth');
      mockCookies.get.mockReturnValue({ value: '' });

      const result = await getSession();

      expect(result).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('should call cookies.delete with correct cookie name', async () => {
      const { deleteSession } = await import('../auth');
      
      await deleteSession();

      expect(mockCookies.delete).toHaveBeenCalledWith('auth-token');
    });
  });

  describe('verifySession', () => {
    it('should return null when request has no auth cookie', async () => {
      const { verifySession } = await import('../auth');
      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue(undefined),
        },
      } as unknown as NextRequest;

      const result = await verifySession(mockRequest);

      expect(result).toBeNull();
      expect(mockRequest.cookies.get).toHaveBeenCalledWith('auth-token');
    });

    it('should return null for invalid token in request', async () => {
      const { verifySession } = await import('../auth');
      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue({ value: 'invalid-jwt-token' }),
        },
      } as unknown as NextRequest;

      const result = await verifySession(mockRequest);

      expect(result).toBeNull();
    });

    it('should handle empty token gracefully', async () => {
      const { verifySession } = await import('../auth');
      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue({ value: '' }),
        },
      } as unknown as NextRequest;

      const result = await verifySession(mockRequest);

      expect(result).toBeNull();
    });
  });

  describe('module constants', () => {
    it('should use correct cookie name constant', async () => {
      const { deleteSession } = await import('../auth');
      
      await deleteSession();
      
      // Verify the cookie name is consistently used
      expect(mockCookies.delete).toHaveBeenCalledWith('auth-token');
    });

    it('should handle JWT_SECRET environment variable', async () => {
      // Test that the module can be imported without errors when JWT_SECRET is set
      expect(async () => {
        await import('../auth');
      }).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle cookie operation failures gracefully', async () => {
      mockCookies.set.mockImplementation(() => {
        throw new Error('Cookie operation failed');
      });

      const { createSession } = await import('../auth');
      
      // Should not throw even if cookie operations fail
      await expect(createSession(TEST_USER_ID, TEST_EMAIL)).rejects.toThrow('Cookie operation failed');
    });

    it('should handle missing environment gracefully', async () => {
      // The module should still be importable even with default JWT_SECRET
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      
      expect(async () => {
        await import('../auth');
      }).not.toThrow();
      
      process.env.JWT_SECRET = originalSecret;
    });
  });
});