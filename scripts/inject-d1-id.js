import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const d1Id = (
  process.env.TELEMETRY_D1_DATABASE_ID ||
  process.env.D1_DATABASE_ID ||
  process.env.CLOUDFLARE_D1_DATABASE_ID ||
  process.env.D1_ID ||
  process.env.DATABASE_ID ||
  ''
).trim();

const fallbackId = '00000000-0000-0000-0000-000000000000';
const targetId = d1Id || fallbackId;

const replaceInFile = (relativeFilePath) => {
  const fullPath = path.resolve(repositoryRoot, relativeFilePath);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes('<YOUR_D1_DATABASE_ID>') || (d1Id && content.includes(fallbackId))) {
      content = content.replace(/<YOUR_D1_DATABASE_ID>/g, targetId);
      if (d1Id) {
        content = content.replace(new RegExp(fallbackId, 'g'), d1Id);
      }
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`Injected D1 database ID (${targetId}) into ${relativeFilePath}`);
    }
  }
};

replaceInFile('telemetry-worker/wrangler.toml');
replaceInFile('wrangler.toml');
