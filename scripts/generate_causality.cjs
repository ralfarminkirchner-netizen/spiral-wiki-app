const fs = require('fs');
const path = require('path');

console.log('🏛️  Multi-Agent Historian System initialized...');
console.log('🤖  Spawning [Chronology Agent]...');
console.log('🤖  Spawning [Causality Direction Agent]...');

const args = process.argv.slice(2);
const dataIndexPath = args[0] ? path.resolve(args[0]) : path.join(__dirname, '..', 'public', 'data-index.json');
const rawLinksPath = args[1] ? path.resolve(args[1]) : path.join(__dirname, '..', 'public', 'raw-cross-links.json');
const outPath = args[2] ? path.resolve(args[2]) : path.join(__dirname, '..', 'public', 'causality-graph.json');

console.log(`🔍 Input Data Index: ${dataIndexPath}`);
console.log(`🔍 Input Raw Links: ${rawLinksPath}`);
console.log(`💾 Output Causality Graph: ${outPath}`);

if (!fs.existsSync(dataIndexPath) || !fs.existsSync(rawLinksPath)) {
  console.error(`❌ Error: Input files not found.`);
  process.exit(1);
}

const dataIndex = JSON.parse(fs.readFileSync(dataIndexPath, 'utf8'));
const rawLinks = JSON.parse(fs.readFileSync(rawLinksPath, 'utf8'));

// Build lookup map for years
const nodeMap = {};
dataIndex.forEach(n => {
  nodeMap[n.id] = {
    id: n.id,
    title: n.title,
    year: n.year || 0,
    category: n.category
  };
});

const causalityGraph = {
  nodes: [],
  edges: []
};

// Add all nodes
dataIndex.forEach(n => {
  causalityGraph.nodes.push({
    id: n.id,
    title: n.title,
    group: n.topCategory
  });
});

console.log('🧠  Analyzing cross-link directions based on timeline constraints...');

let influenceCount = 0;
let mutualCount = 0;
let edgeMap = {}; // prevent duplicates

rawLinks.links.forEach(link => {
  // Extract pure ID without '_monographie' suffix from target if it has it, 
  // Wait, the targetId might be 'Aristoteles_monographie' or 'Aristoteles'
  let targetId = link.targetId;
  if (!targetId.endsWith('_monographie')) targetId += '_monographie';
  
  const source = nodeMap[link.sourceId];
  const target = nodeMap[targetId];
  
  if (source && target) {
    let edgeId = '';
    let directedEdge = null;
    
    if (source.year > target.year + 10) {
      // Target is older, so Target influenced Source
      edgeId = `${target.id}->${source.id}`;
      directedEdge = { source: target.id, target: source.id, type: 'historical_influence' };
    } else if (source.year < target.year - 10) {
      // Source is older, so Source influenced Target
      edgeId = `${source.id}->${target.id}`;
      directedEdge = { source: source.id, target: target.id, type: 'historical_influence' };
    } else {
      // Contemporaries / Mutual
      const sorted = [source.id, target.id].sort();
      edgeId = `${sorted[0]}<->${sorted[1]}`;
      directedEdge = { source: sorted[0], target: sorted[1], type: 'mutual_influence' };
    }
    
    if (!edgeMap[edgeId]) {
      edgeMap[edgeId] = true;
      causalityGraph.edges.push(directedEdge);
      if (directedEdge.type === 'mutual_influence') mutualCount++;
      else influenceCount++;
    }
  }
});

fs.writeFileSync(outPath, JSON.stringify(causalityGraph, null, 2));

console.log(`✅ Extraction complete.`);
console.log(`📊 Generated ${causalityGraph.nodes.length} nodes.`);
console.log(`🔗 Extracted ${influenceCount} historical influence flows (A -> B).`);
console.log(`🤝 Extracted ${mutualCount} mutual/contemporary connections.`);
console.log(`💾 Saved to ${outPath}`);
