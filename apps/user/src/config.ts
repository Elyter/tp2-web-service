import { env, loadEnvFile } from '@recipes/config';

loadEnvFile();

export const config = {
  grpcUrl: `0.0.0.0:${env('USER_GRPC_PORT', '50051')}`,
  /** Shared with the gateway, which verifies the tokens (see `pnpm secret`) */
  jwtSecret: env('JWT_SECRET'),
  /** In dev mode, follows the port published by Compose (USER_DB_PORT) */
  mongoUrl: env(
    'USER_DB_URL',
    `mongodb://localhost:${env('USER_DB_PORT', '27018')}`,
  ),
  tokenTtl: env('TOKEN_TTL', '1h'),
};
