const fs = require('fs');
const path = require('path');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/data.json'), 'utf8'));

const categoryCounts = {};
for (const item of data) {
    if (!categoryCounts[item.category]) {
        categoryCounts[item.category] = 0;
    }
    categoryCounts[item.category]++;
}

const sorted = Object.entries(categoryCounts).sort((a, b) => a[1] - b[1]);
console.log("Kategorien mit den wenigsten Einträgen:");
for (let i = 0; i < 30; i++) {
    if (sorted[i]) console.log(`${sorted[i][1]} Einträge: ${sorted[i][0]}`);
}
