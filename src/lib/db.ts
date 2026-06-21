import Database from "@tauri-apps/plugin-sql";
import { DEFAULT_TEMPLATES, type HistoryItem, type Template } from "../types";
import type { MilestoneReport } from "./analyticsAI";

export interface AnalyticsMilestone {
  id: string;
  created_at: number;
  word_count_at: number;
  summary: string; // JSON-serialised MilestoneReport
  model: string;
}

export interface AnalyticsStats {
  totalWords: number;
  totalDurationMs: number;
  totalSessions: number;
  texts: string[];
}

export interface DailyActivity {
  day: number;       // ms timestamp at local midnight for that day
  words: number;
  sessions: number;
}

let db: Awaited<ReturnType<typeof Database.load>> | null = null;

async function getDb() {
  if (!db) {
    db = await Database.load("sqlite:warid.db");
    await migrate(db);
  }
  return db;
}

async function migrate(db: Awaited<ReturnType<typeof Database.load>>) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT DEFAULT 'Microphone',
      color TEXT DEFAULT '#2563EB',
      prompt_body TEXT NOT NULL,
      output_language TEXT,
      model TEXT,
      hotkey TEXT,
      is_default INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Idempotent column adds for upgrades from earlier schemas.
  try { await db.execute(`ALTER TABLE templates ADD COLUMN hotkey TEXT`); } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE templates ADD COLUMN is_upload_only INTEGER DEFAULT 0`); } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE templates ADD COLUMN is_favorite INTEGER DEFAULT 0`); } catch { /* exists */ }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      template_id TEXT,
      template_snapshot TEXT,
      model TEXT NOT NULL,
      audio_path TEXT,
      duration_ms INTEGER,
      output_text TEXT NOT NULL,
      estimated_tokens INTEGER
    );
  `);

  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_history_created ON history(created_at DESC);`
  );

  await db.execute(`
    CREATE TABLE IF NOT EXISTS analytics_milestones (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      word_count_at INTEGER NOT NULL,
      summary TEXT NOT NULL,
      model TEXT NOT NULL
    );
  `);

  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_milestones_created ON analytics_milestones(created_at DESC);`
  );

  // Align default hotkeys to match the website (R/T/C), but only if the user hasn't changed them.
  const hotkeyMigrations: [string, string, string][] = [
    ["transcribe",      "CommandOrControl+Shift+1", "CommandOrControl+Alt+R"],
    ["translate_en",    "CommandOrControl+Shift+2", "CommandOrControl+Shift+T"],
    ["coding_assistant","CommandOrControl+Shift+3", "CommandOrControl+Shift+C"],
  ];
  for (const [id, oldHk, newHk] of hotkeyMigrations) {
    await db.execute(
      `UPDATE templates SET hotkey = ?, updated_at = ? WHERE id = ? AND hotkey = ?`,
      [newHk, Date.now(), id, oldHk]
    );
  }

  // Keep the built-in "transcribe" prompt current with the latest default, but only
  // when the user is still on a previous built-in default — never clobber custom edits.
  // To ship a new default later: update DEFAULT_TEMPLATES, then add the now-stale prompt
  // string to priorTranscribeDefaults so existing users are migrated forward.
  const transcribeDefault = DEFAULT_TEMPLATES.find((t) => t.id === "transcribe")!.prompt_body;
  const priorTranscribeDefaults = [
    `Transcribe the audio verbatim. Output the transcription only.`,
    `Transcribe the audio verbatim. Preserve the original language of each word exactly as spoken — if the speaker switches between languages (e.g., Arabic and English), transcribe each word in the language it was spoken. Output the transcription only.`,
    `Transcribe the audio verbatim in the exact language each word was spoken — do NOT translate anything. The speaker frequently mixes Arabic and English within the same sentence (code-switching); you MUST keep every word in its original spoken language: write Arabic words in Arabic script and English words in the Latin alphabet, exactly as pronounced. Never convert an English word into Arabic or an Arabic word into English. Keep technical terms, brand names, product names, and acronyms in their original language. Output the transcription only, with no translation, notes, or preamble.`,
    `Transcribe the audio verbatim. Do NOT translate. Write each word in the SAME language it was spoken: if a word is spoken in English, write it in English letters; if a word is spoken in Arabic, write it in Arabic letters. The speaker mixes Arabic and English in the same sentence (code-switching) — keep that mix exactly in the output. For example, if the speaker says "استخدم الـ API عشان نعمل deploy للـ server", you must write it exactly like that, with "API", "deploy", and "server" in English and the rest in Arabic. Never rewrite an English word in Arabic letters, and never rewrite an Arabic word in English letters. Output the transcription only, with no translation, notes, or preamble.`,
    `Transcribe the audio verbatim. Do NOT translate, and do NOT transliterate.\n\nThe core rule: every word must be written in the alphabet that the word actually belongs to, not the alphabet of the surrounding sentence.\n- An Arabic word is written in Arabic letters.\n- An English word is written in English (Latin) letters — even when it is spoken in the middle of an Arabic sentence.\n\nSpeakers (especially in technical, medical, scientific, and business topics) constantly drop English words into Arabic speech. When you hear an English word, you MUST write it in its normal English spelling using Latin letters. Never spell an English word using Arabic letters, and never replace it with an Arabic translation.\n\nFor example, if a doctor speaking Arabic says the word "hypertension", you write "hypertension" in Latin letters — NOT "هايبرتنشن" and NOT "ارتفاع ضغط الدم". The same applies to any English term such as "diagnosis", "deploy", "server", "marketing", "deadline", "feedback", etc.\n\nLikewise, never write an Arabic word using English letters.\n\nOutput the transcription only, with no translation, notes, or preamble.`,
    `Transcribe the audio verbatim. Do NOT translate, and do NOT transliterate.\n\nWrite every word in the alphabet it belongs to, not the alphabet of the surrounding sentence: Arabic words in Arabic letters, English words in Latin letters — even when an English word lands in the middle of an Arabic sentence (common with technical, medical, scientific, and business terms).\n\nExample: if an Arabic speaker says "hypertension", write "hypertension" in Latin letters — NOT "هايبرتنشن" (transliteration) and NOT "ارتفاع ضغط الدم" (translation). The same applies to terms like "diagnosis", "deploy", "server", "deadline", "feedback".\n\nOutput the transcription only, with no translation, notes, or preamble.`,
    `Transcribe the audio exactly as spoken, word for word. Keep every word in its own language and its own script: write Arabic words in Arabic letters and English words in English (Latin) letters. Do not translate, and do not transliterate. Output the transcription only.`,
  ];
  for (const prior of priorTranscribeDefaults) {
    if (prior === transcribeDefault) continue;
    await db.execute(
      `UPDATE templates SET prompt_body = ?, updated_at = ? WHERE id = 'transcribe' AND prompt_body = ?`,
      [transcribeDefault, Date.now(), prior]
    );
  }

  // Remove duplicate Coding Assistant templates (keep only the canonical 'coding_assistant' id).
  await db.execute(
    `DELETE FROM templates WHERE name IN ('Coding Assistant', 'مساعد البرمجة') AND id != 'coding_assistant'`
  );

  const now = Date.now();
  for (const t of DEFAULT_TEMPLATES) {
    // Seed defaults on first install only — never overwrite user edits on later starts.
    await db.execute(
      `INSERT INTO templates (id, name, icon, color, prompt_body, output_language, model, hotkey, is_default, is_upload_only, is_favorite, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
      [t.id, t.name, t.icon, t.color, t.prompt_body, t.output_language, t.model, t.hotkey, t.is_default, t.is_upload_only ?? 0, t.is_favorite ?? 0, now, now]
    );
  }
}

export async function getTemplates(): Promise<Template[]> {
  const db = await getDb();
  return db.select<Template[]>("SELECT * FROM templates ORDER BY is_favorite DESC, is_default DESC, created_at ASC");
}

export async function upsertTemplate(t: Template): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO templates (id, name, icon, color, prompt_body, output_language, model, hotkey, is_default, is_upload_only, is_favorite, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, icon=excluded.icon, color=excluded.color,
       prompt_body=excluded.prompt_body, output_language=excluded.output_language,
       model=excluded.model, hotkey=excluded.hotkey,
       is_upload_only=excluded.is_upload_only, is_favorite=excluded.is_favorite,
       updated_at=excluded.updated_at`,
    [t.id, t.name, t.icon, t.color, t.prompt_body, t.output_language, t.model, t.hotkey, t.is_default, t.is_upload_only ?? 0, t.is_favorite ?? 0, t.created_at, t.updated_at]
  );
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM templates WHERE id = ?", [id]);
}

export async function getHistory(limit = 50, offset = 0, search = ""): Promise<HistoryItem[]> {
  const db = await getDb();
  if (search) {
    return db.select<HistoryItem[]>(
      "SELECT * FROM history WHERE output_text LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [`%${search}%`, limit, offset]
    );
  }
  return db.select<HistoryItem[]>(
    "SELECT * FROM history ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [limit, offset]
  );
}

export async function saveHistory(item: Omit<HistoryItem, never>): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO history (id, created_at, template_id, template_snapshot, model, audio_path, duration_ms, output_text, estimated_tokens)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [item.id, item.created_at, item.template_id, item.template_snapshot, item.model, item.audio_path, item.duration_ms, item.output_text, item.estimated_tokens]
  );
}

export async function deleteHistoryItem(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM history WHERE id = ?", [id]);
}

export async function clearHistory(): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM history");
}

export async function getAnalyticsStats(): Promise<AnalyticsStats> {
  const db = await getDb();
  const rows = await db.select<{ output_text: string; duration_ms: number | null }[]>(
    "SELECT output_text, duration_ms FROM history ORDER BY created_at ASC"
  );
  let totalWords = 0;
  let totalDurationMs = 0;
  const texts: string[] = [];
  for (const row of rows) {
    const wc = row.output_text.trim().split(/\s+/).filter(Boolean).length;
    totalWords += wc;
    totalDurationMs += row.duration_ms ?? 0;
    texts.push(row.output_text);
  }
  return { totalWords, totalDurationMs, totalSessions: rows.length, texts };
}

export async function getDailyActivity(daysBack: number): Promise<DailyActivity[]> {
  const db = await getDb();
  const cutoff = Date.now() - daysBack * 86_400_000;
  const rows = await db.select<{ created_at: number; output_text: string }[]>(
    "SELECT created_at, output_text FROM history WHERE created_at >= ? ORDER BY created_at ASC",
    [cutoff],
  );
  const map = new Map<number, { words: number; sessions: number }>();
  for (const row of rows) {
    const d = new Date(row.created_at);
    d.setHours(0, 0, 0, 0);
    const key = d.getTime();
    const wc = row.output_text.trim().split(/\s+/).filter(Boolean).length;
    const cur = map.get(key) ?? { words: 0, sessions: 0 };
    cur.words += wc;
    cur.sessions += 1;
    map.set(key, cur);
  }
  return Array.from(map, ([day, v]) => ({ day, words: v.words, sessions: v.sessions }))
    .sort((a, b) => a.day - b.day);
}

export async function saveAnalyticsMilestone(
  id: string,
  wordCountAt: number,
  report: MilestoneReport,
  model: string,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT OR IGNORE INTO analytics_milestones (id, created_at, word_count_at, summary, model)
     VALUES (?, ?, ?, ?, ?)`,
    [id, Date.now(), wordCountAt, JSON.stringify(report), model],
  );
}

export async function getAnalyticsMilestones(): Promise<AnalyticsMilestone[]> {
  const db = await getDb();
  return db.select<AnalyticsMilestone[]>(
    "SELECT * FROM analytics_milestones ORDER BY word_count_at ASC"
  );
}
