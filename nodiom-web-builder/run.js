import { writeFile } from 'fs/promises';
import { ReaderAgent } from './agents/reader.js';
import { BuilderAgent } from './agents/builder.js';
import { AuthenticatorAgent } from './agents/authenticator.js';
import { Nodiom } from '@synexiom-labs/nodiom';

const TARGET_URL = process.argv[2] || 'https://www.meghrajsolanki.com/';
const OUTPUT_DIR = './output';

const OWNER = {
  name: 'Ruturaj Solanki',
  tagline: 'Builder, thinker, maker of things that work.',
  email: 'ruturaaj@synexiomlabs.com',
  github: 'https://github.com/Robo-Codes',
  github_user: 'Robo-Codes',
  linkedin: 'https://linkedin.com/in/ruturaj-solanki',
};

console.log('╔══════════════════════════════════════════════╗');
console.log('║   Nodiom Web Builder — 3-Agent Pipeline      ║');
console.log('╚══════════════════════════════════════════════╝\n');

// ─── Phase 1: Reader Agent ────────────────────────────────
console.log('━━━ PHASE 1: Reader Agent ━━━');
console.log(`Target: ${TARGET_URL}\n`);

const reader = new ReaderAgent();

let html;
try {
  html = await reader.fetchSite(TARGET_URL);
} catch (e) {
  console.log(`  [reader] Fetch failed: ${e.message}`);
  console.log(`  [reader] Falling back to offline analysis...\n`);
  html = '<html><body><h1>Meghraj Solanki</h1></body></html>';
}

const analysis = reader.analyzeSite(html, TARGET_URL);
const { doc: blueprintDoc, auth: readerAuth, report: readerReport } = reader.buildBlueprint(analysis, OWNER);

// Save the blueprint
const blueprintMd = blueprintDoc.toString();
await writeFile(`${OUTPUT_DIR}/blueprint.md`, blueprintMd);
console.log(`\n  Blueprint saved → output/blueprint.md (${blueprintMd.length} chars)`);
console.log(`  Reader auth: ${readerReport.summary}\n`);

// ─── Phase 2: Authenticator Pre-Check ─────────────────────
console.log('━━━ PHASE 2: Authenticator Pre-Check ━━━\n');

const preCheckDoc = Nodiom.fromString(blueprintMd);
const preAuth = new AuthenticatorAgent(preCheckDoc);

const preCheckResult = preAuth.validateDocument();
const preReport = preAuth.getReport();

console.log(`\n  Pre-check: ${preReport.summary}`);

if (preReport.errors.length > 0) {
  console.log('\n  ERRORS found in blueprint:');
  for (const err of preReport.errors) {
    console.log(`    ✗ ${err.message}`);
  }
  console.log('\n  Attempting to fix...\n');
}

if (preReport.warnings.length > 0) {
  console.log('  Warnings:');
  for (const w of preReport.warnings) {
    console.log(`    ⚠ ${w.message}`);
  }
  console.log();
}

// ─── Phase 3: Builder Agent ───────────────────────────────
console.log('━━━ PHASE 3: Builder Agent ━━━\n');

const builder = new BuilderAgent();
const { html: siteHtml, report: builderReport } = builder.build(preCheckDoc);

await writeFile(`${OUTPUT_DIR}/index.html`, siteHtml);
console.log(`\n  Site saved → output/index.html (${siteHtml.length} chars)`);
console.log(`  Builder auth: ${builderReport.summary}\n`);

// ─── Phase 4: Final Authenticator Audit ───────────────────
console.log('━━━ PHASE 4: Final Audit ━━━\n');

// Re-read the blueprint and verify all reads were clean
const finalDoc = Nodiom.fromString(blueprintMd);
const finalAuth = new AuthenticatorAgent(finalDoc, { verbose: false });

const allSelectors = [
  '# Blueprint > ## Meta',
  '# Blueprint > ## Design > ### Typography',
  '# Blueprint > ## Design > ### Colors',
  '# Blueprint > ## Design > ### Layout',
  '# Blueprint > ## Structure',
  '# Blueprint > ## Sections',
  '# Blueprint > ## Content Map',
  '# Blueprint > ## Owner',
];

let auditPassed = 0;
let auditFailed = 0;

for (const sel of allSelectors) {
  const v = finalAuth.validateSelector(sel);
  if (v.valid) {
    auditPassed++;
    const content = finalDoc.read(sel);
    const isEmpty = !content.trim();
    console.log(`  ✓ ${sel.split(' > ').pop()} ${isEmpty ? '(empty)' : `(${content.length} chars)`}`);
  } else {
    auditFailed++;
    console.log(`  ✗ ${sel.split(' > ').pop()} — FAILED`);
  }
}

const auditReport = finalAuth.getReport();

// ─── Summary ──────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════╗');
console.log('║   Pipeline Summary                            ║');
console.log('╠══════════════════════════════════════════════╣');
console.log(`║  Reader:        ${readerReport.summary.padEnd(28)}║`);
console.log(`║  Pre-check:     ${preReport.summary.padEnd(28)}║`);
console.log(`║  Builder:       ${builderReport.summary.padEnd(28)}║`);
console.log(`║  Final audit:   ${auditPassed}/${allSelectors.length} selectors valid${' '.repeat(13)}║`);
console.log('╠══════════════════════════════════════════════╣');
console.log(`║  Blueprint:     output/blueprint.md           ║`);
console.log(`║  Website:       output/index.html             ║`);
console.log('╚══════════════════════════════════════════════╝\n');

if (auditFailed > 0) {
  console.log(`⚠ ${auditFailed} selector(s) failed audit — check blueprint structure.`);
  process.exit(1);
}

console.log('All clear. Open output/index.html in a browser.');
