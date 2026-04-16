import express from 'express';
import { config } from './config';
import routes from './routes/index';
import { errorHandler } from './middleware/errorHandler';
import { apiKeyAuth } from './middleware/apiKeyAuth';

export function createApp(): express.Application {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use(config.apiPrefix, apiKeyAuth, routes);

  app.use(errorHandler);

  return app;
}
