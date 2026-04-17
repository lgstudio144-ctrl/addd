import { createApp } from './app';
import { config } from './config';
import { seedStore } from './seeder';
import { spaasCatalog } from './seeds/spaas';

// Pre-load the Spaas product catalog so every known Spaas barcode resolves
// immediately when scanned via the scanner or camera endpoint.
seedStore(spaasCatalog);

const app = createApp();

app.listen(config.port, () => {
  console.log(`[server] running in ${config.nodeEnv} mode on http://localhost:${config.port}`);
});
