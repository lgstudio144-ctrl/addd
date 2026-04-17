import express from 'express';
import { config } from './config';
import routes from './routes/index';
import { errorHandler } from './middleware/errorHandler';
import { apiKeyAuth } from './middleware/apiKeyAuth';
import { jwtAuth } from './middleware/jwtAuth';

export function createApp(): express.Application {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Service-level API key guard (optional; disabled when API_KEY is unset).
  app.use(config.apiPrefix, apiKeyAuth);

  // Public routes: /health and /auth do not require a user JWT.
  app.use(`${config.apiPrefix}/health`, routes);
  app.use(`${config.apiPrefix}/auth`, routes);

  // Protected routes: everything else requires a valid JWT when JWT_SECRET is set.
  app.use(config.apiPrefix, jwtAuth, routes);

  app.use(errorHandler);

  return app;
}
