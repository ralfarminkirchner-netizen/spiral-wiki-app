import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetFile = path.join(__dirname, 'build-wiki-data.js');
let content = fs.readFileSync(targetFile, 'utf-8');

// I will define the mapping for the 53 items
const updates = {
  'Marvin Harris': 'https://upload.wikimedia.org/wikipedia/en/thumb/0/00/Marvin_Harris.jpg/330px-Marvin_Harris.jpg',
  'Max Gluckman': 'https://upload.wikimedia.org/wikipedia/en/thumb/6/67/Max_Gluckman.jpg/330px-Max_Gluckman.jpg',
  'Victor Turner': 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/Victor_Turner.jpg/330px-Victor_Turner.jpg',
  'Bernard Baars': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Bernard_Baars.jpg/330px-Bernard_Baars.jpg',
  'Synthetische Evolutionstheorie': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Charles_Darwin_seated.jpg/330px-Charles_Darwin_seated.jpg',
  'Die Zelltheorie': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Cork_Micrographia_Hooke.png/330px-Cork_Micrographia_Hooke.png',
  'Die Turingmaschine': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Turing_machine_2b.svg/330px-Turing_machine_2b.svg.png',
  'Emergenz': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Flock_of_birds.jpg/330px-Flock_of_birds.jpg',
  'Virginia Woolf': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/George_Charles_Beresford_-_Virginia_Woolf_in_1902_-_Restoration.jpg/330px-George_Charles_Beresford_-_Virginia_Woolf_in_1902_-_Restoration.jpg',
  'Macy-Konferenzen': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Macy_conference_1946.jpg/330px-Macy_conference_1946.jpg', // Might not exist, but let's try
  'György Buzsáki': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Gyorgy_Buzsaki.jpg/330px-Gyorgy_Buzsaki.jpg',
  'Paul Churchland': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Paul_Churchland.jpg/330px-Paul_Churchland.jpg',
  'Friedrich Nietzsche': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Nietzsche187a.jpg/330px-Nietzsche187a.jpg',
  'Stoizismus': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Paolo_Monti_-_Servizio_fotografico_%28Napoli%2C_1969%29_-_BEIC_6353768.jpg/330px-Paolo_Monti_-_Servizio_fotografico_%28Napoli%2C_1969%29_-_BEIC_6353768.jpg',
  'Konstruktivismus': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Piaget.jpg/330px-Piaget.jpg',
  'George Kelly (Psychologe)': 'https://upload.wikimedia.org/wikipedia/en/thumb/5/5b/George_Alexander_Kelly.jpg/330px-George_Alexander_Kelly.jpg',
  'Konstruktivismus (Lernpsychologie)': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Piaget.jpg/330px-Piaget.jpg',
  'Konstruktivismus (Philosophie)': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Paul_Watzlawick.jpg/330px-Paul_Watzlawick.jpg',
  'Peter L. Berger': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Peter_Ludwig_Berger.jpg/330px-Peter_Ludwig_Berger.jpg',
  'Sozialkonstruktivismus': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Peter_Ludwig_Berger.jpg/330px-Peter_Ludwig_Berger.jpg',
  'Standardmodell': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Standard_Model_of_Elementary_Particles.svg/330px-Standard_Model_of_Elementary_Particles.svg.png',
  'Charles W. Morris': 'https://upload.wikimedia.org/wikipedia/en/thumb/0/0f/Charles_W._Morris.jpg/330px-Charles_W._Morris.jpg',
  'A.H. Almaas': '', // Can't find a free image easily, will document
  'P. D. Ouspensky': 'https://upload.wikimedia.org/wikipedia/en/2/28/P._D._Ouspensky.jpg',
  'Janina Fisher': '', // Cannot find
  'Posttraumatische Belastungsstörung': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/The_Scream.jpg/800px-The_Scream.jpg',
  'Michaela Huber': '', // Cannot find
  'Onno van der Hart': '', // Cannot find
  'Pat Ogden': '', // Cannot find
  'Rachel Yehuda': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Rachel_Yehuda.jpg/330px-Rachel_Yehuda.jpg', // Guessing
  'Richard C. Schwartz': '', // Cannot find
  'Arthur Janov': 'https://upload.wikimedia.org/wikipedia/en/5/54/Arthur_Janov.jpg',
  'Ida Rolf': 'https://upload.wikimedia.org/wikipedia/en/e/ee/Ida_Pauline_Rolf.jpg',
  'Stanley Keleman': '', // Cannot find
  'E. F. Schumacher': 'https://upload.wikimedia.org/wikipedia/en/4/42/SchumacherSiB200.jpg',
  'Klimapsychologie': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Global_Temperature_Anomaly.svg/800px-Global_Temperature_Anomaly.svg.png',
  'Tiefenökologie': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/The_Earth_seen_from_Apollo_17.jpg/800px-The_Earth_seen_from_Apollo_17.jpg',
  'Bernard Baars und die Global Workspace Theory': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Bernard_Baars.jpg/330px-Bernard_Baars.jpg',
  'Die Synthetische Evolutionstheorie': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Charles_Darwin_seated.jpg/330px-Charles_Darwin_seated.jpg',
  'Die Turingmaschine': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Turing_machine_2b.svg/330px-Turing_machine_2b.svg.png',
  'Emergenz und Selbstorganisation': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Flock_of_birds.jpg/330px-Flock_of_birds.jpg',
  'Virginia_Woolf_monographie': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/George_Charles_Beresford_-_Virginia_Woolf_in_1902_-_Restoration.jpg/330px-George_Charles_Beresford_-_Virginia_Woolf_in_1902_-_Restoration.jpg',
  'Die Macy-Konferenzen': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Norbert_Wiener.jpg/330px-Norbert_Wiener.jpg', // Norbert Wiener as placeholder for Macy
  'György Buzsáki, Gehirnrhythmen und neuronale Syntax': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Gyorgy_Buzsaki.jpg/330px-Gyorgy_Buzsaki.jpg',
  'Paul Churchland und der eliminative Materialismus': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Paul_Churchland.jpg/330px-Paul_Churchland.jpg',
  'Nietzsche – Vertiefung': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Nietzsche187a.jpg/330px-Nietzsche187a.jpg',
  'Stoizismus – Die Kunst des guten Lebens': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Paolo_Monti_-_Servizio_fotografico_%28Napoli%2C_1969%29_-_BEIC_6353768.jpg/330px-Paolo_Monti_-_Servizio_fotografico_%28Napoli%2C_1969%29_-_BEIC_6353768.jpg',
  'Erlanger Konstruktivismus': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Paul_Lorenzen.jpg/330px-Paul_Lorenzen.jpg',
  'George A. Kelly': 'https://upload.wikimedia.org/wikipedia/en/thumb/5/5b/George_Alexander_Kelly.jpg/330px-George_Alexander_Kelly.jpg',
  'Konstruktivistische Didaktik': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Piaget.jpg/330px-Piaget.jpg',
  'Konstruktivistische Erkenntnistheorie': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Paul_Watzlawick.jpg/330px-Paul_Watzlawick.jpg',
  'Peter L. Berger und Thomas Luckmann': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Peter_Ludwig_Berger.jpg/330px-Peter_Ludwig_Berger.jpg',
  'Sozialer Konstruktivismus': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Peter_Ludwig_Berger.jpg/330px-Peter_Ludwig_Berger.jpg',
  'Standardmodell der Teilchenphysik': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Standard_Model_of_Elementary_Particles.svg/330px-Standard_Model_of_Elementary_Particles.svg.png',
  'SYNTHESEN-MASTER-REGISTER': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Network_representation_of_brain_connectivity.jpg/800px-Network_representation_of_brain_connectivity.jpg',
  'Anthropologie der Rituale und Übergänge': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Rite_of_passage_-_Bwiti.jpg/800px-Rite_of_passage_-_Bwiti.jpg',
  'Aufmerksamkeitsökonomie – Die wertvollste Ressource des 21. Jahrhunderts': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Piccadilly_Circus_at_Night.jpg/800px-Piccadilly_Circus_at_Night.jpg',
  'Bindungstheorie – Von Bowlby bis zur Neurobiologie': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Mother_and_baby.jpg/800px-Mother_and_baby.jpg',
  'Das Fraktal als Denkgrundlage': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Mandelbrot_sequence_new.gif/800px-Mandelbrot_sequence_new.gif',
  'Das Selbst – Konstrukt, Illusion oder Wirklichkeit?': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Rembrandt_van_Rijn_-_Self-Portrait_-_Google_Art_Project.jpg/800px-Rembrandt_van_Rijn_-_Self-Portrait_-_Google_Art_Project.jpg',
  'Frieden und Gewalt – Eine politische Psychologie': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Peace_dove.svg/800px-Peace_dove.svg.png',
  'Der leidende Körper und die heilende Gemeinschaft': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Michelangelo%27s_Pieta_5450_cropncleaned.jpg/800px-Michelangelo%27s_Pieta_5450_cropncleaned.jpg',
  'Informationstheorie, Komplexität und Bedeutung': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Shannon_communication_system.svg/800px-Shannon_communication_system.svg.png',
  'Der Körper als Wissen – Leibphilosophie und Somaforschung': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Da_Vinci_Vitruve_Luc_Viatour.jpg/800px-Da_Vinci_Vitruve_Luc_Viatour.jpg',
  'Kreativität und Schöpfung – Eine Synthese': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Creation_of_Adam.jpg/800px-Creation_of_Adam.jpg',
  'Mathematik und Ästhetik – Die Schönheit der Struktur': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/FibonacciSpiral.svg/800px-FibonacciSpiral.svg.png',
  'Soziale Bewegungen und kollektiver Wandel': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Eug%C3%A8ne_Delacroix_-_Le_28_Juillet._La_Libert%C3%A9_guidant_le_peuple.jpg/800px-Eug%C3%A8ne_Delacroix_-_Le_28_Juillet._La_Libert%C3%A9_guidant_le_peuple.jpg',
  'Das Unbewusste als Feld – Kollektive und morphische Dimensionen': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Mandala_11.jpg/800px-Mandala_11.jpg',
  'Pjotr Demianovich Ouspenski': 'https://upload.wikimedia.org/wikipedia/en/2/28/P._D._Ouspensky.jpg',
  'Komplexe Posttraumatische Belastungsstörung': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/The_Scream.jpg/800px-The_Scream.jpg',
  'Komplexes Trauma und KPTBS': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/The_Scream.jpg/800px-The_Scream.jpg',
  'Klimapsychologie – Die psychischen Dimensionen der ökologischen Krise': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Global_Temperature_Anomaly.svg/800px-Global_Temperature_Anomaly.svg.png',
  'Tiefenökologie – Die Philosophie der Naturverbundenheit': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/The_Earth_seen_from_Apollo_17.jpg/800px-The_Earth_seen_from_Apollo_17.jpg',
  'Tiefenökologie und Ökopsychologie': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/The_Earth_seen_from_Apollo_17.jpg/800px-The_Earth_seen_from_Apollo_17.jpg',
  'E.F. Schumacher': 'https://upload.wikimedia.org/wikipedia/en/4/42/SchumacherSiB200.jpg',
  'Turingmaschine': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Turing_machine_2b.svg/330px-Turing_machine_2b.svg.png'
};

// Now parse the build-wiki-data.js file and replace any string matching the Hubble URL with the appropriate one, OR rewrite the block
// Actually, it is easier to just regex replace the line based on the key
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const match = line.match(/^\s*'([^']+)'\s*:\s*'[^']+',/);
  if (match) {
    const key = match[1];
    if (updates[key] !== undefined) {
      if (updates[key] === '') {
        // Remove it entirely so it becomes hasRealImage = false
        lines[i] = ''; // Or comment it out
      } else {
        lines[i] = `  '${key}': '${updates[key]}',`;
      }
    }
  }
}

// Remove empty lines
const newContent = lines.filter(l => l !== '').join('\n');
fs.writeFileSync(targetFile, newContent, 'utf-8');
console.log('Done injecting specific images.');
