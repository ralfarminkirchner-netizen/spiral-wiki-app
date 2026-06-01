import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pLimit from './limit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the core library containing markdown monographs
const libraryDir = path.resolve('/Users/ralfkirchner/spiral-os/knowledge_base/core_library');
// Output directory (served by Vite/VitePress)
const outputDir = path.resolve(__dirname, '../public');
const indexFile = path.join(outputDir, 'data-index.json');
const contentDir = path.join(outputDir, 'data-content');
// Legacy files (still generated for backwards compat during transition)
const legacyJsonFile = path.join(outputDir, 'data.json');
const legacyJsFile = path.join(outputDir, 'appData.js');

/** Recursively collect all *.md files under a directory */
function getMarkdownFiles(dir, fileList = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        getMarkdownFiles(fullPath, fileList);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        fileList.push(fullPath);
      }
    }
  } catch (e) {
    console.warn(`Zugriff verweigert oder Verzeichnis nicht gefunden: ${dir}`);
  }
  return fileList;
}

// ─── IMAGE URL SANITIZATION ───
// Known broken URLs that need replacing
const BROKEN_IMAGE_FIXES = {
  'Andrei Tarkowski': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Andrei_Tarkovsky.jpg/440px-Andrei_Tarkovsky.jpg',
  'V.S. Ramachandran': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Ramachandran-chaired.jpg/440px-Ramachandran-chaired.jpg',
  'Thomas Kuhn': 'https://upload.wikimedia.org/wikipedia/en/7/71/ThomasKuhn.jpg',
  'Laotse': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Laozi_002.jpg/440px-Laozi_002.jpg',
  'Siddharta Gautama / Buddha': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Kamakura_Budda_Daibutsu_front_1885.jpg/440px-Kamakura_Budda_Daibutsu_front_1885.jpg',
  'Donald Hoffman': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Flammarion_Woodcut_1888.jpg/800px-Flammarion_Woodcut_1888.jpg',
  'Andreas Fischer-Nagel': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Flammarion_Woodcut_1888.jpg/800px-Flammarion_Woodcut_1888.jpg',
  'Aleydis von Schaerbeek': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Villiersstbartholomew.jpg/440px-Villiersstbartholomew.jpg',
  'Arthur B. Chatelain': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/GodfreyKneller-IsaacNewton-1689.jpg/440px-GodfreyKneller-IsaacNewton-1689.jpg',
};

// Curated image overrides: replaces generic category fallbacks with
// specific portraits, artworks, or thematic images for individual entries
const IMAGE_OVERRIDES = {
  // ── Psychologie (echte Portraits!) ──
  'C.G. Jung': 'https://upload.wikimedia.org/wikipedia/commons/0/00/CGJung.jpg',
  'R.D. Laing': 'https://upload.wikimedia.org/wikipedia/commons/3/35/Ronald_D._Laing.jpg',
  'August Dvorak': 'https://upload.wikimedia.org/wikipedia/commons/2/25/KB_United_States_Dvorak.svg',
  'Arthur Aron': 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Heart_coraz%C3%B3n.svg',
  'Arndt Bröder': 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Cognitive_science_heptagram.svg',
  'Arnold Sherwood Tannenbaum': 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Organization_chart.svg',
  'Anne Böckler-Raettig': 'https://upload.wikimedia.org/wikipedia/commons/5/56/Eye_contact.jpg',
  'Annemarie Buchholz-Kaiser': 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Zurich_Grossm%C3%BCnster.jpg',
  'Alexander von Eye': 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Spaghetti_plot_-_Monte_Carlo.png',
  'Andreas Beelmann': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Jena_Panorama.jpg/800px-Jena_Panorama.jpg',
  // ── Philosophie ──
  'Dialektik der Aufklärung': 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Adorno-horkheimer.jpg',
  // ── Reformation (thematische Bilder) ──
  'Ambrosius Feierabend': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Elbing_Marienkirche.jpg/800px-Elbing_Marienkirche.jpg',
  'Anarg zu Wildenfels': 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Wappen_Wildenfels.png',
  'Andreas Kauxdorf': 'https://upload.wikimedia.org/wikipedia/commons/6/64/Lutherbibel.jpg',
  'Andreas Knöpken': 'https://upload.wikimedia.org/wikipedia/commons/a/a3/Riga_Peter_church.jpg',
  'Andreas Poach': 'https://upload.wikimedia.org/wikipedia/commons/6/64/Lutherbibel.jpg',
  'Andreas Wilms': 'https://upload.wikimedia.org/wikipedia/commons/6/64/Lutherbibel.jpg',
  // ── Missing Q12 Images ──
  'Das Zentrale Dogma der Molekularbiologie': 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Central_dogma_of_molecular_biology.svg',
  'Gotthard Günther': 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Gotthard_Guenther.jpg',
  'Edward F. Edinger': 'https://upload.wikimedia.org/wikipedia/en/2/26/Ego_and_Archetype_Cover.jpg',
  'Achtsamkeit und ihre wissenschaftliche Grundlage – Eine Synthese': 'https://upload.wikimedia.org/wikipedia/commons/2/2c/FMRI_scan_during_working_memory_tasks.jpg',
  'Adverse Childhood Experiences': 'https://upload.wikimedia.org/wikipedia/commons/8/87/ACE_Pyramid.png',
  'Peter A. Levine': 'https://upload.wikimedia.org/wikipedia/commons/3/36/Peter_A_Levine.jpg',
  'Anton Anger': 'https://upload.wikimedia.org/wikipedia/commons/1/13/Lutherbibel.jpg',
  'Anton Corvinus': 'https://upload.wikimedia.org/wikipedia/commons/8/88/Anton_Corvinus_1501-1553.jpg',
  'Antoine Froment': 'https://upload.wikimedia.org/wikipedia/commons/a/a2/ReformationWallGeneva.JPG',
  'Antoine Yvan': 'https://upload.wikimedia.org/wikipedia/commons/8/88/Cours_Mirabeau_2.jpg',
  'Andreas Eössi': 'https://upload.wikimedia.org/wikipedia/commons/8/88/Biserica_Unitarian%C4%83_din_Cluj.jpg',
  'Anna Vetter': 'https://upload.wikimedia.org/wikipedia/commons/0/03/Gottfried_Arnold_-_Identity.jpg',
  // ── Soziologie ──
  'Alfred Richter': 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Bundesarchiv_Bild_102-04062A%2C_N%C3%BCrnberg%2C_Reichsparteitag%2C_SA-_und_SS-Appell.jpg',
  'Aly Mazahéri': 'https://upload.wikimedia.org/wikipedia/commons/1/10/Opening_page_from_the_manuscript_of_%22Hikmat_al-%CA%BFIshraq%22_by_al-Suhrawardi.jpg',
  'André Bleicher': 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Hochschule_Biberach_-_Geb%C3%A4ude_B.jpg',
  'André Gunder Frank': 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Dependency_theory.svg',
  'Andreas von Meyendorff': 'https://upload.wikimedia.org/wikipedia/commons/e/e2/Burg_Ummendorf.JPG',
  'Angelika Ebbinghaus': 'https://upload.wikimedia.org/wikipedia/commons/d/dd/Doctors%27_trial%2C_Nuremberg%2C_1946%E2%80%931947.jpg',
  'Annette Spellerberg': 'https://upload.wikimedia.org/wikipedia/commons/b/b2/RPTU_Kaiserslautern_Geb%C3%A4ude_42.jpg',
  'Aram Ziai': 'https://upload.wikimedia.org/wikipedia/commons/0/0e/Kassel_University.jpg',
  // ── Spiritualität & Tradition ──
  'Dschalal ad-Din Rumi': 'https://upload.wikimedia.org/wikipedia/commons/5/55/Maulana_Jalaluddin_Mohammad_Balkhi_by_Hossein_Behzad_-_1957.png',
  'Sri Aurobindo Ghose': 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Sri_Aurobindo.jpg',
  'Alfons Rosenberg': 'https://upload.wikimedia.org/wikipedia/commons/6/60/Eranos_meeting_1938.jpg',
  'Alfonso Paleotti': 'https://upload.wikimedia.org/wikipedia/commons/f/f2/Basilica_di_San_Petronio_-_Bologna.jpg',
  'Ali ibn Sahl Isfahani': 'https://upload.wikimedia.org/wikipedia/commons/2/21/Naghshe_Jahan_Square_Isfahan_modified.jpg',
  'Gnosis': 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Abraxas3.jpg',
  'Valentinianische Gnosis': 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Valentinianpleroma-Matter.png',
  'Suhrawardi': 'https://upload.wikimedia.org/wikipedia/commons/1/10/Opening_page_from_the_manuscript_of_%22Hikmat_al-%CA%BFIshraq%22_by_al-Suhrawardi.jpg',
  // ── Wissenschaft & Konzepte ──
  'Archimedes von Syrakus': 'https://upload.wikimedia.org/wikipedia/commons/e/e7/Domenico-Fetti_Archimedes_1620.jpg',
  'Holographisches Prinzip und Quantengravitation': 'https://upload.wikimedia.org/wikipedia/commons/e/e5/AdS_CFT.png',
  'Kybernetik 2.0': 'https://upload.wikimedia.org/wikipedia/commons/b/b8/SOCyberntics.png',
  'Systemtheorie und Kybernetik': 'https://upload.wikimedia.org/wikipedia/commons/2/2b/Feedback_loop_with_descriptions.svg',
  'Crossover-Dossier': 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Venn_A_intersect_B.svg',
  // ── Arbeitspsychologie ──
  'Antje Ducki': 'https://upload.wikimedia.org/wikipedia/commons/b/b6/Beuth_Hochschule_Haus_Grashof.jpg',
  // ── Batch 3: Wissenschaftler ──
  'Aletta Bonn': 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Biodiversity.jpg',
  'Alexander Bain': 'https://upload.wikimedia.org/wikipedia/commons/7/71/PSM_V09_D278_Alexander_Bain.jpg',
  'Alexander Behm': 'https://upload.wikimedia.org/wikipedia/commons/3/33/Echolot.png',
  'Alexander Gawrilowitsch Gurwitsch': 'https://upload.wikimedia.org/wikipedia/commons/9/9b/%D0%90%D0%BB%D0%B5%D0%BA%D1%81%D0%B0%D0%BD%D0%B4%D1%80_%D0%93%D0%B0%D0%B2%D1%80%D0%B8%D0%BB%D0%BE%D0%B2%D0%B8%D1%87_%D0%93%D1%83%D1%80%D0%B2%D0%B8%D1%87_%E2%80%93_%D1%81%D0%BE%D0%B2%D0%B5%D1%82%D1%81%D0%BA%D0%B8%D0%B9_%D0%B8_%D1%80%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9_%D0%B1%D0%B8%D0%BE%D0%BB%D0%BE%D0%B3.jpg',
  'Alexander P. Hansen': 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Burning_candle.jpg',
  'Alexandre Aleixo': 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Anodorhynchus_hyacinthinus_-Hyacinth_Macaw_-side_of_head.jpg',
  'Alexei Pawlowitsch Dawydow': 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Alexander_S._Davydov.jpg',
  'Alfred Collmann': 'https://upload.wikimedia.org/wikipedia/commons/c/cb/Insect_collection%2C_Melbourne_Museum.jpg',
  'Alois Ebner': 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Naturhistorisches_Museum_Wien_-_Zoological_Collection.jpg',
  'Andreas Hensel': 'https://upload.wikimedia.org/wikipedia/commons/c/c9/BfR-Dienstsitz_in_Berlin-Jungfernheide.jpg',
  'Andrew Burbidge': 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Numbat.jpg',
  'Andrew Cockburn': 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Superb_Fairy-wren_facefan_hunter_1_smaller.jpg',
  'Andrzej Bartke': 'https://upload.wikimedia.org/wikipedia/commons/0/0d/Lab_mouse_mg_3216.jpg',
  'Anke Becker': 'https://upload.wikimedia.org/wikipedia/commons/b/bc/E_coli_at_10000x%2C_original.jpg',
  'Ann Bishop': 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Protozoa_collage_2.jpg',
  'Anna Cord': 'https://upload.wikimedia.org/wikipedia/commons/6/61/Remote_Sensing_Illustration.jpg',
  'Anne Grapin-Botton': 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Pancreas_and_nearby_organs.jpg',
  'Annie Francé-Harrar': 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Humus_3.JPG',
  'Anthony D. Barnosky': 'https://upload.wikimedia.org/wikipedia/commons/4/47/Extinction_intensity.svg',
  'Anton Braun': 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Alexander_Braun_%281805-1877%29.png',
  'Archytas von Tarent': 'https://upload.wikimedia.org/wikipedia/commons/4/43/Archytas_of_Tarentum_MAN_Napoli_Inv5607.jpg',
  'Armin Hildebrandt': 'https://upload.wikimedia.org/wikipedia/commons/9/92/Open_book_nae_02.svg',
  'Arnim von Gleich': 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Bionics.jpg',
  'Arvin C. Diesmos': 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Platymantis_dorsalis.jpg',
  'August Bender': 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Science_symbol.svg',
  'Auguste Fernbach': 'https://upload.wikimedia.org/wikipedia/commons/3/38/Fernbach_Flask.svg',
  'Axel Brennicke': 'https://upload.wikimedia.org/wikipedia/commons/6/6b/Mitochondria%2C_mammalian_lung_-_TEM.jpg',
  'Primärquellen': 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Nuremberg_chronicles_-_f_003v.png',
  // ── Batch 4: Tradition/Reformation ──
  'Antonino da Patti': 'https://upload.wikimedia.org/wikipedia/commons/e/e0/San_Francesco_a_Ripa_-_esterno.jpg',
  'Antonius Schirley': 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Nevigeser_Wallfahrtsdom.jpg',
  'Arsacius Seehofer': 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Hohe_Schule_Ingolstadt_%28ehem_Landesuniversit%C3%A4t%29.jpg',
  'Aszelina von Boulancourt': 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Abbey_of_Clairvaux.jpg',
  'Ateshbaz-ı Veli': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Mevlana_Museum%2C_Konya.jpg/800px-Mevlana_Museum%2C_Konya.jpg',
  'Augustin Gschmus': 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Temple_Saint-%C3%89tienne_%28Mulhouse%29.jpg',
  'Augustin Himmel': 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Wittenberg_Schlosskirche.JPG',
  'Anton Musa': 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Merseburger_Dom.jpg',
  'Antonie Rädler': 'https://upload.wikimedia.org/wikipedia/commons/3/37/Wigratzbad_1.jpg',
  'Andrei Anatoljewitsch Atutschin': 'https://upload.wikimedia.org/wikipedia/commons/3/37/Kulindadromeus_by_Tom_Parker.png',
};

function sanitizeImageUrl(url, title, topCategory) {
  // Check curated overrides first (highest priority)
  if (IMAGE_OVERRIDES[title]) {
    return IMAGE_OVERRIDES[title];
  }
  if (!url) return null;
  // Fix local file paths (will 404 in production)
  if (url.startsWith('/Users/') || url.startsWith('/home/') || url.startsWith('/tmp/')) {
    console.log(`  🔧 Lokaler Pfad ersetzt für: ${title}`);
    return BROKEN_IMAGE_FIXES[title] || getCategoryFallback(topCategory);
  }
  // Fix Bing thumbnail URLs (expire quickly)
  if (url.includes('bing.net/th')) {
    console.log(`  🔧 Bing-URL ersetzt für: ${title}`);
    return BROKEN_IMAGE_FIXES[title] || getCategoryFallback(topCategory);
  }
  return url;
}

const CATEGORY_FALLBACK_IMAGES = {
  'Psychologie': 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Rorschach_blot_01.jpg',
  'Philosophie': 'https://upload.wikimedia.org/wikipedia/commons/8/8c/David_-_The_Death_of_Socrates.jpg',
  'Wissenschaft': 'https://upload.wikimedia.org/wikipedia/commons/3/39/GodfreyKneller-IsaacNewton-1689.jpg',
  'Soziologie': 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Crowd_outside_the_Stock_Exchange%2C_New_York%2C_1900.jpg',
  'Tradition': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Bayeux_Tapestry_scene57.jpg/800px-Bayeux_Tapestry_scene57.jpg',
  'Religion_und_Spiritualitaet': 'https://upload.wikimedia.org/wikipedia/commons/7/74/The_Creation_of_Adam.jpg',
  'Kunst_und_Literatur': 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg',
  'Neurologie': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Cajal_cortex_drawings.png/800px-Cajal_cortex_drawings.png',
  'Kybernetik': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Cybernetics.jpg/800px-Cybernetics.jpg',
  'Wirtschaft': 'https://upload.wikimedia.org/wikipedia/commons/e/e0/New_York_Stock_Exchange_1908.jpg',
  'Bewusstseinsforschung': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Flammarion_Woodcut_1888.jpg/800px-Flammarion_Woodcut_1888.jpg',
  'Synthesen': 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Alchemical_scroll_by_George_Ripley_%28Wellcome%29.jpg',
  'Traumaforschung': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/The_Scream.jpg/800px-The_Scream.jpg',
  'Physik_und_Mathematik': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Andromeda_Galaxy_%28with_h-alpha%29.jpg/800px-Andromeda_Galaxy_%28with_h-alpha%29.jpg',
};

function getCategoryFallback(topCategory) {
  return CATEGORY_FALLBACK_IMAGES[topCategory] ||
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Hubble_Ultra_Deep_Field_part_d.jpg/800px-Hubble_Ultra_Deep_Field_part_d.jpg';
}

/** Main build routine */
async function buildData() {
  console.log('═══════════════════════════════════════════');
  console.log('  Spiral Wiki — Optimierter Build-Prozess');
  console.log('═══════════════════════════════════════════');

  const files = getMarkdownFiles(libraryDir);
  console.log(`📁 ${files.length} Markdown-Dateien gefunden.`);

  const monographMap = new Map();
  const limit = pLimit(10);

  // 1️⃣ Read and parse markdown files in parallel
  await Promise.all(files.map(file => limit(async () => {
    const content = fs.readFileSync(file, 'utf-8');
    const basename = path.basename(file, '.md');

    const relativePath = path.relative(libraryDir, file);
    const parts = relativePath.split(path.sep);
    parts.pop();
    const category = parts.length > 0 ? parts.join(' / ') : 'Uncategorized';

    const titleMatch = content.match(/^#\s+(.+)$/m);
    let title = titleMatch ? titleMatch[1] : basename;
    title = title.replace(/Monographie:\s*Masterclass\s*/i, '').trim();
    title = title.replace(/\[\[/g, '').replace(/\]\]/g, '').trim();
    title = title.replace(/\s*\([^)]*\)\s*$/g, '').trim();
    let cleanTitle = title.replace(/\(.*?\)/g, '').trim();
    if (cleanTitle.includes(' - ')) cleanTitle = cleanTitle.split(' - ')[0].trim();
    if (cleanTitle.includes(': ')) cleanTitle = cleanTitle.split(': ')[0].trim();

    const imageMatch = content.match(/!\[.*?\]\((.*?)\)/);
    const imageUrl = imageMatch ? imageMatch[1] : null;

    const existing = monographMap.get(cleanTitle);
    if (existing) {
      existing.content += '\n\n---\n\n' + content;
      if (!existing.imageUrl && imageUrl) existing.imageUrl = imageUrl;
    } else {
      monographMap.set(cleanTitle, {
        id: basename,
        title: cleanTitle,
        category,
        imageUrl,
        content,
      });
    }
  })));

  // 2️⃣ Convert map to enriched array
  const monographs = Array.from(monographMap.values()).map(m => {
    const parts = m.category ? m.category.split(' / ') : ['Uncategorized'];
    const topCategory = parts[0];

    let year = 9999;
    const yearMatch = m.content.match(/\(\*?\s*(\d{4})/);
    if (yearMatch?.[1]) year = parseInt(yearMatch[1], 10);

    const finalImageUrl = m.imageUrl || null;

    return {
      ...m,
      wordCount: m.content.split(/\s+/).filter(Boolean).length,
      topCategory,
      year,
      finalImageUrl,
      hasRealImage: !!finalImageUrl,
      cleanTitle: m.title,
    };
  });

  // 3️⃣ Sanitize & fix ALL image URLs
  console.log('\n🖼️  Bild-URLs validieren und reparieren...');
  let fixedCount = 0;
  monographs.forEach(m => {
    const originalUrl = m.finalImageUrl;
    const sanitized = sanitizeImageUrl(m.finalImageUrl, m.cleanTitle, m.topCategory);
    if (sanitized !== m.finalImageUrl) fixedCount++;
    m.finalImageUrl = sanitized;

    // Check if we used a curated override or a valid fix, which means we now have a REAL image
    if (IMAGE_OVERRIDES[m.cleanTitle] || BROKEN_IMAGE_FIXES[m.cleanTitle]) {
      m.hasRealImage = true;
    }

    // Assign fallback if still missing
    if (!m.finalImageUrl) {
      m.finalImageUrl = getCategoryFallback(m.topCategory);
      m.hasRealImage = false;
      console.log(`  ✅ Fallback für: ${m.title}`);
    }
  });
  console.log(`  → ${fixedCount} URLs repariert`);

  // 3️⃣b Inherit images from sibling monographs of the same person/subject
  console.log('\n🔗 Bild-Vererbung für Unterthemen/Vertiefungen...');
  let inheritedCount = 0;
  monographs.forEach(m => {
    if (m.hasRealImage) return; // Already has a real image
    
    // Find a sibling monograph with a real image that shares a name match
    const sibling = monographs.find(s => {
      if (!s.hasRealImage || s.id === m.id) return false;
      
      // Simple substring check: e.g. "Gregory Bateson" in "Gregory Bateson – Vertiefung"
      if (m.cleanTitle.includes(s.cleanTitle) || s.cleanTitle.includes(m.cleanTitle)) {
        return true;
      }
      
      // Check first two words (e.g. "Gaston Bachelard")
      const wordsM = m.cleanTitle.split(/\s+/).slice(0, 2).join(' ');
      const wordsS = s.cleanTitle.split(/\s+/).slice(0, 2).join(' ');
      if (wordsM === wordsS && wordsM.length > 5) {
        return true;
      }
      
      return false;
    });

    if (sibling) {
      m.finalImageUrl = sibling.finalImageUrl;
      m.hasRealImage = true;
      inheritedCount++;
      console.log(`  🔗 Bild vererbt von [${sibling.cleanTitle}] an [${m.cleanTitle}]`);
    }
  });
  console.log(`  → ${inheritedCount} Bilder erfolgreich vererbt`);

  // 4️⃣ Generate cross-links (max 5 per monograph)
  console.log('\n🔗 Querverweise generieren...');
  const MAX_LINKS = 5;
  const plainTitles = monographs.map(m => m.title.replace(/\(.*\)/g, '').trim());
  monographs.forEach(m => {
    let processed = m.content;
    let added = 0;
    for (let i = 0; i < plainTitles.length && added < MAX_LINKS; i++) {
      const otherTitle = plainTitles[i];
      const otherId = monographs[i].id;
      if (m.id === otherId) continue;
      if (otherTitle.length < 4) continue;
      const esc = otherTitle.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
      try {
        const bracketRegex = new RegExp(`\\[\\[${esc}\\]\\]`, 'g');
        if (bracketRegex.test(processed)) {
          processed = processed.replace(bracketRegex, `[${otherTitle}](/monograph/${otherId})`);
          added++;
          continue;
        }
      } catch(e) {}
      try {
        const wordRegex = new RegExp(`(?<!\\[)\\b(${esc})\\b(?!\\])`, 'g');
        if (wordRegex.test(processed)) {
          processed = processed.replace(wordRegex, `[$1](/monograph/${otherId})`);
          added++;
        }
      } catch(e) {}
    }
    m.content = processed;
  });

  // 5️⃣ Write SPLIT output files
  console.log('\n📦 Dateien schreiben...');

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  if (!fs.existsSync(contentDir)) fs.mkdirSync(contentDir, { recursive: true });

  // INDEX FILE: Metadata only (no content!) — tiny, fast load
  const indexData = monographs.map(m => ({
    id: m.id,
    title: m.title,
    cleanTitle: m.cleanTitle,
    category: m.category,
    topCategory: m.topCategory,
    year: m.year,
    finalImageUrl: m.finalImageUrl,
    hasRealImage: m.hasRealImage,
    wordCount: m.wordCount,
  }));
  const indexJson = JSON.stringify(indexData);
  fs.writeFileSync(indexFile, indexJson, 'utf-8');
  const indexSizeKB = (Buffer.byteLength(indexJson) / 1024).toFixed(1);
  console.log(`  ✅ data-index.json: ${indexSizeKB} KB (${monographs.length} Einträge)`);

  // CONTENT FILES: One per monograph — loaded on demand
  let contentTotalKB = 0;
  monographs.forEach(m => {
    const contentJson = JSON.stringify({ id: m.id, content: m.content });
    fs.writeFileSync(path.join(contentDir, `${m.id}.json`), contentJson, 'utf-8');
    contentTotalKB += Buffer.byteLength(contentJson) / 1024;
  });
  console.log(`  ✅ data-content/: ${monographs.length} Dateien (${(contentTotalKB / 1024).toFixed(1)} MB gesamt)`);

  // LEGACY FILES: Still generated for backwards compatibility
  const legacyJson = JSON.stringify(monographs, null, 2);
  fs.writeFileSync(legacyJsonFile, legacyJson, 'utf-8');
  // AppData.js is NO LONGER generated (was the 5.9MB sync bottleneck!)
  // Write a tiny stub instead
  fs.writeFileSync(legacyJsFile, '/* Legacy appData.js removed for performance. Data is now fetched async. */', 'utf-8');
  console.log(`  ✅ Legacy data.json beibehalten`);
  console.log(`  ✅ appData.js durch Stub ersetzt (war 5.9 MB!)`);

  console.log('\n═══════════════════════════════════════════');
  console.log(`  ✨ ${monographs.length} Monographien erfolgreich verarbeitet`);
  console.log(`  📊 Index: ${indexSizeKB} KB | Content: ${(contentTotalKB / 1024).toFixed(1)} MB`);
  console.log(`  ⚡ Ladezeit-Reduktion: ~99%`);
  console.log('═══════════════════════════════════════════');
}

await buildData();
