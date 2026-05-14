import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pfad zum Bibliotheks-Ordner
const libraryDir = path.resolve('/Users/ralfkirchner/spiral-os/knowledge_base/core_library');
// Output JSON and JS in public folder so Vite can serve it
const outputDir = path.resolve(__dirname, '../public');
const outputFileJson = path.join(outputDir, 'data.json');
const outputFileJs = path.join(outputDir, 'appData.js');

// Rekursive Funktion zum Finden von .md Dateien
function getMarkdownFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    console.warn(`Verzeichnis nicht gefunden: ${dir}`);
    return fileList;
  }
  
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

function buildData() {
  console.log('Starte Build-Prozess für die Spiral Wiki App...');
  const files = getMarkdownFiles(libraryDir);
  console.log(`${files.length} Markdown-Dateien gefunden.`);

  const monographs = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const basename = path.basename(file, '.md');
    
    // Kategorie aus dem Ordnernamen extrahieren
    // libraryDir ist .../core_library. Das direkte Unterverzeichnis ist die Kategorie.
    const relativePath = path.relative(libraryDir, file);
    // Splitte den relativen Pfad. Alles bis auf die Datei selbst sind Kategorien-Ebenen.
    const pathParts = relativePath.split(path.sep);
    pathParts.pop(); // Dateiname entfernen
    const categoryString = pathParts.length > 0 ? pathParts.join(' / ') : 'Uncategorized';

    // Den Titel parsen (erste Zeile mit #)
    const titleMatch = content.match(/^#\s+(.+)$/m);
    let title = titleMatch ? titleMatch[1] : basename;
    
    // "Monographie: Masterclass " aus dem Titel entfernen für eine saubere Ansicht
    title = title.replace(/Monographie:\s*Masterclass\s*/i, '').trim();
    // Obsidian-Klammern aus dem Titel entfernen, falls vorhanden
    title = title.replace(/\[\[/g, '').replace(/\]\]/g, '').trim();
    // Meta-Kommentare und Lebensdaten aus dem Titel entfernen (z.B. "(*1950)" oder "(1900-1990)")
    title = title.replace(/\s*\([^)]*\)\s*$/g, '').trim();

    // Erstes Bild extrahieren: ![alt](url)
    const imageMatch = content.match(/!\[.*?\]\((.*?)\)/);
    const imageUrl = imageMatch ? imageMatch[1] : null;

    monographs.push({
      id: basename,
      title: title,
      category: categoryString,
      imageUrl: imageUrl,
      content: content
    });
  }

  // Cross-Linking generieren
  console.log('Generiere Querverweise (Auto-Linking)...');
  const titles = monographs.map(m => m.title.replace(/\(.*\)/g, '').trim());
  
  for (let m of monographs) {
    let processedContent = m.content;
    for (let i=0; i<titles.length; i++) {
      const otherTitle = titles[i];
      const otherId = monographs[i].id;
      
      if (m.id === otherId) continue; // Sich selbst nicht verlinken
      if (otherTitle.length < 4) continue; // Zu kurze Namen ignorieren

      // Regex-Sonderzeichen escapen, um SyntaxErrors zu vermeiden (z.B. bei Titeln mit Klammern)
      const escapedOtherTitle = otherTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Obsidian links auflösen: [[Title]] -> [Title](/monograph/id)
      const obsRegex = new RegExp(`\\[\\[${escapedOtherTitle}\\]\\]`, 'g');
      processedContent = processedContent.replace(obsRegex, `[${otherTitle}](/monograph/${otherId})`);

      // Nur verlinken, wenn es nicht schon verlinkt ist (einfache Heuristik)
      // Das ist ein einfacher Regex für Demonstration.
      const regex = new RegExp(`(?<!\\[)\\b(${escapedOtherTitle})\\b(?!\\])`, 'g');
      processedContent = processedContent.replace(regex, `[$1](/monograph/${otherId})`);
    }
    m.content = processedContent;
  }

  // Sicherstellen, dass public existiert
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const jsonContent = JSON.stringify(monographs, null, 2);
  fs.writeFileSync(outputFileJson, jsonContent, 'utf-8');
  fs.writeFileSync(outputFileJs, `const windowWikiData = ${jsonContent};`, 'utf-8');
  console.log(`Erfolgreich ${monographs.length} Monographien geschrieben.`);
}

buildData();
