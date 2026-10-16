// Rebuild the first-area inline payload after editing public/story/world-draft.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const world = JSON.parse(readFileSync(new URL('public/story/world-draft.json', root), 'utf8'));
const area = world.areas[0];
const payload = { premise: world.premise, enemyCatalog: world.enemyCatalog, area, stages: world.stages.filter(s => s.areaId === area.id) };
const path = fileURLToPath(new URL('public/story-map-preview.html', root));
const html = readFileSync(path, 'utf8');
const replacement = '/* WORLD_DATA_START */\nconst WORLD = ' + JSON.stringify(payload, null, 2).replaceAll('<', '\\u003c') + ';\n/* WORLD_DATA_END */';
if (!html.includes('/* WORLD_DATA_START */')) throw new Error('Missing world-data marker');
writeFileSync(path, html.replace(/\/\* WORLD_DATA_START \*\/[\s\S]*?\/\* WORLD_DATA_END \*\//, () => replacement));
console.log('Updated first area:', area.name, payload.stages.length, 'stages');
