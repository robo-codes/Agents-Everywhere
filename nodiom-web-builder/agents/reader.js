import { Nodiom } from '@synexiom-labs/nodiom';
import { AuthenticatorAgent } from './authenticator.js';

/**
 * Agent 1: The Reader
 *
 * Fetches a target website, analyzes its structure, design, and content,
 * then produces a Nodiom-managed Markdown blueprint that the Builder can follow.
 */

class ReaderAgent {
  constructor({ verbose = true } = {}) {
    this.verbose = verbose;
  }

  _log(msg) {
    if (this.verbose) console.log(`  [reader] ${msg}`);
  }

  async fetchSite(url) {
    this._log(`Fetching ${url}...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    const html = await res.text();
    this._log(`Got ${html.length} chars of HTML`);
    return html;
  }

  analyzeSite(html, url) {
    this._log('Analyzing site structure...');

    const analysis = {
      url,
      meta: this._extractMeta(html),
      sections: this._extractSections(html),
      navigation: this._extractNav(html),
      styles: this._extractStyles(html),
      links: this._extractLinks(html),
    };

    this._log(`Found ${analysis.sections.length} sections, ${analysis.links.length} links`);
    return analysis;
  }

  _extractMeta(html) {
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || '';
    const description = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] || '';
    const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i)?.[1] || '';
    return { title, description, ogImage };
  }

  _extractSections(html) {
    const sections = [];
    const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || html;

    // Extract text blocks with their context
    const headingRegex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
    let match;
    while ((match = headingRegex.exec(body)) !== null) {
      const level = parseInt(match[1][1]);
      const text = this._stripTags(match[2]).trim();
      if (text) {
        sections.push({ level, text, index: match.index });
      }
    }

    // Extract paragraphs near headings
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    const paragraphs = [];
    while ((match = pRegex.exec(body)) !== null) {
      const text = this._stripTags(match[2] || match[1]).trim();
      if (text && text.length > 10) {
        paragraphs.push({ text, index: match.index });
      }
    }

    // Associate paragraphs with nearest preceding heading
    for (const section of sections) {
      section.content = paragraphs
        .filter(p => {
          const nextHeading = sections.find(s => s.index > section.index && s.index > p.index);
          return p.index > section.index && (!nextHeading || p.index < nextHeading.index);
        })
        .map(p => p.text);
    }

    return sections;
  }

  _extractNav(html) {
    const navMatch = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/i);
    if (!navMatch) return [];
    const links = [];
    const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = linkRegex.exec(navMatch[1])) !== null) {
      links.push({ href: m[1], text: this._stripTags(m[2]).trim() });
    }
    return links;
  }

  _extractStyles(html) {
    const styles = {
      fonts: [],
      colors: [],
      layout: 'unknown',
    };

    // Extract Google Fonts
    const fontLinks = html.match(/fonts\.googleapis\.com\/css2\?[^"']*/g) || [];
    for (const link of fontLinks) {
      const families = link.match(/family=([^&"']+)/g) || [];
      styles.fonts.push(...families.map(f => decodeURIComponent(f.replace('family=', '').replace(/\+/g, ' '))));
    }

    // Extract CSS custom properties (colors)
    const cssVarRegex = /--[\w-]+\s*:\s*(#[a-fA-F0-9]{3,8}|rgb[a]?\([^)]+\)|hsl[a]?\([^)]+\))/g;
    let m;
    const allCss = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || []).join('\n');
    while ((m = cssVarRegex.exec(allCss)) !== null) {
      styles.colors.push(m[0].trim());
    }

    // Detect layout approach
    if (allCss.includes('grid')) styles.layout = 'css-grid';
    else if (allCss.includes('flex')) styles.layout = 'flexbox';

    return styles;
  }

  _extractLinks(html) {
    const links = [];
    const linkRegex = /<a[^>]*href=["'](https?:\/\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = linkRegex.exec(html)) !== null) {
      const text = this._stripTags(m[2]).trim();
      if (text) links.push({ href: m[1], text });
    }
    return links;
  }

  _stripTags(html) {
    return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '').trim();
  }

  // --- Build the Nodiom-managed blueprint ---
  buildBlueprint(analysis, ownerInfo) {
    this._log('Building Nodiom blueprint...');

    const skeleton = `---
source: ${analysis.url}
generated: ${new Date().toISOString()}
type: website-blueprint
---

# Blueprint

## Meta

## Design

### Typography

### Colors

### Layout

## Structure

## Sections

## Content Map

## Owner
`;

    const doc = Nodiom.fromString(skeleton);
    const auth = new AuthenticatorAgent(doc, { verbose: this.verbose });

    // Validate the skeleton first
    this._log('Authenticator validating blueprint skeleton...');
    auth.validateDocument();

    // Fill Meta
    auth.safeWrite('# Blueprint > ## Meta',
      `- Title: ${analysis.meta.title}\n` +
      `- Description: ${analysis.meta.description || 'None found'}\n` +
      `- Source URL: ${analysis.url}\n` +
      `- Sections found: ${analysis.sections.length}\n` +
      `- External links: ${analysis.links.length}`
    );

    // Fill Design
    auth.safeWrite('# Blueprint > ## Design > ### Typography',
      analysis.styles.fonts.length
        ? analysis.styles.fonts.map(f => `- ${f}`).join('\n')
        : '- No custom fonts detected (system defaults)'
    );

    auth.safeWrite('# Blueprint > ## Design > ### Colors',
      analysis.styles.colors.length
        ? analysis.styles.colors.slice(0, 15).map(c => `- ${c}`).join('\n')
        : '- No CSS custom property colors detected'
    );

    auth.safeWrite('# Blueprint > ## Design > ### Layout',
      `- Approach: ${analysis.styles.layout}\n` +
      `- Navigation: ${analysis.navigation.length ? analysis.navigation.map(n => n.text).join(', ') : 'None detected'}`
    );

    // Fill Structure — this is the key section the Builder reads
    const structureLines = analysis.sections.map(s =>
      `- ${'  '.repeat(s.level - 1)}[h${s.level}] ${s.text}`
    );
    auth.safeWrite('# Blueprint > ## Structure',
      structureLines.join('\n') || '- No heading structure detected'
    );

    // Fill Sections with actual content
    const sectionEntries = analysis.sections
      .filter(s => s.content && s.content.length > 0)
      .map(s => `### ${s.text}\n\n${s.content.join('\n\n')}`)
      .join('\n\n');
    auth.safeWrite('# Blueprint > ## Sections',
      sectionEntries || 'No content sections extracted.'
    );

    // Fill Content Map — what links where
    const contentMap = analysis.links
      .filter((l, i, arr) => arr.findIndex(x => x.href === l.href) === i) // dedupe
      .slice(0, 20)
      .map(l => `- [${l.text}](${l.href})`)
      .join('\n');
    auth.safeWrite('# Blueprint > ## Content Map',
      contentMap || '- No external links found'
    );

    // Fill Owner info — who this site is being built FOR
    auth.safeWrite('# Blueprint > ## Owner',
      Object.entries(ownerInfo).map(([k, v]) => `- ${k}: ${v}`).join('\n')
    );

    // Final validation
    this._log('Authenticator final validation...');
    const report = auth.validateDocument();
    const authReport = auth.getReport();

    this._log(`Blueprint complete — ${authReport.summary}`);

    return { doc, auth, report: authReport };
  }
}

export { ReaderAgent };
