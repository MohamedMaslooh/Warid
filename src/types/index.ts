export interface Template {
  id: string;
  name: string;
  name_en?: string;   // English display name for built-in templates
  icon: string;
  color: string;
  prompt_body: string;
  output_language: "en" | "ar" | null;
  model: string | null;
  hotkey: string | null;
  is_default: 0 | 1;
  is_upload_only?: 0 | 1;
  is_favorite?: 0 | 1;
  created_at: number;
  updated_at: number;
}

export interface HistoryItem {
  id: string;
  created_at: number;
  template_id: string | null;
  template_snapshot: string | null;
  model: string;
  audio_path: string | null;
  duration_ms: number | null;
  output_text: string;
  estimated_tokens: number | null;
}

export interface Settings {
  apiKey: string;
  openRouterApiKey: string;
  logsEnabled: boolean;
  selectedModel: string;
  defaultTemplateId: string;
  autoCopy: boolean;
  showTray: boolean;
  saveHistory: boolean;
  theme: "light" | "dark" | "system";
  uiLanguage: "ar" | "en";
  firstRun: boolean;
  /** deviceId of the preferred audio input. Empty string = system default. */
  audioDeviceId: string;
  launchOnStartup: boolean;
  /** Global shortcut to cancel an active recording from any screen. */
  cancelHotkey: string;
  /** False until the user dismisses the cancel-hotkey feature tip (shown once after upgrade). */
  seenCancelHotkey: boolean;
  /** One-time flag: existing users are flipped to Auto model selection once. */
  autoModeMigrated: boolean;
  /** One-time flag: the autostart registry entry has been re-applied after the 1.0.1 fix. */
  autostartHealed: boolean;
  /** False until the user dismisses the one-time "Launch on Startup fixed" notice. */
  seenAutostartNotice: boolean;
  /**
   * Floating control-bar (overlay) visibility:
   * - "recording": only visible while recording/processing (default)
   * - "always": pinned on screen at all times; click its mic to start recording
   * - "off": never shown
   */
  overlayMode: "recording" | "always" | "off";
  /** False until the user dismisses the v1.1.1 "What's New" notice. */
  seenWhatsNew111: boolean;
  /** False until the user dismisses the v1.1.2 "What's New" notice (covers 1.1.0–1.1.2). */
  seenWhatsNew112: boolean;
  /** When true, updates download silently in the background and only prompt to restart. */
  autoDownloadUpdates: boolean;

  /* ── Warid Cloud (paid tier; only active when VITE_CLOUD_ENABLED) ────────── */
  /** Which engine drives transcription: own key ("byok", default) or hosted ("cloud"). */
  accountMode: "byok" | "cloud";
  /** Email of the signed-in Warid Cloud account (display only). */
  cloudEmail: string;
  /** Supabase session (access token) for the cloud account. Stored like apiKey
   *  in settings.json today — see plan's "known limitations" (keychain deferred). */
  cloudSessionToken: string;
  /** Supabase refresh token, used to silently renew the session. */
  cloudRefreshToken: string;
  /** Current plan, mirrored from the gateway's /v1/me for offline display. */
  cloudPlan: "free" | "plus" | "pro";
  /** Audio-minutes used this cycle, mirrored from /v1/me. */
  cloudMinutesUsed: number;
  /** Audio-minute cap for the current plan, mirrored from /v1/me. */
  cloudMinutesLimit: number;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  openRouterApiKey: "",
  logsEnabled: false,
  selectedModel: "auto",
  defaultTemplateId: "transcribe",
  autoCopy: true,
  showTray: true,
  saveHistory: true,
  theme: "system",
  uiLanguage: "ar",
  firstRun: true,
  audioDeviceId: "",
  launchOnStartup: false,
  cancelHotkey: "CommandOrControl+Alt+X",
  seenCancelHotkey: false,
  autoModeMigrated: false,
  autostartHealed: false,
  seenAutostartNotice: false,
  overlayMode: "recording",
  seenWhatsNew111: false,
  seenWhatsNew112: false,
  autoDownloadUpdates: false,
  accountMode: "byok",
  cloudEmail: "",
  cloudSessionToken: "",
  cloudRefreshToken: "",
  cloudPlan: "free",
  cloudMinutesUsed: 0,
  cloudMinutesLimit: 0,
};

export const DEFAULT_TEMPLATES: Omit<Template, "created_at" | "updated_at">[] = [
  {
    id: "lecture_transcription",
    name: "تفريغ وترتيب المحاضرة",
    name_en: "Lecture Transcription",
    icon: "BookOpen",
    color: "#8B5CF6",
    prompt_body: `Extract the main title of the lecture and write it at the very beginning starting with a single '#' (Markdown level 1 header) e.g., "# Title of the Lecture". Then transcribe the audio, organizing it into well-formatted paragraphs with appropriate subheadings (using '##' for subheadings) where necessary. Format the output nicely so that it looks professional and readable. Output only the formatted title and transcription, without any preamble, metadata, or extra explanation.`,
    output_language: null,
    model: null,
    hotkey: null,
    is_default: 1,
    is_upload_only: 1,
    is_favorite: 0,
  },
  {
    id: "transcribe",
    name: "تفريغ نصي",
    name_en: "Transcribe",
    icon: "Microphone",
    color: "#FF6B3D",
    prompt_body: `Transcribe the recording exactly as it is. Write the Arabic parts in Arabic and the English parts in English. Every English word and term must stay in English exactly as spoken. Output the transcription only, with no translation, notes, or preamble.`,
    output_language: null,
    model: null,
    hotkey: "CommandOrControl+Alt+R",
    is_default: 1,
    is_upload_only: 0,
    is_favorite: 0,
  },
  {
    id: "translate_en",
    name: "ترجمة وتنظيم",
    name_en: "Translate & Polish",
    icon: "Languages",
    color: "#2563EB",
    prompt_body: `Translate the audio to clean English. Remove fillers, fix grammar, preserve meaning. Output the English text only.`,
    output_language: "en",
    model: null,
    hotkey: "CommandOrControl+Shift+T",
    is_default: 1,
    is_upload_only: 0,
    is_favorite: 0,
  },
  {
    id: "coding_assistant",
    name: "مساعد البرمجة",
    name_en: "Coding Assistant",
    icon: "Code",
    color: "#10B981",
    prompt_body: `Rewrite the audio as a clear English coding task or developer brief. Output the brief only.`,
    output_language: "en",
    model: null,
    hotkey: "CommandOrControl+Shift+C",
    is_default: 1,
    is_upload_only: 0,
    is_favorite: 0,
  },
];
