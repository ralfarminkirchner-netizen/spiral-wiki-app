import fs from 'fs';
const text = "A".repeat(1000);
try {
  text.replace(/A/g, 'B'.repeat(1000));
} catch (e) { console.log(e); }
