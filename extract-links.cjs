const fs = require('fs');
const path = require('path');

const contentDir = path.join(__dirname, 'public', 'data-content');
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

fs.writeFileSync(path.join(__dirname, 'public', 'raw-cross-links.json'), JSON.stringify({ nodes: nodeTitles, links }, null, 2));
console.log(`Extracted ${links.length} explicit cross-links across ${files.length} nodes.`);
