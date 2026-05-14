import fs from 'fs';
import path from 'path';

const dir = '/Users/ralfkirchner/spiral-os/knowledge_base/core_library';

function sanitize(currentDir) {
  const files = fs.readdirSync(currentDir);
  let totalFixed = 0;
  
  for (const file of files) {
    const fullPath = path.join(currentDir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      totalFixed += sanitize(fullPath);
    } else if (fullPath.endsWith('.md')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const orig = content;
      
      // 1. Struktur & Überschriften
      content = content.replace(/Relevanz im Spiral OS/gi, 'Relevanz für die Praxis');
      
      // 2. Spezifische Begriffe (ADHS & Neurodivergenz)
      content = content.replace(/dein ADHS-Gehirn/gi, 'das menschliche Gehirn');
      content = content.replace(/ein ADHS-Gehirn/gi, 'ein menschliches Gehirn');
      content = content.replace(/ADHS-Gehirn/gi, 'Gehirn');
      content = content.replace(/ADHS-Paralyse/gi, 'kognitive Paralyse');
      content = content.replace(/\[\[ADHS\]\]/gi, 'kognitive Überlastung');
      content = content.replace(/\bADHS\b/gi, 'Informationsüberflutung');
      
      // 3. Tooling & OS (Spiral OS, Obsidian, Vault)
      content = content.replace(/Spiral OS/gi, 'vernetzte Systeme');
      content = content.replace(/dein Obsidian-Vault/gi, 'ein digitales Wissensnetzwerk');
      content = content.replace(/deinem Obsidian-Vault/gi, 'einem digitalen Wissensnetzwerk');
      content = content.replace(/Obsidian-Vault/gi, 'digitales Wissensnetzwerk');
      content = content.replace(/dein Vault/gi, 'das Wissensnetzwerk');
      content = content.replace(/deinen Vault/gi, 'das Wissensnetzwerk');
      content = content.replace(/deinem Vault/gi, 'dem Wissensnetzwerk');
      content = content.replace(/\bVault\b/gi, 'Wissensnetzwerk');
      content = content.replace(/\bVaults\b/gi, 'Wissensnetzwerks');
      content = content.replace(/in Obsidian/gi, 'in vernetzten Systemen');
      content = content.replace(/\bObsidian\b/gi, 'vernetzte Wissensdatenbanken');

      if (content !== orig) {
        try {
          fs.writeFileSync(fullPath, content);
          totalFixed++;
        } catch (e) {
          console.error(`Fehler bei ${fullPath}: ${e.message}`);
        }
      }
    }
  }
  return totalFixed;
}

console.log('Starte Bereinigung...');
const fixed = sanitize(dir);
console.log(`Erfolgreich beendet. Bereinigt: ${fixed} Dateien.`);
