// SPDX-License-Identifier: AGPL-3.0-or-later

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface MilestoneReport {
  topWords: Array<{ word: string; count: number }>;
  patterns: { ar: string[]; en: string[] } | string[];
  encouragement: { ar: string; en: string } | string;
  avgWordsPerSession: number;
  totalSessions: number;
}

const ANALYSIS_PROMPT = (wordCount: number, corpus: string) => `
You are analyzing speech-to-text dictation data for a user who has spoken ${wordCount.toLocaleString()} words using a voice dictation app.

Here is a sample of their recent dictated text (in Arabic or English, whichever was spoken):

---
${corpus}
---

Respond ONLY with a valid JSON object (no markdown, no code fences) with this exact shape:
{
  "topWords": [
    { "word": "example", "count": 42 }
  ],
  "patterns": {
    "ar": [
      "غالبًا ما تبدأ الجمل بـ...",
      "تستخدم كثيرًا كلمات مثل..."
    ],
    "en": [
      "You often start sentences with...",
      "You frequently use filler phrases like..."
    ]
  },
  "encouragement": {
    "ar": "رسالة دافئة ومحفزة من جملتين باللغة العربية.",
    "en": "A warm, motivating 2-sentence message in English."
  }
}

Rules:
- topWords: the 10 most frequent MEANINGFUL words (skip stop-words like و، في، من، the, a, is, are, and, or).
- patterns: 3 short observations about their speech patterns, phrasing style, or topics. Provide both Arabic and English.
- encouragement: Be specific and warm. Mention the word count milestone. Provide both Arabic and English.
- Output ONLY the JSON. Nothing else.
`;

export async function runMilestoneAnalysis(
  apiKey: string,
  allTexts: string[],
  wordCount: number,
  totalSessions: number,
): Promise<MilestoneReport> {
  // Use up to the last ~3000 words to keep the prompt lean
  const joined = allTexts.join(" ");
  const words = joined.split(/\s+/);
  const corpus = words.slice(-3000).join(" ");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    generationConfig: {
      // @ts-expect-error — thinkingConfig not yet typed
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent(ANALYSIS_PROMPT(wordCount, corpus));
  const raw = result.response.text().trim();

  let parsed: Omit<MilestoneReport, "avgWordsPerSession" | "totalSessions">;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Fallback if model wraps in backticks despite instruction
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Failed to parse milestone analysis JSON");
    parsed = JSON.parse(match[0]);
  }

  return {
    ...parsed,
    avgWordsPerSession: totalSessions > 0 ? Math.round(wordCount / totalSessions) : 0,
    totalSessions,
  };
}
