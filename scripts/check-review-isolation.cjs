/** Lightweight storage + review-tab DOM model. Real browser iframe teardown is a separate QA. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const wall = { exports: {} };
const wallContext = { exports: wall.exports, localStorage: null };
vm.runInNewContext(compile('src/story/wall1.ts'), wallContext);
const mod = { exports: {} };
vm.runInNewContext(compile('src/reviewGameStorage.ts'), { exports: mod.exports, URLSearchParams, Map, Object, require: () => wall.exports });
for (const screen of ['story', 'score', 'map']) {
  let accessed = 0;
  const real = { score: '2400', cleared: '10', notes: 'keep' };
  const target = { location: { hostname: 'localhost', pathname: '/review-game.html', search: '?review=' + screen } };
  Object.defineProperty(target, 'localStorage', { configurable: true, get() { accessed++; throw Error('Real storage accessed'); } });
  mod.exports.prepareReviewGameStorage(target);
  assert.equal(accessed, 0);
  const memory = target.localStorage;
  assert.equal(memory.getItem('score'), null); memory.setItem('score', '9999'); memory.setItem('cleared', '100');
  memory.removeItem('score'); memory.clear(); assert.equal(memory.length, 0);
  assert.deepEqual(real, { score: '2400', cleared: '10', notes: 'keep' });
}
for (const mission of wall.exports.CAMPAIGN_MISSIONS) {
  const target = { location: { hostname: 'localhost', pathname: '/review-game.html', search: '?review=story&stage=' + mission.stage } };
  mod.exports.prepareReviewGameStorage(target);
  wallContext.localStorage = target.localStorage;
  const progress = wall.exports.loadWallProgress();
  const powers = wall.exports.wallAbilities(progress.cleared, mission.stage);
  for (const power of mission.requiresAbilities ?? []) assert(powers.includes(power), `${mission.number}: missing ${power}`);
  if (mission.stage === 25) assert(powers.includes('spa1'), '1-6 starts with Super 1 even with empty real save');
}
for (const location of [
  { hostname: 'sainome-seven.vercel.app', pathname: '/review-game.html', search: '?review=story' },
  { hostname: 'localhost', pathname: '/', search: '?review=story' },
  { hostname: 'localhost', pathname: '/review-game.html', search: '?review=unknown' },
]) assert.throws(() => mod.exports.prepareReviewGameStorage({ location }));
const blocked = { location: { hostname: 'localhost', pathname: '/review-game.html', search: '?review=story' } };
Object.defineProperty(blocked, 'localStorage', { value: {}, configurable: false });
assert.throws(() => mod.exports.prepareReviewGameStorage(blocked));
const bootstrap = fs.readFileSync('src/reviewGame.ts', 'utf8');
assert(bootstrap.indexOf('prepareReviewGameStorage();') < bootstrap.indexOf("await import('./main')"));
assert(!/import .* from ['"]\.\/main/.test(bootstrap));

const frames = [], notices = [];
class Element {
  children = []; attrs = {}; hidden = false; src = ''; selectedIndex = 0;
  constructor(tag) { this.tag = tag; this.contentWindow = { postMessage: (data, origin) => notices.push({ tag, data, origin }) }; }
  append(...elements) { this.children.push(...elements); }
  after() {}
  setAttribute(name, value) { this.attrs[name] = value; }
}
const nav = new Element('nav'), body = new Element('body');
body.append = frame => { frames.push(frame); };
const document = { querySelector: () => nav, createElement: tag => new Element(tag), body };
vm.runInNewContext(compile('src/review.ts'), {
  exports: {}, document, location: { origin: 'http://localhost:5180' },
  require: () => ({ CAMPAIGN_MISSIONS: [{ stage: 20, number: '1-1', title: 'A' }, { stage: 21, number: '1-2', title: 'B' }] }),
});
// 図鑑→技図鑑→マップ→進行表→反映。マップのみ非表示時に破棄。
assert.equal(frames.length, 5);
assert.equal(frames[0].src, '/enemies.html');
nav.children[1].onclick(); assert.equal(frames[1].src, '/skills.html');
nav.children[2].onclick(); assert.match(frames[2].src, /review-game.html\?story=map&review=map/);
nav.children[3].onclick(); assert.equal(frames[2].src, 'about:blank'); assert.equal(frames[3].src, '/story-progress.html');
nav.children[4].onclick(); assert.equal(frames[4].src, '/sync.html');
nav.children[2].onclick(); assert.match(frames[2].src, /review-game.html\?story=map&review=map/);
nav.children[0].onclick(); assert.equal(frames[2].src, 'about:blank');
assert.equal(frames[3].src, '/story-progress.html');
assert.equal(frames[1].src, '/skills.html');
assert(notices.some(n => n.data.type === 'sainome-review-visible' && n.data.visible === false));
const link = nav.children[5];
assert.equal(link.tag, 'a'); assert.equal(link.href, 'https://sainome-seven.vercel.app/'); assert.equal(link.target, '_blank');
console.log('PASS: review game memory isolation/fail-closed bootstrap; hidden map disposal; visible restart; feedback/gallery retention; public game link.');
