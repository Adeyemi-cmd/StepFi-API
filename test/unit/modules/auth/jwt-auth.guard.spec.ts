import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../src/common/guards/jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  const validUser = { wallet: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW' };

  // ---------------------------------------------------------------------------
  // handleRequest
  // ---------------------------------------------------------------------------
  describe('handleRequest', () => {
    it('should return the user when token is valid', () => {
      const result = guard.handleRequest(null, validUser, null);
      expect(result).toEqual(validUser);
    });

    it('should throw UnauthorizedException (AUTH_TOKEN_EXPIRED) when token is expired', () => {
      const expiredInfo = { name: 'TokenExpiredError', message: 'jwt expired' };

      expect(() => guard.handleRequest(null, null, expiredInfo)).toThrow(UnauthorizedException);
      expect(() => guard.handleRequest(null, null, expiredInfo)).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'AUTH_TOKEN_EXPIRED' }),
        }),
      );
    });

    it('should throw UnauthorizedException (AUTH_TOKEN_INVALID) when user is null (missing/invalid token)', () => {
      expect(() => guard.handleRequest(null, null, null)).toThrow(UnauthorizedException);
      expect(() => guard.handleRequest(null, null, null)).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'AUTH_TOKEN_INVALID' }),
        }),
      );
    });

    it('should throw UnauthorizedException (AUTH_TOKEN_INVALID) when err is set', () => {
      const error = new Error('Strategy error');

      expect(() => guard.handleRequest(error, null, null)).toThrow(UnauthorizedException);
      expect(() => guard.handleRequest(error, null, null)).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'AUTH_TOKEN_INVALID' }),
        }),
      );
    });

    it('should throw UnauthorizedException (AUTH_TOKEN_INVALID) when token has invalid signature (JsonWebTokenError)', () => {
      const invalidInfo = { name: 'JsonWebTokenError', message: 'invalid signature' };

      expect(() => guard.handleRequest(null, null, invalidInfo)).toThrow(UnauthorizedException);
      expect(() => guard.handleRequest(null, null, invalidInfo)).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'AUTH_TOKEN_INVALID' }),
        }),
      );
    });

    it('should not treat a non-expired jwt error as AUTH_TOKEN_EXPIRED', () => {
      const malformedInfo = { name: 'JsonWebTokenError', message: 'malformed token' };

      try {
        guard.handleRequest(null, null, malformedInfo);
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(UnauthorizedException);
        expect((e as UnauthorizedException).getResponse()).toEqual(
          expect.objectContaining({ code: 'AUTH_TOKEN_INVALID' }),
        );
      }
    });
  });
});
