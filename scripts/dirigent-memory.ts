#!/usr/bin/env node
/**
 * Dirigent Memory — SQLite RAG for persistent project knowledge
 *
 * Hybrid search: FTS5 full-text + structured metadata + optional vector embeddings
 * Zero external dependencies for base functionality (better-sqlite3 only)
 * Optional: vector search via Anthropic/OpenAI embeddings
 *
 * Usage:
 *   npx ts-node scripts/dirigent-memory.ts store --type=pattern --phase=analyse --content="..."
 *   npx ts-node scripts/dirigent-memory.ts search "authentication middleware pattern"
 *   npx ts-node scripts/dirigent-memory.ts context "implement OAuth2 login"
 *   npx ts-node scripts/dirigent-memory.ts list --type=decision --limit=10
 *   npx ts-node scripts/dirigent-memory.ts prune --older-than=90d
 *   npx ts-node scripts/dirigent-memory.ts export > memory-export.json
 *   npx ts-node scripts/dirigent-memory.ts stats
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ─── Configuration ────────────────────────────────────

const DB_PATH = path.join(process.cwd(), '.dirigent', 'memory.db');
const VECTOR_ENABLED = process.env.DIRIGENT_VECTORS === 'true';
const EMBEDDING_PROVIDER = process.env.DIRIGENT_EMBEDDING_PROVIDER || 'none'; // 'anthropic' | 'openai' | 'ollama' | 'none'
const EMBEDDING_MODEL = process.env.DIRIGENT_EMBEDDING_MODEL || 'text-embedding-3-small';
const EMBEDDING_DIM = parseInt(process.env.DIRIGENT_EMBEDDING_DIM || '1536', 10);
const MAX_RESULTS = 10;

// ─── Types ────────────────────────────────────────────

interface MemoryEntry {
  id: string;
  type: MemoryType;
  category: string;
  content: string;
  metadata: Record<string, unknown>;
  phase: string;
  agent: string;
  feature: string;
  tags: string[];
  relevanceScore: number;
  createdAt: string;
  updatedAt: string;
}

type MemoryType =
  | 'pattern'        // Code pattern discovered in codebase
  | 'convention'     // Naming/structure convention
  | 'decision'       // Architectural decision made
  | 'tech_debt'      // Technical debt identified
  | 'dependency'     // Dependency relationship
  | 'api_contract'   // API contract/shape
  | 'error_pattern'  // Common error and its fix
  | 'performance'    // Performance insight
  | 'security'       // Security consideration
  | 'test_pattern'   // Testing pattern used
  | 'deployment'     // Deployment configuration
  | 'migration'      // Database migration history
  | 'review_finding' // Code review finding
  | 'workaround'     // Known workaround for an issue
  | 'custom';        // User-defined

interface SearchResult {
  entry: MemoryEntry;
  score: number;
  matchType: 'fts' | 'metadata' | 'vector' | 'hybrid';
}

// ─── Database Setup ───────────────────────────────────

function ensureDir(): void {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function initDb(): Database.Database {
  ensureDir();
  const db = new Database(DB_PATH);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Main entries table
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      phase TEXT NOT NULL DEFAULT '',
      agent TEXT NOT NULL DEFAULT '',
      feature TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      relevance_score REAL NOT NULL DEFAULT 1.0,
      access_count INTEGER NOT NULL DEFAULT 0,
      last_accessed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // FTS5 full-text search index
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      type,
      category,
      tags,
      feature,
      content='memories',
      content_rowid='rowid',
      tokenize='porter unicode61'
    )
  `);

  // Triggers to keep FTS in sync
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content, type, category, tags, feature)
      VALUES (new.rowid, new.content, new.type, new.category, new.tags, new.feature);
    END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, type, category, tags, feature)
      VALUES ('delete', old.rowid, old.content, old.type, old.category, old.tags, old.feature);
    END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, type, category, tags, feature)
      VALUES ('delete', old.rowid, old.content, old.type, old.category, old.tags, old.feature);
      INSERT INTO memories_fts(rowid, content, type, category, tags, feature)
      VALUES (new.rowid, new.content, new.type, new.category, new.tags, new.feature);
    END
  `);

  // Vector embeddings table (optional)
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_vectors (
      memory_id TEXT PRIMARY KEY REFERENCES memories(id) ON DELETE CASCADE,
      embedding BLOB NOT NULL,
      model TEXT NOT NULL,
      dimensions INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
    CREATE INDEX IF NOT EXISTS idx_memories_phase ON memories(phase);
    CREATE INDEX IF NOT EXISTS idx_memories_feature ON memories(feature);
    CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
    CREATE INDEX IF NOT EXISTS idx_memories_relevance ON memories(relevance_score DESC);
  `);

  return db;
}

// ─── Store ────────────────────────────────────────────

function store(
  db: Database.Database,
  entry: Partial<MemoryEntry> & { content: string; type: MemoryType }
): string {
  const id = entry.id || crypto.randomUUID();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO memories (id, type, category, content, metadata, phase, agent, feature, tags, relevance_score, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      content = excluded.content,
      metadata = excluded.metadata,
      tags = excluded.tags,
      relevance_score = excluded.relevance_score,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    id,
    entry.type,
    entry.category || '',
    entry.content,
    JSON.stringify(entry.metadata || {}),
    entry.phase || '',
    entry.agent || '',
    entry.feature || '',
    JSON.stringify(entry.tags || []),
    entry.relevanceScore || 1.0,
    now,
    now
  );

  return id;
}

// ─── Search (FTS5 + Metadata Hybrid) ──────────────────

function search(
  db: Database.Database,
  query: string,
  filters?: { type?: string; phase?: string; feature?: string; limit?: number }
): SearchResult[] {
  const limit = filters?.limit || MAX_RESULTS;
  const results: SearchResult[] = [];

  // 1. FTS5 search (ranked by BM25)
  const ftsQuery = query
    .replace(/[^\w\s]/g, ' ')  // Remove special chars
    .split(/\s+/)
    .filter(w => w.length > 1)
    .map(w => `"${w}"*`)       // Prefix matching
    .join(' OR ');

  if (ftsQuery) {
    const ftsStmt = db.prepare(`
      SELECT
        m.*,
        rank as fts_rank
      FROM memories_fts fts
      JOIN memories m ON m.rowid = fts.rowid
      WHERE memories_fts MATCH ?
      ${filters?.type ? 'AND m.type = ?' : ''}
      ${filters?.phase ? 'AND m.phase = ?' : ''}
      ${filters?.feature ? 'AND m.feature = ?' : ''}
      ORDER BY rank
      LIMIT ?
    `);

    const params: (string | number)[] = [ftsQuery];
    if (filters?.type) params.push(filters.type);
    if (filters?.phase) params.push(filters.phase);
    if (filters?.feature) params.push(filters.feature);
    params.push(limit);

    const rows = ftsStmt.all(...params) as Array<Record<string, unknown>>;

    for (const row of rows) {
      results.push({
        entry: rowToEntry(row),
        score: Math.abs(row.fts_rank as number),
        matchType: 'fts',
      });
    }
  }

  // 2. Metadata search (fallback for short queries or filters-only)
  if (results.length < limit) {
    const remaining = limit - results.length;
    const existingIds = new Set(results.map(r => r.entry.id));

    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const metaStmt = db.prepare(`
      SELECT * FROM memories
      WHERE id NOT IN (${Array.from(existingIds).map(() => '?').join(',') || "''"})
      ${filters?.type ? 'AND type = ?' : ''}
      ${filters?.phase ? 'AND phase = ?' : ''}
      ${filters?.feature ? 'AND feature = ?' : ''}
      ORDER BY relevance_score DESC, updated_at DESC
      LIMIT ?
    `);

    const metaParams: (string | number)[] = [...existingIds];
    if (filters?.type) metaParams.push(filters.type);
    if (filters?.phase) metaParams.push(filters.phase);
    if (filters?.feature) metaParams.push(filters.feature);
    metaParams.push(remaining);

    const metaRows = metaStmt.all(...metaParams) as Array<Record<string, unknown>>;

    for (const row of metaRows) {
      const content = (row.content as string).toLowerCase();
      const matchCount = keywords.filter(k => content.includes(k)).length;
      if (matchCount > 0 || !query) {
        results.push({
          entry: rowToEntry(row),
          score: matchCount / Math.max(keywords.length, 1),
          matchType: 'metadata',
        });
      }
    }
  }

  // 3. Update access counts
  const updateAccess = db.prepare(`
    UPDATE memories SET access_count = access_count + 1, last_accessed_at = datetime('now') WHERE id = ?
  `);
  for (const r of results) {
    updateAccess.run(r.entry.id);
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ─── Context Builder ──────────────────────────────────

function buildContext(
  db: Database.Database,
  taskDescription: string,
  maxTokens: number = 4000
): string {
  const results = search(db, taskDescription, { limit: 15 });

  const sections: string[] = [
    '# Dirigent Memory — Relevant Context',
    '',
  ];

  // Group by type
  const grouped = new Map<string, SearchResult[]>();
  for (const r of results) {
    const type = r.entry.type;
    if (!grouped.has(type)) grouped.set(type, []);
    grouped.get(type)!.push(r);
  }

  for (const [type, entries] of grouped) {
    sections.push(`## ${type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')}`);
    for (const { entry, score } of entries) {
      const meta = entry.feature ? ` [${entry.feature}]` : '';
      const phase = entry.phase ? ` (${entry.phase})` : '';
      sections.push(`- ${entry.content}${meta}${phase}`);
    }
    sections.push('');
  }

  // Rough token estimate: ~4 chars per token
  let context = sections.join('\n');
  if (context.length > maxTokens * 4) {
    context = context.slice(0, maxTokens * 4) + '\n\n... (truncated, use specific search for more)';
  }

  return context;
}

// ─── List ─────────────────────────────────────────────

function list(
  db: Database.Database,
  filters?: { type?: string; limit?: number; feature?: string }
): MemoryEntry[] {
  const limit = filters?.limit || 20;

  let sql = 'SELECT * FROM memories WHERE 1=1';
  const params: (string | number)[] = [];

  if (filters?.type) {
    sql += ' AND type = ?';
    params.push(filters.type);
  }
  if (filters?.feature) {
    sql += ' AND feature = ?';
    params.push(filters.feature);
  }

  sql += ' ORDER BY updated_at DESC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
  return rows.map(rowToEntry);
}

// ─── Prune ────────────────────────────────────────────

function prune(db: Database.Database, olderThan: string): number {
  const match = olderThan.match(/^(\d+)(d|w|m)$/);
  if (!match) throw new Error('Invalid format. Use: 30d, 4w, 3m');

  const [, num, unit] = match;
  const days = unit === 'd' ? parseInt(num!) : unit === 'w' ? parseInt(num!) * 7 : parseInt(num!) * 30;

  const stmt = db.prepare(`
    DELETE FROM memories
    WHERE created_at < datetime('now', '-' || ? || ' days')
    AND relevance_score < 5.0
    AND access_count < 3
  `);

  const result = stmt.run(days);
  return result.changes;
}

// ─── Stats ────────────────────────────────────────────

function stats(db: Database.Database): Record<string, unknown> {
  const total = (db.prepare('SELECT COUNT(*) as count FROM memories').get() as { count: number }).count;
  const byType = db.prepare('SELECT type, COUNT(*) as count FROM memories GROUP BY type ORDER BY count DESC').all();
  const byPhase = db.prepare('SELECT phase, COUNT(*) as count FROM memories WHERE phase != "" GROUP BY phase ORDER BY count DESC').all();
  const byFeature = db.prepare('SELECT feature, COUNT(*) as count FROM memories WHERE feature != "" GROUP BY feature ORDER BY count DESC LIMIT 10').all();
  const recentlyUsed = db.prepare('SELECT id, type, substr(content, 1, 80) as preview, access_count FROM memories ORDER BY last_accessed_at DESC LIMIT 5').all();
  const dbSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
  const vectorCount = (db.prepare('SELECT COUNT(*) as count FROM memory_vectors').get() as { count: number }).count;

  return {
    total,
    byType,
    byPhase,
    byFeature,
    recentlyUsed,
    vectorCount,
    dbSizeKB: Math.round(dbSize / 1024),
    vectorsEnabled: VECTOR_ENABLED,
  };
}

// ─── Export ───────────────────────────────────────────

function exportAll(db: Database.Database): MemoryEntry[] {
  const rows = db.prepare('SELECT * FROM memories ORDER BY created_at ASC').all() as Array<Record<string, unknown>>;
  return rows.map(rowToEntry);
}

// ─── Helpers ──────────────────────────────────────────

function rowToEntry(row: Record<string, unknown>): MemoryEntry {
  return {
    id: row.id as string,
    type: row.type as MemoryType,
    category: row.category as string,
    content: row.content as string,
    metadata: JSON.parse((row.metadata as string) || '{}'),
    phase: row.phase as string,
    agent: row.agent as string,
    feature: row.feature as string,
    tags: JSON.parse((row.tags as string) || '[]'),
    relevanceScore: row.relevance_score as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ─── CLI ──────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log(`
🎼 Dirigent Memory — SQLite RAG

Commands:
  store     Store a memory entry
  search    Search memories (FTS5 + metadata)
  context   Build context for a task description
  list      List memories with optional filters
  prune     Remove old, low-relevance, rarely-accessed entries
  export    Export all memories as JSON
  stats     Show memory statistics

Options:
  --type=<type>       Memory type (pattern|convention|decision|tech_debt|...)
  --phase=<phase>     Pipeline phase (analyse|design|implement|...)
  --agent=<agent>     Agent that created this (architect|implementer|...)
  --feature=<slug>    Feature slug
  --tags=<t1,t2>      Comma-separated tags
  --content=<text>    Content to store (or pipe via stdin)
  --limit=<n>         Max results (default: 10)
  --older-than=<Nd>   Prune threshold (e.g., 90d, 12w, 3m)

Examples:
  dirigent-memory store --type=pattern --content="Auth uses middleware pattern in src/middleware/auth.ts"
  dirigent-memory search "authentication middleware"
  dirigent-memory context "Add OAuth2 login with Google"
  dirigent-memory list --type=decision --limit=5
  dirigent-memory prune --older-than=90d
  dirigent-memory stats
    `);
    return;
  }

  const db = initDb();

  const getArg = (name: string): string | undefined => {
    const arg = args.find(a => a.startsWith(`--${name}=`));
    return arg?.split('=').slice(1).join('=');
  };

  try {
    switch (command) {
      case 'store': {
        const content = getArg('content') || '';
        if (!content) {
          console.error('Error: --content is required');
          process.exit(1);
        }
        const id = store(db, {
          type: (getArg('type') || 'custom') as MemoryType,
          category: getArg('category') || '',
          content,
          phase: getArg('phase') || '',
          agent: getArg('agent') || '',
          feature: getArg('feature') || '',
          tags: getArg('tags')?.split(',') || [],
          relevanceScore: parseFloat(getArg('relevance') || '1.0'),
        });
        console.log(`✅ Stored: ${id}`);
        break;
      }

      case 'search': {
        const query = args.slice(1).filter(a => !a.startsWith('--')).join(' ');
        const results = search(db, query, {
          type: getArg('type'),
          phase: getArg('phase'),
          feature: getArg('feature'),
          limit: parseInt(getArg('limit') || '10', 10),
        });

        if (results.length === 0) {
          console.log('No results found.');
        } else {
          console.log(`Found ${results.length} results:\n`);
          for (const { entry, score, matchType } of results) {
            console.log(`  [${matchType}] (score: ${score.toFixed(3)}) [${entry.type}]`);
            console.log(`  ${entry.content}`);
            if (entry.feature) console.log(`  Feature: ${entry.feature}`);
            if (entry.phase) console.log(`  Phase: ${entry.phase}`);
            console.log(`  ID: ${entry.id}`);
            console.log('');
          }
        }
        break;
      }

      case 'context': {
        const task = args.slice(1).filter(a => !a.startsWith('--')).join(' ');
        const maxTokens = parseInt(getArg('max-tokens') || '4000', 10);
        const context = buildContext(db, task, maxTokens);
        console.log(context);
        break;
      }

      case 'list': {
        const entries = list(db, {
          type: getArg('type'),
          feature: getArg('feature'),
          limit: parseInt(getArg('limit') || '20', 10),
        });

        for (const entry of entries) {
          console.log(`[${entry.type}] ${entry.content.slice(0, 100)}${entry.content.length > 100 ? '...' : ''}`);
          console.log(`  ID: ${entry.id} | Feature: ${entry.feature || '-'} | Updated: ${entry.updatedAt}`);
          console.log('');
        }
        console.log(`Total: ${entries.length}`);
        break;
      }

      case 'prune': {
        const olderThan = getArg('older-than') || '90d';
        const pruned = prune(db, olderThan);
        console.log(`🧹 Pruned ${pruned} entries older than ${olderThan} (with low relevance + access)`);
        break;
      }

      case 'export': {
        const entries = exportAll(db);
        console.log(JSON.stringify(entries, null, 2));
        break;
      }

      case 'stats': {
        const s = stats(db);
        console.log('\n🎼 Dirigent Memory Stats');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`  Total entries: ${s.total}`);
        console.log(`  Database size: ${s.dbSizeKB} KB`);
        console.log(`  Vectors: ${s.vectorCount} (${s.vectorsEnabled ? 'enabled' : 'disabled'})`);
        console.log('\n  By type:');
        for (const t of s.byType as Array<{ type: string; count: number }>) {
          console.log(`    ${t.type}: ${t.count}`);
        }
        if ((s.byFeature as unknown[]).length > 0) {
          console.log('\n  By feature:');
          for (const f of s.byFeature as Array<{ feature: string; count: number }>) {
            console.log(`    ${f.feature}: ${f.count}`);
          }
        }
        console.log('');
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } finally {
    db.close();
  }
}

main();
