import { NodiomCloud } from './lib/nodiom-cloud.js';

const cloud = await NodiomCloud.fromEnv('../.env');

console.log('=== Nodiom Cloud API Test ===\n');

// 1. List docs
console.log('1. Listing documents...');
const docs = await cloud.listDocs();
console.log(`   ${docs}\n`);

// 2. Read the getting-started doc
console.log('2. Reading getting-started tree...');
const tree = await cloud.tree('getting-started');
console.log(`   ${JSON.stringify(tree, null, 2)}\n`);

// 3. Read a section
console.log('3. Reading "## Try these calls"...');
const trySection = await cloud.read('getting-started', '## Try these calls');
console.log(`   ${trySection.substring(0, 200)}\n`);

// 4. Create a test document
const testDocId = 'agents-everywhere-test';
console.log(`4. Creating "${testDocId}"...`);
try {
  await cloud.createDoc(testDocId, `# Agents Everywhere Test

## Meta

- Created by: Claude + Ruturaj
- Purpose: Testing Nodiom Cloud API from the Agents-Everywhere project
- Date: ${new Date().toISOString()}

## Sections

### Section A

Initial content for section A.

### Section B

Initial content for section B.

## Notes
`);
  console.log('   Created.\n');
} catch (e) {
  console.log(`   ${e.message}\n`);
}

// 5. Read it back
console.log('5. Verifying document tree...');
const testTree = await cloud.tree(testDocId);
console.log(`   ${JSON.stringify(testTree, null, 2)}\n`);

// 6. Write to a section
console.log('6. Writing to "## Sections > ### Section A"...');
await cloud.write(testDocId, '## Sections > ### Section A', 'Updated content via NodiomCloud wrapper. The API works!');
const updated = await cloud.read(testDocId, '## Sections > ### Section A');
console.log(`   Read back: "${updated}"\n`);

// 7. Append to a section
console.log('7. Appending to "## Notes"...');
await cloud.append(testDocId, '## Notes', '- First note appended via API\n- Second note appended via API');
const notes = await cloud.read(testDocId, '## Notes');
console.log(`   Notes now: "${notes}"\n`);

// 8. Query metadata
console.log('8. Querying "## Sections" metadata...');
const meta = await cloud.query(testDocId, '## Sections');
console.log(`   ${JSON.stringify(meta)}\n`);

// 9. Get full document
console.log('9. Full document content:');
const fullDoc = await cloud.getDoc(testDocId);
console.log('---');
console.log(fullDoc);
console.log('---\n');

// 10. Test board operations
console.log('10. Creating a test board...');
try {
  const boardResult = await cloud.boardCreate('Agent Tasks', ['Todo', 'In Progress', 'Done']);
  console.log(`    Board created: ${boardResult}\n`);

  const boardDocId = 'agent-tasks';
  console.log('11. Adding a card...');
  const cardResult = await cloud.boardAddCard(boardDocId, 'Build website from blueprint', {
    column: 'Todo',
    brief: 'Use the Reader agent to analyze a site, then the Builder to generate HTML.',
    criteria: ['Reader fetches and parses target site', 'Blueprint is valid Nodiom doc', 'Builder generates working HTML'],
  });
  console.log(`    Card added: ${cardResult}\n`);

  console.log('12. Reading board...');
  const board = await cloud.boardRead(boardDocId);
  console.log(`    ${JSON.stringify(board, null, 2)}\n`);
} catch (e) {
  console.log(`    Board test: ${e.message}\n`);
}

console.log('=== All tests complete ===');
