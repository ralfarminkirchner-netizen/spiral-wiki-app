/**
 * Cleanup script: Remove local file paths from all content JSON files.
 * Replaces markdown image references like ![...](/Users/ralfkirchner/...) with empty strings.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contentDir = path.resolve(__dirname, '../public/data-content');

// Also check data.json (legacy)
const legacyFile = path.resolve(__dirname, '../public/data.json');

let totalFixed = 0;

// Pattern: ![any alt text](/Users/ralfkirchner/...any path...)
// This covers the full markdown image syntax with local paths
const LOCAL_IMAGE_REGEX = /!\[[^\]]*\]\(\/Users\/ralfkirchner\/[^)]*\)/g;

// Process all JSON files in data-content/
const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.json'));
console.log(`🔍 Scanning ${files.length} content files for local paths...`);

for (const file of files) {
  const filePath = path.join(contentDir, file);
  const raw = fs.readFileSync(filePath, 'utf-8');
  
  const matches = raw.match(LOCAL_IMAGE_REGEX);
  if (matches) {
    const cleaned = raw.replace(LOCAL_IMAGE_REGEX, '');
    fs.writeFileSync(filePath, cleaned, 'utf-8');
    console.log(`  ✅ ${file}: ${matches.length} lokale Pfade entfernt`);
    totalFixed += matches.length;
  }
}

// Also clean the legacy data.json
if (fs.existsSync(legacyFile)) {
  const raw = fs.readFileSync(legacyFile, 'utf-8');
  const matches = raw.match(LOCAL_IMAGE_REGEX);
  if (matches) {
    const cleaned = raw.replace(LOCAL_IMAGE_REGEX, '');
    fs.writeFileSync(legacyFile, cleaned, 'utf-8');
    console.log(`  ✅ data.json (legacy): ${matches.length} lokale Pfade entfernt`);
    totalFixed += matches.length;
  }
}

console.log(`\n✨ Fertig: ${totalFixed} lokale Bildpfade aus ${files.length} Dateien entfernt.`);
