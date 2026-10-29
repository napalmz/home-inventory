import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const d1Id = (process.env.TELEMETRY_D1_DATABASE_ID || process.env.D1_DATABASE_ID || '').trim();

if (d1Id) {
  const replaceInFile = (relativeFilePath) => {
    const fullPath = path.resolve(repositoryRoot, relativeFilePath);
    if (fs.existsSync(fullPath)) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('<YOUR_D1_DATABASE_ID>')) {
        content = content.replace(/<YOUR_D1_DATABASE_ID>/g, d1Id);
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Injected D1 database ID into ${relativeFilePath}`);
      }
    }
  };

  replaceInFile('telemetry-worker/wrangler.toml');
} else {
  console.log('No TELEMETRY_D1_DATABASE_ID or D1_DATABASE_ID environment variable found. Keeping wrangler.toml placeholder.');
}
