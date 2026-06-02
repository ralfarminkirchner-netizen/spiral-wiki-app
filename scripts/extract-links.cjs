const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const contentDir = args[0] ? path.resolve(args[0]) : path.join(__dirname, '..', 'public', 'data-content');
const outputFile = args[1] ? path.resolve(args[1]) : path.join(__dirname, '..', 'public', 'raw-cross-links.json');

console.log(`🔍 Input directory: ${contentDir}`);
console.log(`💾 Output file: ${outputFile}`);

if (!fs.existsSync(contentDir)) {
  console.error(`❌ Error: Directory not found -> ${contentDir}`);
  process.exit(1);
}

const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.json'));

const links = [];
const nodeTitles = {};

files.forEach(file => {
  const data = JSON.parse(fs.readFileSync(path.join(contentDir, file), 'utf8'));
  const id = data.id;
  
  // Extract title from content frontmatter or h1
  let title = data.id;
  const titleMatch = data.content.match(/^title:\s*(.+)$/m) || data.content.match(/^#\s+(.+)$/m);
  if (titleMatch) title = titleMatch[1].trim();
  
  nodeTitles[id] = title;

  // Extract links matching /monograph/X
  const linkRegex = /\[([^\]]+)\]\(\/monograph\/([^\)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(data.content)) !== null) {
    const targetId = match[2];
    if (targetId !== id) {
      links.push({
        sourceId: id,
        targetId: targetId,
      });
    }
  }
});

fs.writeFileSync(outputFile, JSON.stringify({ nodes: nodeTitles, links }, null, 2));
console.log(`Extracted ${links.length} explicit cross-links across ${files.length} nodes.`);
