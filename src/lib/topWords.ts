// SPDX-License-Identifier: AGPL-3.0-or-later

const STOP_WORDS_EN = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "of", "in", "on", "at", "to", "for", "with",
  "by", "from", "up", "down", "about", "into", "over", "after", "before", "under",
  "i", "you", "he", "she", "it", "we", "they", "them", "us", "my", "your", "his", "her",
  "our", "their", "this", "that", "these", "those", "as", "if", "then", "than", "so",
  "not", "no", "yes", "can", "could", "would", "should", "will", "just", "also", "there",
  "here", "what", "which", "who", "how", "why", "when", "where", "me", "him", "very",
  "more", "most", "some", "any", "all", "such", "one", "two", "out", "off", "only",
  "own", "same", "too", "now", "still", "way", "even", "back", "much", "many",
]);

const STOP_WORDS_AR = new Set([
  "و", "في", "من", "على", "إلى", "الى", "عن", "ما", "لا", "هل", "ثم", "أو", "او",
  "أن", "ان", "إن", "لم", "قد", "كان", "كانت", "يكون", "تكون", "هذا", "هذه", "ذلك",
  "تلك", "هنا", "هناك", "الذي", "التي", "اللذي", "يا", "لن", "لو", "إذا", "اذا",
  "عند", "عندما", "كل", "بعض", "غير", "مع", "بين", "حتى", "قبل", "بعد", "أنا", "انا",
  "أنت", "انت", "نحن", "هم", "هي", "هو", "أيضا", "ايضا", "كما", "حيث", "لكن", "لكي",
  "كي", "ضد", "نفس", "أي", "اي", "كذلك", "أكثر", "اكثر", "أقل", "اقل",
]);

const TOKEN_RE = /[\p{L}\p{N}]+/gu;

function normalizeArabic(word: string): string {
  return word
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

export function computeTopWords(
  texts: string[],
  n = 10,
): Array<{ word: string; count: number }> {
  const counts = new Map<string, number>();

  for (const text of texts) {
    const lowered = text.toLowerCase();
    for (const match of lowered.matchAll(TOKEN_RE)) {
      const raw = match[0];
      if (raw.length < 2) continue;
      if (/^\d+$/.test(raw)) continue;

      const isArabic = /[؀-ۿ]/.test(raw);
      const key = isArabic ? normalizeArabic(raw) : raw;
      if (!key || key.length < 2) continue;
      if (STOP_WORDS_EN.has(key) || STOP_WORDS_AR.has(key)) continue;

      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return Array.from(counts, ([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, n);
}
