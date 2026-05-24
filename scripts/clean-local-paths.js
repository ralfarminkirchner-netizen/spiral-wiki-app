import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contentDir = path.resolve(__dirname, '../public/data-content');

// Match markdown image lines with local paths
const LOCAL_PATH_PATTERN = /!\[.*?\]\(\/(?:Users\/ralfkirchner|tmp)\/.+?\)/g;

let totalFiles = 0;
let modifiedFiles = 0;
let totalRemovals = 0;

const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.json'));

for (const file of files) {
  const filePath = path.join(contentDir, file);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  totalFiles++;

  if (!data.content) continue;

  const matches = data.content.match(LOCAL_PATH_PATTERN);
  if (!matches || matches.length === 0) continue;

  // Remove entire lines that contain the local path pattern
  const lines = data.content.split('\n');
  const cleanedLines = lines.filter(line => !LOCAL_PATH_PATTERN.test(line));
  // Reset regex lastIndex since we use 'g' flag
  LOCAL_PATH_PATTERN.lastIndex = 0;

  const newContent = cleanedLines.join('\n');
  if (newContent !== data.content) {
    data.content = newContent;
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
    modifiedFiles++;
    totalRemovals += matches.length;
    console.log(`  🧹 ${file}: ${matches.length} lokale Pfade entfernt`);
  }
}

console.log(`\n═══════════════════════════════════════════`);
console.log(`  📊 ${totalFiles} Dateien geprüft`);
console.log(`  ✏️  ${modifiedFiles} Dateien bereinigt`);
console.log(`  🗑️  ${totalRemovals} lokale Pfade entfernt`);
console.log(`═══════════════════════════════════════════`);
