# Causality Extraction Pipeline

This pipeline deterministically extracts a historical causality graph from Markdown cross-links using chronology data. It was built for the MINDCEL / Spiral Wiki architecture, but is designed to be generic and reusable across different "core libraries" (e.g. Core B, Cowork Plugins).

## How it Works

The pipeline consists of two steps:

1. **Extraction (`extract-links.cjs`)**: Scans a directory of Markdown/JSON files for explicit cross-links formatted as `[Link Text](/monograph/TargetID)`.
2. **Chronology Generation (`generate_causality.cjs`)**: Analyzes the extracted links against a master index containing birth/publication years. It uses the chronology constraint to infer the direction of influence:
   - If Source is significantly older than Target -> `Source -> Target` (historical influence)
   - If Target is significantly older than Source -> `Target -> Source` (historical influence)
   - If they are contemporaries -> `Source <-> Target` (mutual influence)

## Usage

Both scripts are standalone Node.js programs and accept CLI arguments for input and output paths, preventing hardcoded directory structures.

### Step 1: Extract Links

```bash
node scripts/extract-links.cjs <input_content_dir> <output_raw_links_file>
```
- **`<input_content_dir>`**: Path to the directory containing your JSON/Markdown content files.
  - *Default:* `../public/data-content`
- **`<output_raw_links_file>`**: Where to save the intermediate links file.
  - *Default:* `../public/raw-cross-links.json`

**Example:**
```bash
node scripts/extract-links.cjs ./public/data-content ./public/raw-cross-links.json
```

### Step 2: Generate Causality Graph

```bash
node scripts/generate_causality.cjs <input_data_index_file> <input_raw_links_file> <output_causality_graph_file>
```
- **`<input_data_index_file>`**: Path to your master index JSON file containing metadata (must include `id` and `year`).
  - *Default:* `../public/data-index.json`
- **`<input_raw_links_file>`**: Path to the raw links file generated in Step 1.
  - *Default:* `../public/raw-cross-links.json`
- **`<output_causality_graph_file>`**: Path where the final causality graph will be saved.
  - *Default:* `../public/causality-graph.json`

**Example:**
```bash
node scripts/generate_causality.cjs ./public/data-index.json ./public/raw-cross-links.json ./public/causality-graph.json
```

## Data Structure Examples

### Expected Index Format (`data-index.json`)
The script expects an array of objects with at least `id` and `year`:
```json
[
  {
    "id": "Aristoteles_monographie",
    "title": "Aristoteles",
    "year": -384
  }
]
```

### Final Output (`causality-graph.json`)
```json
{
  "nodes": [
    {
      "id": "Aristoteles_monographie",
      "title": "Aristoteles",
      "group": "philosophy"
    }
  ],
  "edges": [
    {
      "source": "Platon_monographie",
      "target": "Aristoteles_monographie",
      "type": "historical_influence"
    }
  ]
}
```

## Integrating with New Datasets

To apply this pipeline to a new dataset (like Core B):
1. Ensure your content files have `[Title](/monograph/ID)` style cross-links.
2. Build an index file with the `id` and `year` for each entry.
3. Run Step 1 pointing to your content directory.
4. Run Step 2 pointing to your index file.
5. The resulting `causality-graph.json` can be loaded into any frontend graph visualizer (e.g. `react-force-graph-3d`).
