// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSettingsStore } from "../stores/settingsStore";
import { t as translate, type Lang, type LangKey } from "./i18n";
import type { Template } from "../types";

export function useLang() {
  const { settings } = useSettingsStore();
  const lang: Lang = settings.uiLanguage ?? "ar";
  const t = (key: LangKey, ...args: string[]) => translate(lang, key, ...args);
  return { lang, t, isRTL: lang === "ar" };
}

/** Returns the display name of a template in the current UI language. */
export function useTemplateName(tpl: Template): string {
  const { lang } = useLang();
  if (lang === "en" && tpl.name_en) return tpl.name_en;
  return tpl.name;
}
