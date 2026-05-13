import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Railway weist den Port automatisch über die Umgebungsvariable PORT zu.
const PORT = process.env.PORT || 8080;

// Serviere statische Dateien aus dem "dist" Ordner (Vite Production Build)
// und falle auf "public" zurück, falls Assets dort liegen.
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.static(path.join(__dirname, 'public')));

// Fallback für den React-Router (Single Page Application)
// Wenn eine Route aufgerufen wird, die nicht existiert (z.B. /monograph/charles_darwin),
// schicken wir immer die index.html zurück. React Router übernimmt dann das Rendering.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Production Server läuft auf Port ${PORT}`);
});
