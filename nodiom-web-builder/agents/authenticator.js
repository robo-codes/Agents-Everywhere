import { Nodiom, SelectorNotFoundError, AmbiguousSelectorError } from '@synexiom-labs/nodiom';

/**
 * Agent 3: The Authenticator
 *
 * A safe wrapper around Nodiom that catches the known gotchas before they bite.
 * Every read/write operation goes through here so the Reader and Builder never
 * hit silent failures.
 */

const GOTCHAS = {
  DEPTH_MISMATCH: 'DEPTH_MISMATCH',
  PARENT_OVERWRITE: 'PARENT_OVERWRITE',
  LIST_PREFIX: 'LIST_PREFIX',
  SELECTOR_NOT_FOUND: 'SELECTOR_NOT_FOUND',
  AMBIGUOUS_SELECTOR: 'AMBIGUOUS_SELECTOR',
};

class AuthenticatorAgent {
  constructor(doc, { verbose = true } = {}) {
    this.doc = doc;
    this.verbose = verbose;
    this.log = [];
  }

  _record(level, gotcha, message, detail) {
    const entry = { level, gotcha, message, detail, timestamp: Date.now() };
    this.log.push(entry);
    if (this.verbose) {
      const icon = level === 'error' ? '✗' : level === 'warn' ? '⚠' : '✓';
      console.log(`  [auth] ${icon} ${message}`);
    }
    return entry;
  }

  _ok(message) { return this._record('ok', null, message); }
  _warn(gotcha, message, detail) { return this._record('warn', gotcha, message, detail); }
  _error(gotcha, message, detail) { return this._record('error', gotcha, message, detail); }

  // --- Gotcha 1: Validate selector depth against the document ---
  validateSelector(selector) {
    const segments = selector.split(' > ').map(s => s.trim());
    const issues = [];

    for (const seg of segments) {
      const headingMatch = seg.match(/^(#{1,6})\s+/);
      if (!headingMatch) continue;

      const declaredDepth = headingMatch[1].length;
      const segIndex = segments.indexOf(seg);

      if (segIndex === 0 && declaredDepth !== 1 && segments.length > 1) {
        // First segment isn't H1 but there are child selectors — might work
        // if the heading IS at that depth in the doc, but worth a note
      }

      // Check parent-child depth consistency
      if (segIndex > 0) {
        const parentMatch = segments[segIndex - 1].match(/^(#{1,6})\s+/);
        if (parentMatch) {
          const parentDepth = parentMatch[1].length;
          if (declaredDepth <= parentDepth) {
            issues.push(this._warn(
              GOTCHAS.DEPTH_MISMATCH,
              `Child "${seg}" (h${declaredDepth}) is not deeper than parent (h${parentDepth})`,
              { selector, segment: seg }
            ));
          }
        }
      }
    }

    // Now actually test against the document
    try {
      const result = this.doc.query(selector);
      if (!result.exists) {
        // Try to figure out why — get the tree and check
        const tree = this.doc.tree();
        const suggestion = this._findClosestMatch(selector, tree);
        issues.push(this._error(
          GOTCHAS.SELECTOR_NOT_FOUND,
          `Selector "${selector}" does not exist in document` +
            (suggestion ? `. Try: "${suggestion}"` : ''),
          { selector, suggestion }
        ));
      }
    } catch (e) {
      if (e instanceof SelectorNotFoundError) {
        const hint = e.suggestions?.length ? e.suggestions.join(', ') : null;
        issues.push(this._error(
          GOTCHAS.SELECTOR_NOT_FOUND,
          `Selector "${selector}" not found` + (hint ? `. Suggestions: ${hint}` : ''),
          { selector, suggestions: e.suggestions }
        ));
      } else if (e instanceof AmbiguousSelectorError) {
        issues.push(this._error(
          GOTCHAS.AMBIGUOUS_SELECTOR,
          `Selector "${selector}" matches ${e.matchCount} nodes — be more specific`,
          { selector, matchCount: e.matchCount }
        ));
      } else {
        throw e;
      }
    }

    return { valid: issues.every(i => i.level !== 'error'), issues };
  }

  _findClosestMatch(selector, tree, prefix = '') {
    const segments = selector.split(' > ').map(s => s.trim());
    const target = segments[segments.length - 1].replace(/^#{1,6}\s+/, '');

    for (const node of tree) {
      const fullPath = prefix ? `${prefix} > ${'#'.repeat(node.depth)} ${node.heading}` : `${'#'.repeat(node.depth)} ${node.heading}`;
      if (node.heading.toLowerCase() === target.toLowerCase()) {
        return fullPath;
      }
      if (node.children.length) {
        const childResult = this._findClosestMatch(selector, node.children, fullPath);
        if (childResult) return childResult;
      }
    }
    return null;
  }

  // --- Gotcha 2: Check if write() would wipe children ---
  checkWriteSafety(selector) {
    const validation = this.validateSelector(selector);
    if (!validation.valid) return validation;

    try {
      const content = this.doc.read(selector);
      const hasChildHeadings = /^#{1,6}\s+/m.test(content);

      if (hasChildHeadings) {
        this._warn(
          GOTCHAS.PARENT_OVERWRITE,
          `write("${selector}") will REPLACE child headings. Use a more specific selector to target a subsection.`,
          { selector, childContent: content.substring(0, 200) }
        );
        return { valid: true, hasChildren: true, issues: validation.issues };
      }
    } catch {
      // If read fails, the selector validation already caught it
    }

    return { valid: true, hasChildren: false, issues: validation.issues };
  }

  // --- Gotcha 3: Clean readList results ---
  cleanList(items) {
    const cleaned = items.map(item => {
      const stripped = item.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '');
      if (stripped !== item) {
        this._warn(
          GOTCHAS.LIST_PREFIX,
          `readList() returned prefixed items — stripping markdown markers`,
          { original: item, cleaned: stripped }
        );
      }
      return stripped;
    });
    return cleaned;
  }

  // --- Safe wrappers around every Nodiom operation ---

  safeRead(selector) {
    const v = this.validateSelector(selector);
    if (!v.valid) throw new Error(`Auth blocked read: ${v.issues.map(i => i.message).join('; ')}`);
    this._ok(`read("${selector}") — selector valid`);
    return this.doc.read(selector);
  }

  safeReadList(selector) {
    const v = this.validateSelector(selector);
    if (!v.valid) throw new Error(`Auth blocked readList: ${v.issues.map(i => i.message).join('; ')}`);
    const raw = this.doc.readList(selector);
    return this.cleanList(raw);
  }

  safeWrite(selector, content) {
    const safety = this.checkWriteSafety(selector);
    if (!safety.valid) throw new Error(`Auth blocked write: ${safety.issues.map(i => i.message).join('; ')}`);
    if (safety.hasChildren) {
      this._warn(
        GOTCHAS.PARENT_OVERWRITE,
        `Proceeding with write to "${selector}" — child headings will be replaced. This is intentional if you're rewriting the whole section.`
      );
    }
    this._ok(`write("${selector}") — safe to proceed`);
    this.doc.write(selector, content);
    return this;
  }

  safeAppend(selector, content) {
    const v = this.validateSelector(selector);
    if (!v.valid) throw new Error(`Auth blocked append: ${v.issues.map(i => i.message).join('; ')}`);
    this._ok(`append("${selector}") — selector valid`);
    this.doc.append(selector, content);
    return this;
  }

  safeDelete(selector) {
    const v = this.validateSelector(selector);
    if (!v.valid) throw new Error(`Auth blocked delete: ${v.issues.map(i => i.message).join('; ')}`);
    this._ok(`delete("${selector}") — selector valid`);
    this.doc.delete(selector);
    return this;
  }

  // --- Build a correct selector from the document tree ---
  buildSelector(headingName, parentSelector = null) {
    const tree = this.doc.tree();
    const found = this._searchTree(tree, headingName);
    if (!found) return null;

    if (parentSelector) {
      return `${parentSelector} > ${'#'.repeat(found.depth)} ${found.heading}`;
    }
    return `${'#'.repeat(found.depth)} ${found.heading}`;
  }

  _searchTree(nodes, name) {
    for (const node of nodes) {
      if (node.heading === name) return node;
      if (node.children.length) {
        const child = this._searchTree(node.children, name);
        if (child) return child;
      }
    }
    return null;
  }

  // --- Full document validation ---
  validateDocument() {
    const tree = this.doc.tree();
    const issues = [];

    if (tree.length === 0) {
      issues.push(this._warn(null, 'Document has no headings'));
    }

    const allSelectors = this._collectAllSelectors(tree);
    for (const sel of allSelectors) {
      const v = this.validateSelector(sel);
      if (v.valid) {
        this._ok(`"${sel}" — reachable`);
      }
    }

    return {
      valid: issues.every(i => i.level !== 'error'),
      selectorCount: allSelectors.length,
      issues,
      fullLog: this.log,
    };
  }

  _collectAllSelectors(nodes, prefix = '') {
    const selectors = [];
    for (const node of nodes) {
      const sel = prefix
        ? `${prefix} > ${'#'.repeat(node.depth)} ${node.heading}`
        : `${'#'.repeat(node.depth)} ${node.heading}`;
      selectors.push(sel);
      if (node.children.length) {
        selectors.push(...this._collectAllSelectors(node.children, sel));
      }
    }
    return selectors;
  }

  getReport() {
    const errors = this.log.filter(l => l.level === 'error');
    const warnings = this.log.filter(l => l.level === 'warn');
    const ok = this.log.filter(l => l.level === 'ok');
    return {
      summary: `${ok.length} ok, ${warnings.length} warnings, ${errors.length} errors`,
      errors,
      warnings,
      ok,
      total: this.log.length,
    };
  }
}

export { AuthenticatorAgent, GOTCHAS };
