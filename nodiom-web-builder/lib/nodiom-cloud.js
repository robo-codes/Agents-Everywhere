import { readFile } from 'fs/promises';
import { resolve } from 'path';

class NodiomCloud {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.endpoint = 'https://api.nodiom.md/mcp';
    this._reqId = 0;
  }

  static async fromEnv(envPath) {
    const envFile = await readFile(resolve(envPath || '.env'), 'utf-8');
    const match = envFile.match(/NODIOM_API_KEY=(.+)/i);
    if (!match) throw new Error('nodiom_api_key not found in .env');
    return new NodiomCloud(match[1].trim());
  }

  async _call(toolName, args = {}) {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: ++this._reqId,
        method: 'tools/call',
        params: { name: toolName, arguments: args },
      }),
    });

    const raw = await res.text();
    const dataLine = raw.split('\n').find(l => l.startsWith('data: '));
    if (!dataLine) throw new Error(`Unexpected response: ${raw.substring(0, 200)}`);

    const parsed = JSON.parse(dataLine.replace('data: ', ''));
    if (parsed.result?.isError) {
      const msg = parsed.result.content?.[0]?.text || 'Unknown error';
      throw new Error(`Nodiom API error: ${msg}`);
    }
    return parsed.result?.content?.[0]?.text || '';
  }

  async listDocs() { return this._call('nodiom_list_docs'); }

  async createDoc(docId, content) {
    return this._call('nodiom_create_doc', { doc_id: docId, content });
  }

  async getDoc(docId) {
    return this._call('nodiom_get_doc', { doc_id: docId });
  }

  async deleteDoc(docId) {
    return this._call('nodiom_delete_doc', { doc_id: docId });
  }

  async tree(docId) {
    const text = await this._call('nodiom_tree', { doc_id: docId });
    return JSON.parse(text);
  }

  async read(docId, selector) {
    return this._call('nodiom_read', { doc_id: docId, selector });
  }

  async readList(docId, selector) {
    const text = await this._call('nodiom_read_list', { doc_id: docId, selector });
    return JSON.parse(text);
  }

  async query(docId, selector) {
    const text = await this._call('nodiom_query', { doc_id: docId, selector });
    return JSON.parse(text);
  }

  async write(docId, selector, content) {
    return this._call('nodiom_write', { doc_id: docId, selector, new_content: content });
  }

  async append(docId, selector, content) {
    return this._call('nodiom_append', { doc_id: docId, selector, new_content: content });
  }

  async delete(docId, selector) {
    return this._call('nodiom_delete', { doc_id: docId, selector });
  }

  // Board operations
  async boardCreate(title, columns) {
    const args = { title };
    if (columns) args.columns = columns;
    const text = await this._call('board_create', args);
    return text;
  }

  async boardRead(docId) {
    const text = await this._call('board_read', { doc_id: docId });
    return JSON.parse(text);
  }

  async boardAddCard(docId, title, opts = {}) {
    return this._call('board_add_card', { doc_id: docId, title, ...opts });
  }

  async boardMoveCard(docId, cardId, to, agent) {
    const args = { doc_id: docId, card_id: cardId, to };
    if (agent) args.agent = agent;
    return this._call('board_move_card', args);
  }
}

export { NodiomCloud };
