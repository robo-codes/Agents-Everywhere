import { Nodiom } from '@synexiom-labs/nodiom';
import { writeFile } from 'fs/promises';

// Step 1: Build the site skeleton as Markdown using Nodiom
console.log('Step 1: Building site structure with Nodiom...\n');

const skeleton = `---
title: Ruturaj Solanki
description: Builder, thinker, maker of things that work.
---

# Ruturaj Solanki

## 00 — Opening

## 01 — What I Do

## 02 — Philosophy

## 03 — Projects

### Synexiom Labs

### Nodiom

### Data & Analytics

### Early Experiments

## 04 — Background

## 05 — Skills

## 06 — Connect
`;

const doc = Nodiom.fromString(skeleton);

// Inspect the structure we built
console.log('Document tree:');
console.log(JSON.stringify(doc.tree(), null, 2));

// Step 2: Fill in each section using Nodiom's write/append API
console.log('\nStep 2: Populating sections via Nodiom selectors...\n');

doc.write('# Ruturaj Solanki > ## 00 — Opening',
  `Not everything that works is understood.\nNot everything understood is useful.\nI chase the overlap.`
);

doc.write('# Ruturaj Solanki > ## 01 — What I Do',
  `I build software that thinks — AI systems, data pipelines, and the tools that connect them.\n\nFrom structured document engines to intelligent agents, I work at the boundary between what machines can parse and what humans actually mean.`
);

doc.write('# Ruturaj Solanki > ## 02 — Philosophy',
  `Most problems aren't technical. They're structural — the wrong abstraction, the wrong boundary, the wrong question asked too late.\n\nI believe in building small, understanding deeply, and shipping things that survive contact with reality.`
);

doc.write('# Ruturaj Solanki > ## 03 — Projects > ### Synexiom Labs',
  `An AI research lab exploring the architecture of machine reasoning. We build tools that treat structure as a first-class citizen.\n\n[Explore →](https://synexiomlabs.com)`
);

doc.write('# Ruturaj Solanki > ## 03 — Projects > ### Nodiom',
  `Address any node in your Markdown. A structured read/write engine that treats documents as queryable trees — built for AI agents that need to read and write reliably.\n\n[GitHub →](https://github.com/Synexiom-Labs/nodiom)`
);

doc.write('# Ruturaj Solanki > ## 03 — Projects > ### Data & Analytics',
  `Post-graduate work in data analysis for business. Built predictive models, dashboards, and data pipelines that turned raw numbers into decisions.`
);

doc.write('# Ruturaj Solanki > ## 03 — Projects > ### Early Experiments',
  `Where it all started — from heart disease detection with ensemble learning, to a voice assistant prototype, to a blockchain project built from curiosity. Every project taught something the next one needed.`
);

doc.write('# Ruturaj Solanki > ## 04 — Background',
  `Computer Science from R.N.G. Patel Institute of Technology. Data Analytics from St. Clair College, Canada.\n\nI went from writing Java assignments to building AI research tools — not because of a plan, but because every interesting problem led to the next one.`
);

doc.write('# Ruturaj Solanki > ## 05 — Skills',
  `- Python
- JavaScript / TypeScript
- AI & Machine Learning
- Data Analytics & Visualization
- Node.js Ecosystem
- Markdown & Structured Content`
);

doc.write('# Ruturaj Solanki > ## 06 — Connect',
  `I'm always interested in conversations about AI architecture, structured content, and tools that make thinking clearer.\n\n- Email → ruturaaj@synexiomlabs.com\n- GitHub → [Robo-Codes](https://github.com/Robo-Codes)\n- LinkedIn → [Connect](https://linkedin.com/in/ruturaj-solanki)`
);

// Step 3: Verify what we built
console.log('Step 3: Verifying content via Nodiom read operations...\n');

const sections = [
  '# Ruturaj Solanki > ## 00 — Opening',
  '# Ruturaj Solanki > ## 01 — What I Do',
  '# Ruturaj Solanki > ## 02 — Philosophy',
  '# Ruturaj Solanki > ## 03 — Projects > ### Nodiom',
  '# Ruturaj Solanki > ## 04 — Background',
  '# Ruturaj Solanki > ## 05 — Skills',
  '# Ruturaj Solanki > ## 06 — Connect',
];

for (const sel of sections) {
  const q = doc.query(sel);
  const content = doc.read(sel);
  const preview = content.substring(0, 60).replace(/\n/g, ' ');
  console.log(`  ${q.exists ? '✓' : '✗'} ${sel.split(' > ').pop()} → "${preview}..."`);
}

const skills = doc.readList('# Ruturaj Solanki > ## 05 — Skills');
console.log(`\n  Skills (via readList): ${skills.length} items`);
skills.forEach(s => console.log(`    ${s}`));

// Step 4: Generate the final Markdown
const finalMd = doc.toString();
await writeFile('./site.md', finalMd);
console.log(`\nStep 4: Saved site.md (${finalMd.length} chars)\n`);

// Step 5: Convert to HTML with a minimal, text-forward design
console.log('Step 5: Generating HTML...\n');

function mdSectionToHtml(content, tag = 'p') {
  return content
    .split('\n\n')
    .map(block => {
      block = block.trim();
      if (!block) return '';
      if (block.startsWith('- ')) {
        const items = block.split('\n').map(l => {
          const text = l.replace(/^- /, '');
          return `      <li>${escapeAndLinkify(text)}</li>`;
        });
        return `    <ul>\n${items.join('\n')}\n    </ul>`;
      }
      return `    <${tag}>${escapeAndLinkify(block)}</${tag}>`;
    })
    .filter(Boolean)
    .join('\n');
}

function escapeAndLinkify(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

const projectSections = ['Synexiom Labs', 'Nodiom', 'Data &amp; Analytics', 'Early Experiments'];
const projectKeys = ['Synexiom Labs', 'Nodiom', 'Data & Analytics', 'Early Experiments'];

let projectsHtml = '';
for (const name of projectKeys) {
  const content = doc.read(`# Ruturaj Solanki > ## 03 — Projects > ### ${name}`);
  projectsHtml += `
    <div class="project">
      <h3>${escapeAndLinkify(name)}</h3>
${mdSectionToHtml(content)}
    </div>`;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ruturaj Solanki</title>
  <style>
    :root {
      --fg: #1a1a1a;
      --fg-muted: #666;
      --bg: #fafaf8;
      --accent: #333;
      --border: #e0e0dc;
      --section-gap: 6rem;
      --font: 'Georgia', 'Times New Roman', serif;
      --font-mono: 'SF Mono', 'Fira Code', monospace;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --fg: #e8e8e4;
        --fg-muted: #999;
        --bg: #111110;
        --accent: #ccc;
        --border: #2a2a28;
      }
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: var(--font);
      color: var(--fg);
      background: var(--bg);
      line-height: 1.7;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      max-width: 680px;
      margin: 0 auto;
      padding: 4rem 2rem 6rem;
    }

    header {
      margin-bottom: var(--section-gap);
    }

    header h1 {
      font-size: 1.1rem;
      font-weight: 400;
      letter-spacing: 0.02em;
    }

    .section {
      margin-bottom: var(--section-gap);
    }

    .section-number {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--fg-muted);
      letter-spacing: 0.1em;
      margin-bottom: 1rem;
      display: block;
    }

    .section h2 {
      font-size: 1.6rem;
      font-weight: 400;
      margin-bottom: 1.5rem;
      line-height: 1.3;
    }

    .section p {
      color: var(--fg-muted);
      font-size: 0.95rem;
      margin-bottom: 1rem;
    }

    .section ul {
      list-style: none;
      padding: 0;
    }

    .section li {
      color: var(--fg-muted);
      font-size: 0.95rem;
      padding: 0.3rem 0;
      border-bottom: 1px solid var(--border);
    }

    .section li:last-child {
      border-bottom: none;
    }

    .project {
      margin-bottom: 2.5rem;
      padding-bottom: 2.5rem;
      border-bottom: 1px solid var(--border);
    }

    .project:last-child {
      border-bottom: none;
    }

    .project h3 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
    }

    a {
      color: var(--fg);
      text-decoration: none;
      border-bottom: 1px solid var(--border);
      transition: border-color 0.2s;
    }

    a:hover {
      border-color: var(--fg);
    }

    .divider {
      width: 2rem;
      height: 1px;
      background: var(--border);
      margin: var(--section-gap) 0;
    }

    footer {
      margin-top: var(--section-gap);
      padding-top: 2rem;
      border-top: 1px solid var(--border);
    }

    footer p {
      font-size: 0.8rem;
      color: var(--fg-muted);
    }

    .connect-links {
      list-style: none;
      padding: 0;
    }

    .connect-links li {
      font-size: 0.95rem;
      padding: 0.5rem 0;
      color: var(--fg-muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Ruturaj Solanki</h1>
    </header>

    <section class="section">
      <span class="section-number">00</span>
${mdSectionToHtml(doc.read('# Ruturaj Solanki > ## 00 — Opening'))}
    </section>

    <div class="divider"></div>

    <section class="section">
      <span class="section-number">01</span>
      <h2>What I Do</h2>
${mdSectionToHtml(doc.read('# Ruturaj Solanki > ## 01 — What I Do'))}
    </section>

    <section class="section">
      <span class="section-number">02</span>
      <h2>Philosophy</h2>
${mdSectionToHtml(doc.read('# Ruturaj Solanki > ## 02 — Philosophy'))}
    </section>

    <div class="divider"></div>

    <section class="section">
      <span class="section-number">03</span>
      <h2>Projects</h2>
${projectsHtml}
    </section>

    <div class="divider"></div>

    <section class="section">
      <span class="section-number">04</span>
      <h2>Background</h2>
${mdSectionToHtml(doc.read('# Ruturaj Solanki > ## 04 — Background'))}
    </section>

    <section class="section">
      <span class="section-number">05</span>
      <h2>Skills</h2>
${mdSectionToHtml(doc.read('# Ruturaj Solanki > ## 05 — Skills'))}
    </section>

    <div class="divider"></div>

    <section class="section">
      <span class="section-number">06</span>
      <h2>Connect</h2>
${mdSectionToHtml(doc.read('# Ruturaj Solanki > ## 06 — Connect'))}
    </section>

    <footer>
      <p>Built with Nodiom — structured Markdown, rendered to HTML.</p>
    </footer>
  </div>
</body>
</html>`;

await writeFile('./site.html', html);
console.log(`Generated site.html (${html.length} chars)`);
console.log('\nDone! Open site.html in a browser to see the result.');
