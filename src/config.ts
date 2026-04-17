import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  apiPrefix: process.env['API_PREFIX'] ?? '/api/v1',
  apiKey: process.env['API_KEY'] ?? '',
  jwtSecret: process.env['JWT_SECRET'] ?? '',
};
