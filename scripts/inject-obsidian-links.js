import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const libraryDir = path.resolve('/Users/ralfkirchner/spiral-os/knowledge_base/core_library');

function getMarkdownFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getMarkdownFiles(filePath, fileList);
    } else if (file.endsWith('.md')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const files = getMarkdownFiles(libraryDir);
console.log(`Gefunden: ${files.length} Markdown-Dateien.`);

const titlesMap = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8');
  const titleMatch = content.match(/^#\s+(.+)$/m);
  let title = '';
  if (titleMatch) {
    title = titleMatch[1].replace(/Monographie:\s*(Masterclass)?\s*/i, '').trim();
    title = title.replace(/\(.*?\)/g, '').trim();
    if (title.includes(' - ')) title = title.split(' - ')[0].trim();
    if (title.includes(': ')) title = title.split(': ')[0].trim();
  } else {
    title = path.basename(file, '.md').replace(/_/g, ' ');
  }
  
  if (title.length > 3) {
    titlesMap.push({ title, file });
  }
}

// Längste Titel zuerst matchen
titlesMap.sort((a, b) => b.title.length - a.title.length);

let modifiedFiles = 0;
let totalReplaced = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let originalContent = content;
  
  for (const item of titlesMap) {
    if (item.file === file) continue;
    
    const escapedTitle = item.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedTitle}\\b`, 'g');
    
    content = content.replace(regex, (match, offset, string) => {
      const before = string.slice(Math.max(0, offset - 4), offset);
      const after = string.slice(offset + match.length, offset + match.length + 4);
      
      // Heuristik: Ist es schon verlinkt oder ein Bildpfad?
      if (before.includes('[') || after.includes(']')) return match;
      if (before.includes('/') || after.includes('.md') || after.includes('.png') || after.includes('.jpg')) return match;
      if (before.includes('#') || before.includes('=')) return match;
      
      totalReplaced++;
      return `[[${match}]]`;
    });
  }
  
  if (content !== originalContent) {
    try {
      fs.writeFileSync(file, content, 'utf-8');
      modifiedFiles++;
    } catch (e) {
      console.error(`Fehler beim Schreiben von ${file}: ${e.message}`);
    }
  }
}

console.log(`Fertig! ${totalReplaced} neue Obsidian-Links in ${modifiedFiles} Dateien injiziert.`);
