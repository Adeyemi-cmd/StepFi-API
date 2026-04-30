import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

/** Access token lifetime: 15 minutes */
export const ACCESS_TOKEN_EXPIRATION = '15m';

/** Refresh token lifetime: 7 days */
export const REFRESH_TOKEN_EXPIRATION = '7d';

/** Access token lifetime in seconds (used in API response `expiresIn` field) */
export const ACCESS_TOKEN_EXPIRATION_SECONDS = 900;

/** Refresh token lifetime in milliseconds (used for session `expires_at` calculation) */
export const REFRESH_TOKEN_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Factory function for JwtModule.registerAsync.
 * Configures the default signing options for access tokens.
 * Refresh tokens use a separate secret and expiration overridden at sign time.
 */
export const getJwtConfig = (config: ConfigService): JwtModuleOptions => ({
  secret: config.get<string>('JWT_SECRET'),
  signOptions: { expiresIn: ACCESS_TOKEN_EXPIRATION },
});
