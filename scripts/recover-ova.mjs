// Recovery audit tool; does not overwrite the hand-integrated source modules.
// İhan, NASAYarismasi/-lhan d6caf78, MARS-KOLONISI-DUZ-OVA.html.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { transformSync, parseSync } from 'rolldown/utils';
const html = fs.readFileSync('vendor-ihan/MARS-KOLONISI-DUZ-OVA.html', 'utf8');
const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
const code = transformSync('ihan.js', scripts.find(m => !m[1].includes('octet-stream'))[2], { minify: false }).code;
fs.mkdirSync('output/ova', { recursive: true });
fs.writeFileSync('output/ova/bundle-readable.js', code);
const exportsBlock = code.slice(code.indexOf('A0(Nf,'), code.indexOf('\n\t});', code.indexOf('A0(Nf,')));
const aliases = Object.fromEntries([...exportsBlock.matchAll(/([\w$]+): \(\) => ([\w$]+)/g)].map(m => [m[2], `THREE.${m[1]}`]));
export function rename(source, names = {}) {
  const program = parseSync('recovered.js', source).program;
  const edits = [];
  function visit(node, parent, key) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Identifier' && names[node.name]) {
      const property = (parent?.type === 'MemberExpression' && key === 'property' && !parent.computed) ||
        (parent?.type === 'Property' && key === 'key' && !parent.computed);
      if (!property) edits.push([node.start, node.end, names[node.name]]);
    }
    for (const [k,v] of Object.entries(node)) {
      if (Array.isArray(v)) for (const child of v) visit(child,node,k);
      else if (v && typeof v === 'object') visit(v,node,k);
    }
  }
  visit(program);
  for (const [start,end,value] of edits.sort((a,b)=>b[0]-a[0])) source=source.slice(0,start)+value+source.slice(end);
  return source;
}
// Keep only application code. Three.js, loaders and controls are supplied by npm.
let app = code.slice(code.indexOf('\tvar vt ='), code.lastIndexOf('\n})();'));
app = rename(app, aliases);
fs.writeFileSync('output/ova/app-readable.js', app);
const manifest = {};
for (const id of ['rover','suit']) {
  const m = scripts.find(m => m[1].includes(`id="scene-${id}"`));
  const bytes = Buffer.from(m[2].trim(), 'base64');
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const directory = 'public/models/colony';
  const identical = fs.readdirSync(directory).find(name => fs.readFileSync(`${directory}/${name}`).equals(bytes));
  const name = identical ?? `ova-${id}.glb`;
  if (!identical) fs.writeFileSync(`${directory}/${name}`, bytes);
  manifest[id] = {file:name,bytes:bytes.length,sha256:hash,reused:Boolean(identical)};
}
fs.writeFileSync('output/ova/assets.json', JSON.stringify(manifest,null,2));
console.log(manifest);
// Recovery exports used once by the integration script.
export { code, aliases };
