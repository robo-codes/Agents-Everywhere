import { Nodiom } from '@synexiom-labs/nodiom';
import { AuthenticatorAgent } from './authenticator.js';

/**
 * Agent 2: The Builder
 *
 * Reads a Nodiom blueprint and generates a complete HTML website.
 * All reads go through the Authenticator — no raw Nodiom calls.
 */

class BuilderAgent {
  constructor({ verbose = true } = {}) {
    this.verbose = verbose;
  }

  _log(msg) {
    if (this.verbose) console.log(`  [builder] ${msg}`);
  }

  build(blueprintDoc, designOverrides = {}) {
    const auth = new AuthenticatorAgent(blueprintDoc, { verbose: this.verbose });

    this._log('Reading blueprint via Authenticator...');

    // Read every section through the authenticator
    const meta = this._parseMeta(auth.safeRead('# Blueprint > ## Meta'));
    const typography = auth.safeRead('# Blueprint > ## Design > ### Typography');
    const colors = auth.safeRead('# Blueprint > ## Design > ### Colors');
    const layout = auth.safeRead('# Blueprint > ## Design > ### Layout');
    const structure = auth.safeRead('# Blueprint > ## Structure');
    const sections = auth.safeRead('# Blueprint > ## Sections');
    const contentMap = auth.safeRead('# Blueprint > ## Content Map');
    const owner = this._parseMeta(auth.safeRead('# Blueprint > ## Owner'));

    this._log(`Blueprint loaded — "${meta['Title'] || 'Untitled'}"`);
    this._log(`Owner: ${owner['name'] || 'Unknown'}`);

    // Parse section headings from the Sections content
    const sectionBlocks = this._parseSections(sections);
    this._log(`Parsed ${sectionBlocks.length} content sections`);

    // Parse structure to understand hierarchy
    const structureItems = this._parseStructure(structure);
    this._log(`Structure has ${structureItems.length} heading nodes`);

    // Parse links from content map
    const links = this._parseLinks(contentMap);

    // Build the HTML
    const html = this._generateHtml({
      meta, owner, sectionBlocks, structureItems, links,
      typography, colors, layout,
      ...designOverrides,
    });

    // Validate the output
    const report = auth.getReport();
    this._log(`Build complete — auth report: ${report.summary}`);

    return { html, report };
  }

  _parseMeta(content) {
    const meta = {};
    for (const line of content.split('\n')) {
      const match = line.match(/^-\s*(.+?):\s*(.+)$/);
      if (match) meta[match[1].trim()] = match[2].trim();
    }
    return meta;
  }

  _parseSections(content) {
    const blocks = [];
    const parts = content.split(/^### /m).filter(Boolean);
    for (const part of parts) {
      const lines = part.trim().split('\n');
      const title = lines[0].trim();
      const body = lines.slice(1).join('\n').trim();
      if (title) blocks.push({ title, body });
    }
    return blocks;
  }

  _parseStructure(content) {
    const items = [];
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*-\s*(?:\s*)\[h(\d)\]\s*(.+)$/);
      if (match) items.push({ level: parseInt(match[1]), text: match[2].trim() });
    }
    return items;
  }

  _parseLinks(content) {
    const links = [];
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let m;
    while ((m = regex.exec(content)) !== null) {
      links.push({ text: m[1], href: m[2] });
    }
    return links;
  }

  _escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  _mdToHtml(text) {
    return this._escapeHtml(text)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }

  _generateHtml({ meta, owner, sectionBlocks, structureItems, links, typography, colors }) {
    const ownerName = owner['name'] || meta['Title'] || 'Portfolio';
    const ownerTagline = owner['tagline'] || meta['Description'] || '';
    const ownerEmail = owner['email'] || '';
    const ownerGithub = owner['github'] || '';
    const ownerGithubUser = owner['github_user'] || '';
    const ownerLinkedin = owner['linkedin'] || '';

    // Build section HTML
    let sectionsHtml = '';
    for (const block of sectionBlocks) {
      const paragraphs = block.body
        .split('\n\n')
        .filter(Boolean)
        .map(p => {
          p = p.trim();
          if (p.startsWith('- ')) {
            const items = p.split('\n')
              .map(l => l.replace(/^-\s*/, '').trim())
              .filter(Boolean)
              .map(l => `          <li>${this._mdToHtml(l)}</li>`)
              .join('\n');
            return `        <ul>\n${items}\n        </ul>`;
          }
          // Check for links on their own line (like "Explore →")
          if (/^\[.+\]\(.+\)$/.test(p)) {
            const linkMatch = p.match(/\[([^\]]+)\]\(([^)]+)\)/);
            return `        <p><a class="section-link" href="${linkMatch[2]}">${this._escapeHtml(linkMatch[1])}</a></p>`;
          }
          return `        <p>${this._mdToHtml(p)}</p>`;
        })
        .join('\n');

      sectionsHtml += `
      <section class="section" id="${this._slugify(block.title)}">
        <span class="section-label">${this._escapeHtml(block.title)}</span>
${paragraphs}
      </section>\n`;
    }

    // Build structure tree (the decorative outline)
    const treeHtml = structureItems
      .map((item, i) => {
        const indent = item.level - 1;
        const isLast = i === structureItems.length - 1 ||
          (structureItems[i + 1] && structureItems[i + 1].level <= item.level);
        const connector = indent === 0 ? '' :
          isLast ? '└── ' : '├── ';
        const pad = indent > 0 ? '│   '.repeat(indent - 1) : '';
        return `    <div class="tree-line" style="padding-left:${indent * 1.2}rem">${pad}${connector}${this._escapeHtml(item.text).toLowerCase().replace(/\s+/g, '-')}</div>`;
      })
      .join('\n');

    // Connect section
    let connectHtml = '';
    if (ownerEmail || ownerGithub || ownerLinkedin) {
      const connectItems = [];
      if (ownerEmail) connectItems.push(`        <li>Email <span class="arr">&rarr;</span> <a href="mailto:${ownerEmail}">${ownerEmail}</a></li>`);
      if (ownerGithub) connectItems.push(`        <li>GitHub <span class="arr">&rarr;</span> <a href="${ownerGithub}">${ownerGithubUser || 'Profile'}</a></li>`);
      if (ownerLinkedin) connectItems.push(`        <li>LinkedIn <span class="arr">&rarr;</span> <a href="${ownerLinkedin}">Connect</a></li>`);

      connectHtml = `
      <section class="section" id="connect">
        <span class="section-label">Connect</span>
        <ul class="connect-list">
${connectItems.join('\n')}
        </ul>
      </section>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${this._escapeHtml(ownerName)}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=Instrument+Serif:ital@0;1&display=swap">
  <style>
    :root {
      --fg: #1c1c1a;
      --fg-secondary: #5c5c58;
      --fg-dim: #9a9a94;
      --bg: #f6f5f0;
      --bg-inset: #eeedea;
      --accent: #2d5a3d;
      --rule: #d4d3cc;
      --font-display: 'Instrument Serif', 'Georgia', serif;
      --font-mono: 'DM Mono', 'SF Mono', 'Consolas', monospace;
      --measure: 640px;
      --gutter: 20px;
      color-scheme: light;
    }

    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) {
        --fg: #e4e3de;
        --fg-secondary: #a8a8a2;
        --fg-dim: #6b6b66;
        --bg: #131312;
        --bg-inset: #1c1c1a;
        --accent: #6db87f;
        --rule: #2e2e2a;
        color-scheme: dark;
      }
    }
    :root[data-theme="dark"] {
      --fg: #e4e3de;
      --fg-secondary: #a8a8a2;
      --fg-dim: #6b6b66;
      --bg: #131312;
      --bg-inset: #1c1c1a;
      --accent: #6db87f;
      --rule: #2e2e2a;
      color-scheme: dark;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: var(--font-mono);
      font-size: 13px;
      line-height: 1.75;
      color: var(--fg);
      background: var(--bg);
      padding-inline: var(--gutter);
      -webkit-font-smoothing: antialiased;
      font-weight: 300;
    }

    .page {
      max-width: var(--measure);
      margin: 0 auto;
      padding-block: 5rem 6rem;
    }

    header {
      margin-bottom: 4rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid var(--rule);
    }

    header h1 {
      font-family: var(--font-display);
      font-size: clamp(2.4rem, 6vw, 3.6rem);
      font-weight: 400;
      line-height: 1.1;
      text-wrap: balance;
      letter-spacing: -0.02em;
    }

    header .tagline {
      font-family: var(--font-display);
      font-size: 1.15rem;
      font-style: italic;
      color: var(--fg-secondary);
      margin-top: 0.75rem;
    }

    .tree-view {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--fg-dim);
      line-height: 1.6;
      margin-bottom: 4rem;
      opacity: 0.65;
      user-select: none;
      letter-spacing: 0.02em;
    }

    .section {
      margin-bottom: 4rem;
    }

    .section-label {
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--fg-dim);
      margin-bottom: 1.25rem;
      display: block;
    }

    .section h2 {
      font-family: var(--font-display);
      font-size: 1.75rem;
      font-weight: 400;
      text-wrap: balance;
      margin-bottom: 1.25rem;
    }

    .section p {
      color: var(--fg-secondary);
      max-width: 56ch;
      margin-bottom: 0.75rem;
    }

    .section p:last-child { margin-bottom: 0; }

    .section ul {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .section li {
      color: var(--fg-secondary);
      font-size: 12px;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--rule);
    }

    .section li:last-child { border-bottom: none; }

    .section-link {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--accent);
      text-decoration: none;
      transition: color 0.2s;
    }

    .section-link:hover { color: var(--fg); }

    hr.rule {
      border: none;
      border-top: 1px solid var(--rule);
      margin-bottom: 4rem;
    }

    a {
      color: var(--accent);
      text-decoration: none;
      transition: color 0.2s;
    }

    a:hover { color: var(--fg); }

    .connect-list { list-style: none; }
    .connect-list li { padding: 0.4rem 0; font-size: 12px; color: var(--fg-secondary); }
    .arr { color: var(--fg-dim); font-family: var(--font-mono); }

    footer {
      margin-top: 5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--rule);
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    footer span { font-size: 10px; color: var(--fg-dim); letter-spacing: 0.05em; }

    @media (max-width: 500px) {
      .page { padding-block: 3rem 4rem; }
      header h1 { font-size: 2rem; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header>
      <h1>${this._escapeHtml(ownerName)}</h1>
      ${ownerTagline ? `<p class="tagline">${this._escapeHtml(ownerTagline)}</p>` : ''}
    </header>

    <div class="tree-view" aria-hidden="true">
      <div>${this._slugify(ownerName)}/</div>
${treeHtml}
    </div>

${sectionsHtml}
    <hr class="rule">
${connectHtml}

    <footer>
      <span>Built with Nodiom</span>
      <span>Structured content, rendered to HTML</span>
    </footer>
  </div>
</body>
</html>`;
  }

  _slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
}

export { BuilderAgent };
