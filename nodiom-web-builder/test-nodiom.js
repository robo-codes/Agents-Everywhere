import { Nodiom } from '@synexiom-labs/nodiom';

const results = { passed: 0, failed: 0, tests: [] };

function test(name, fn) {
  try {
    const r = fn();
    if (r instanceof Promise) return r.then(() => {
      results.passed++;
      results.tests.push({ name, status: '✓' });
    }).catch(e => {
      results.failed++;
      results.tests.push({ name, status: '✗', error: e.message });
    });
    results.passed++;
    results.tests.push({ name, status: '✓' });
  } catch (e) {
    results.failed++;
    results.tests.push({ name, status: '✗', error: e.message });
  }
}

// Document with proper heading hierarchy
const md = `# Hero

Welcome to my site.

## About

I build things.

## Projects

### Project Alpha

A cool project.

### Project Beta

Another cool project.

## Skills

- JavaScript
- Python
- Rust

## Contact

Reach me at hello@example.com
`;

const doc = Nodiom.fromString(md);

// --- 1. tree() ---
test('tree() returns document outline', () => {
  const outline = doc.tree();
  console.log('\n--- tree() ---');
  console.log(JSON.stringify(outline, null, 2));
  if (!Array.isArray(outline)) throw new Error('Should return an array');
  if (outline[0].heading !== 'Hero') throw new Error('First heading should be Hero');
  if (outline[0].children.length !== 4) throw new Error('Hero should have 4 children');
});

// --- 2. read() heading content ---
test('read() top-level H1', () => {
  const content = doc.read('# Hero');
  console.log('\n--- read("# Hero") ---');
  console.log(JSON.stringify(content));
  if (!content.includes('Welcome')) throw new Error('Should contain Welcome');
});

test('read() nested H2 under H1', () => {
  const content = doc.read('# Hero > ## About');
  console.log('\n--- read("# Hero > ## About") ---');
  console.log(JSON.stringify(content));
  if (!content.includes('I build things')) throw new Error('Should contain "I build things"');
});

test('read() deeply nested H3', () => {
  const content = doc.read('# Hero > ## Projects > ### Project Alpha');
  console.log('\n--- read("# Hero > ## Projects > ### Project Alpha") ---');
  console.log(JSON.stringify(content));
  if (!content.includes('cool project')) throw new Error('Should contain "cool project"');
});

// --- 3. readList() ---
test('readList() returns list items', () => {
  const items = doc.readList('# Hero > ## Skills');
  console.log('\n--- readList("# Hero > ## Skills") ---');
  console.log(items);
  if (items.length !== 3) throw new Error(`Expected 3, got ${items.length}`);
  // readList() returns items WITH markdown prefix (e.g. "- Python" not "Python")
  if (!items.some(i => i.includes('Python'))) throw new Error('Should include Python');
});

// --- 4. query() ---
test('query() on existing section', () => {
  const q = doc.query('# Hero > ## Projects');
  console.log('\n--- query("# Hero > ## Projects") ---');
  console.log(q);
  if (!q.exists) throw new Error('Should exist');
});

test('query() on non-existent section', () => {
  const q = doc.query('# Hero > ## Nope');
  console.log('\n--- query("# Hero > ## Nope") ---');
  console.log(q);
  if (q.exists) throw new Error('Should not exist');
});

// --- 5. write() ---
test('write() replaces section content', () => {
  const d = Nodiom.fromString(md);
  d.write('# Hero > ## About', 'I design and build software systems.');
  const updated = d.read('# Hero > ## About');
  console.log('\n--- after write("# Hero > ## About") ---');
  console.log(JSON.stringify(updated));
  if (!updated.includes('design and build')) throw new Error('Content not replaced');
});

// --- 6. append() ---
test('append() adds content', () => {
  const d = Nodiom.fromString(md);
  d.append('# Hero > ## Skills', '\n- TypeScript');
  const items = d.readList('# Hero > ## Skills');
  console.log('\n--- after append to Skills ---');
  console.log(items);
  if (!items.some(i => i.includes('TypeScript'))) throw new Error('TypeScript not appended');
});

// --- 7. delete() ---
test('delete() removes section', () => {
  const d = Nodiom.fromString(md);
  d.delete('# Hero > ## Projects > ### Project Beta');
  const q = d.query('# Hero > ## Projects > ### Project Beta');
  console.log('\n--- after delete Project Beta ---');
  console.log('exists:', q.exists);
  if (q.exists) throw new Error('Should be deleted');
});

// --- 8. Element selectors ---
test('li[0] index selector', () => {
  const d = Nodiom.fromString(md);
  const item = d.read('# Hero > ## Skills > li[0]');
  console.log('\n--- read("# Hero > ## Skills > li[0]") ---');
  console.log(JSON.stringify(item));
  if (!item.includes('JavaScript')) throw new Error('First item should be JavaScript');
});

test('li[-1] negative index', () => {
  const d = Nodiom.fromString(md);
  const item = d.read('# Hero > ## Skills > li[-1]');
  console.log('\n--- read("# Hero > ## Skills > li[-1]") ---');
  console.log(JSON.stringify(item));
  if (!item.includes('Rust')) throw new Error('Last item should be Rust');
});

test('li[contains="..."] content selector', () => {
  const d = Nodiom.fromString(md);
  const item = d.read('# Hero > ## Skills > li[contains="Python"]');
  console.log('\n--- read li[contains="Python"] ---');
  console.log(JSON.stringify(item));
  if (!item.includes('Python')) throw new Error('Should match Python item');
});

// --- 9. Method chaining ---
// NOTE: write('# Hero', ...) replaces ALL content under Hero, including child headings.
// So chaining must not reference children that were replaced. This is correct behavior —
// write() replaces the section body.
test('method chaining (scoped writes)', () => {
  const d = Nodiom.fromString(md);
  const result = d
    .write('# Hero > ## About', 'Hello, world.')
    .append('# Hero > ## Skills', '\n- Go')
    .delete('# Hero > ## Contact');
  const final = result.toString();
  console.log('\n--- chained result (first 400 chars) ---');
  console.log(final.substring(0, 400));
  if (final.includes('hello@example.com')) throw new Error('Contact should be gone');
  if (!final.includes('Hello, world')) throw new Error('About should be updated');
});

// --- 10. toString() round-trip ---
test('toString() preserves structure', () => {
  const output = doc.toString();
  console.log('\n--- toString() length:', output.length, 'chars ---');
  if (!output.includes('# Hero')) throw new Error('Should have headings');
  if (!output.includes('- JavaScript')) throw new Error('Should have list items');
});

// --- 11. fromFile + save ---
await test('fromFile + save round-trip', async () => {
  const fs = await import('fs/promises');
  const testFile = './test-roundtrip.md';
  await fs.writeFile(testFile, md);
  const fileDoc = await Nodiom.fromFile(testFile, { lock: true });
  fileDoc.write('# Hero', 'Updated from file.');
  await fileDoc.save();
  const saved = await fs.readFile(testFile, 'utf-8');
  await fs.unlink(testFile);
  if (!saved.includes('Updated from file')) throw new Error('File save failed');
});

// --- 12. Error handling ---
test('SelectorNotFoundError has suggestions', () => {
  try {
    doc.read('# Hero > ## Skilz');
    throw new Error('Should have thrown');
  } catch (e) {
    console.log('\n--- SelectorNotFoundError ---');
    console.log('selector:', e.selector);
    console.log('suggestions:', e.suggestions);
    if (!e.suggestions || e.suggestions.length === 0) throw new Error('Should have suggestions');
  }
});

// --- 13. Frontmatter preservation ---
test('frontmatter preserved through edits', () => {
  const fmDoc = Nodiom.fromString(`---
title: My Site
date: 2024-01-01
---

# Main

Some content.

## Sub

Details here.
`);
  fmDoc.write('# Main > ## Sub', 'New details.');
  const output = fmDoc.toString();
  console.log('\n--- frontmatter test ---');
  console.log(output.substring(0, 100));
  if (!output.startsWith('---')) throw new Error('Frontmatter should be preserved');
  if (!output.includes('title: My Site')) throw new Error('Frontmatter content lost');
  if (!output.includes('New details')) throw new Error('Edit not applied');
});

// --- Report ---
console.log('\n\n========== NODIOM CAPABILITY TEST RESULTS ==========');
for (const t of results.tests) {
  console.log(`  ${t.status} ${t.name}${t.error ? ` — ${t.error}` : ''}`);
}
console.log(`\n  ${results.passed} passed, ${results.failed} failed out of ${results.tests.length} tests`);
console.log('====================================================\n');

if (results.failed > 0) process.exit(1);
