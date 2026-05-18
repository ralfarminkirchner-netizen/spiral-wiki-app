import fs from 'fs';
import path from 'path';

const libraryDir = path.resolve('/Users/ralfkirchner/spiral-os/knowledge_base/core_library');

// High-quality Wikipedia generic fallbacks by category
const categoryImages = {
  'Psychologie': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Artificial_neural_network.svg/800px-Artificial_neural_network.svg.png',
  'Philosophie': 'https://upload.wikimedia.org/wikipedia/commons/b/bc/The_School_of_Athens_by_Raffaello_Sanzio_da_Urbino.jpg',
  'Wissenschaft': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Hubble_Ultra_Deep_Field_High-res.jpg/800px-Hubble_Ultra_Deep_Field_High-res.jpg',
  'Soziologie': 'https://upload.wikimedia.org/wikipedia/commons/4/41/Global_network.jpg',
  'Tradition': 'https://upload.wikimedia.org/wikipedia/commons/6/63/Flammarion.jpg',
  'Religion_und_Spiritualitaet': 'https://upload.wikimedia.org/wikipedia/commons/6/63/Flammarion.jpg',
  'Kunst_und_Literatur': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/800px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg',
  'Neurologie': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Human_brain_NIH.png/800px-Human_brain_NIH.png',
  'Kybernetik': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Internet_map_1024.png/800px-Internet_map_1024.png',
  'Wirtschaft': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/NYSE_floor.jpg/800px-NYSE_floor.jpg',
  'Bewusstseinsforschung': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Consciousness.jpg/800px-Consciousness.jpg',
  'Synthesen': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Network_Representation.svg/800px-Network_Representation.svg.png',
  'Traumaforschung': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Human_brain_NIH.png/800px-Human_brain_NIH.png'
};

// Deterministic fallback based on character hash so same file gets same image
function getFallback(filename, cat) {
  const defaults = [
    'https://upload.wikimedia.org/wikipedia/commons/6/63/Flammarion.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Hubble_Ultra_Deep_Field_High-res.jpg/800px-Hubble_Ultra_Deep_Field_High-res.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/b/bc/The_School_of_Athens_by_Raffaello_Sanzio_da_Urbino.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Internet_map_1024.png/800px-Internet_map_1024.png'
  ];
  const charCode = filename.charCodeAt(0) + filename.charCodeAt(filename.length - 4);
  const fallbackList = categoryImages[cat] ? [categoryImages[cat]] : defaults;
  return fallbackList[charCode % fallbackList.length];
}

function processDirectory(dir, topCat) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      processDirectory(fullPath, topCat || entry.name);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      
      // Check if image exists
      const hasImage = content.match(/!\[.*?\]\((.*?)\)/);
      if (!hasImage || !hasImage[1]) {
        // Find title
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1] : entry.name.replace('.md', '');
        
        const imageUrl = getFallback(entry.name, topCat);
        
        // Inject image right after the title
        const newImageMd = `\n\n![${title}](${imageUrl})\n\n`;
        content = content.replace(/^#\s+(.+)$/m, `$&${newImageMd}`);
        
        fs.writeFileSync(fullPath, content, 'utf-8');
        console.log(`✅ Injected image for: ${title}`);
      }
    }
  }
}

console.log('Injecting guaranteed images for all missing entries...');
processDirectory(libraryDir, null);
console.log('Done injecting images!');
