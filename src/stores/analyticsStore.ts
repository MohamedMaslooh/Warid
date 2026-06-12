import { create } from "zustand";
import {
  getAnalyticsStats,
  getAnalyticsMilestones,
  getDailyActivity,
  saveAnalyticsMilestone,
  type AnalyticsMilestone,
  type DailyActivity,
} from "../lib/db";
import { runMilestoneAnalysis, type MilestoneReport } from "../lib/analyticsAI";
import { computeTopWords } from "../lib/topWords";

const HEATMAP_DAYS = 182; // ~26 weeks
const PACE_WINDOW_DAYS = 14;

// Average human typing speed (WPM) vs. effective speech capture rate (WPM)
const TYPING_WPM = 40;
const SPEECH_WPM = 130;

// Milestones in total word count that trigger an AI analysis
const MILESTONES = [
  100, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000,
  150_000, 200_000, 250_000, 300_000, 350_000, 400_000, 450_000, 500_000,
  550_000, 600_000, 650_000, 700_000, 750_000, 800_000, 850_000, 900_000, 950_000, 1_000_000
];

function nextMilestone(wordCount: number): number | null {
  return MILESTONES.find((m) => m > wordCount) ?? null;
}

function timeSavedMinutes(words: number): number {
  return words / TYPING_WPM - words / SPEECH_WPM;
}

export interface ParsedMilestone {
  id: string;
  createdAt: number;
  wordCountAt: number;
  report: MilestoneReport;
  model: string;
}

interface AnalyticsStore {
  totalWords: number;
  totalDurationMs: number;
  totalSessions: number;
  timeSavedMin: number;
  timeSavedTodayMin: number;
  effectiveWpm: number;
  nextMilestone: number | null;
  milestones: ParsedMilestone[];
  dailyActivity: DailyActivity[];
  currentStreak: number;
  paceWordsPerDay: number;
  bestDay: number;
  topWords: Array<{ word: string; count: number }>;
  analysing: boolean;
  loaded: boolean;
  celebrateMilestone: number | null;

  load: (apiKey?: string) => Promise<void>;
  refresh: (apiKey?: string) => Promise<void>;
  clearCelebrateMilestone: () => void;
}

function computeStreak(daily: DailyActivity[]): number {
  if (daily.length === 0) return 0;
  const byDay = new Map(daily.map((d) => [d.day, d.words]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let cursor = today.getTime();
  // Allow streak to continue if today has no activity yet but yesterday did.
  if (!byDay.get(cursor)) cursor -= 86_400_000;
  let streak = 0;
  while ((byDay.get(cursor) ?? 0) > 0) {
    streak += 1;
    cursor -= 86_400_000;
  }
  return streak;
}

function computePace(daily: DailyActivity[]): number {
  if (daily.length === 0) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = today.getTime() - (PACE_WINDOW_DAYS - 1) * 86_400_000;
  const total = daily.filter((d) => d.day >= from).reduce((s, d) => s + d.words, 0);
  return Math.round(total / PACE_WINDOW_DAYS);
}

export const useAnalyticsStore = create<AnalyticsStore>((set, get) => ({
  totalWords: 0,
  totalDurationMs: 0,
  totalSessions: 0,
  timeSavedMin: 0,
  timeSavedTodayMin: 0,
  effectiveWpm: 0,
  nextMilestone: MILESTONES[0],
  milestones: [],
  dailyActivity: [],
  currentStreak: 0,
  paceWordsPerDay: 0,
  bestDay: 0,
  topWords: [],
  analysing: false,
  loaded: false,
  celebrateMilestone: null,

  clearCelebrateMilestone: () => set({ celebrateMilestone: null }),

  load: async (apiKey) => {
    await get().refresh(apiKey);
  },

  refresh: async (apiKey) => {
    const [stats, rawMilestones, dailyActivity] = await Promise.all([
      getAnalyticsStats(),
      getAnalyticsMilestones(),
      getDailyActivity(HEATMAP_DAYS),
    ]);

    const { totalWords, totalDurationMs, totalSessions, texts } = stats;
    const timeSavedMin = timeSavedMinutes(totalWords);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMidnight = today.getTime();
    const todayActivity = dailyActivity.find((d) => d.day === todayMidnight);
    const wordsToday = todayActivity ? todayActivity.words : 0;
    const timeSavedTodayMin = timeSavedMinutes(wordsToday);

    // Effective WPM: how fast the user "types" via dictation
    // = output words / recording time in minutes
    const recordingMinutes = totalDurationMs / 1000 / 60;
    const effectiveWpm = recordingMinutes > 0
      ? Math.round(totalWords / recordingMinutes)
      : 0;

    const milestones: ParsedMilestone[] = rawMilestones.map((m: AnalyticsMilestone) => ({
      id: m.id,
      createdAt: m.created_at,
      wordCountAt: m.word_count_at,
      report: JSON.parse(m.summary) as MilestoneReport,
      model: m.model,
    }));

    const bestDay = dailyActivity.reduce((m, d) => Math.max(m, d.words), 0);
    const currentStreak = computeStreak(dailyActivity);
    const paceWordsPerDay = computePace(dailyActivity);
    const topWords = computeTopWords(texts, 10);

    // Detect newly crossed milestones for the celebration banner (persisted in localStorage)
    const celebrated: number[] = JSON.parse(localStorage.getItem("warid_celebrated_ms") || "[]");
    const newlyCrossed = MILESTONES.filter((m) => totalWords >= m && !celebrated.includes(m));
    let celebrateUpdate: { celebrateMilestone: number } | Record<string, never> = {};
    if (newlyCrossed.length > 0) {
      const highest = newlyCrossed[newlyCrossed.length - 1];
      localStorage.setItem("warid_celebrated_ms", JSON.stringify([...celebrated, ...newlyCrossed]));
      celebrateUpdate = { celebrateMilestone: highest };
    }

    set({
      totalWords,
      totalDurationMs,
      totalSessions,
      timeSavedMin,
      timeSavedTodayMin,
      effectiveWpm,
      nextMilestone: nextMilestone(totalWords),
      milestones,
      dailyActivity,
      currentStreak,
      paceWordsPerDay,
      bestDay,
      topWords,
      loaded: true,
      ...celebrateUpdate,
    });

    // Check if we should fire a new milestone analysis
    if (!apiKey) return;
    const alreadyAnalysed = new Set(milestones.map((m) => m.wordCountAt));
    const triggered = MILESTONES.filter(
      (m) => totalWords >= m && !alreadyAnalysed.has(m),
    );

    if (triggered.length === 0) return;
    const milestone = triggered[triggered.length - 1]; // analyse the highest reached

    set({ analysing: true });
    try {
      const report = await runMilestoneAnalysis(apiKey, texts, totalWords, totalSessions);
      await saveAnalyticsMilestone(
        `milestone-${milestone}`,
        milestone,
        report,
        "gemini-3.1-flash-lite",
      );
      // Reload milestones after save
      const updated = await getAnalyticsMilestones();
      set({
        milestones: updated.map((m: AnalyticsMilestone) => ({
          id: m.id,
          createdAt: m.created_at,
          wordCountAt: m.word_count_at,
          report: JSON.parse(m.summary) as MilestoneReport,
          model: m.model,
        })),
        nextMilestone: nextMilestone(totalWords),
      });
    } finally {
      set({ analysing: false });
    }
  },
}));
