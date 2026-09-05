// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Release-note parsing for the update banner.
 *
 * The `notes` the updater hands us are the GitHub release body — the changelog
 * section for the tag, in full markdown: `###` groups (Added / Fixed /
 * Changed), `####` item titles, bullets with **bold** lead-ins, `code` spans,
 * links and source-file citations. Flattening all of that into one block of
 * pre-wrapped text reads terribly in a toast, so we parse it into a small block
 * model the banner can lay out properly.
 */

export interface Span {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export type NoteBlock =
  /** `### Added` — a group label ("Added", "Fixed", "Changed"). */
  | { kind: "section"; label: string }
  /** `#### Google's new Gemini models` — the title of one change. */
  | { kind: "heading"; spans: Span[] }
  /** A list item; `depth` is 0 for top-level, 1 for anything nested. */
  | { kind: "bullet"; spans: Span[]; depth: number }
  /** `> …` — a callout (credits, warnings). */
  | { kind: "quote"; spans: Span[] }
  /** Plain prose between headings. */
  | { kind: "para"; spans: Span[] };

/** Trailing `(`src/lib/gemini.ts`, `src/types/index.ts`)` source citations:
 *  useful in the changelog, pure noise in a user-facing toast. */
const SOURCE_CITATION = /\s*\((?:`[^`]*[./][^`]*`)(?:\s*,\s*`[^`]*`)*\)\s*$/;

/** `[label](url)` → `label`. The toast has nowhere to send a click, and the
 *  raw URL would blow the line width apart. */
const MD_LINK = /\[([^\]]+)\]\((?:[^)]*)\)/g;

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|(?<![*\w])\*[^*\n]+\*(?!\w))/g;

/** Splits one line of markdown into styled spans (bold / italic / code). */
function parseInline(raw: string): Span[] {
  const text = raw.replace(MD_LINK, "$1");
  const spans: Span[] = [];
  let last = 0;

  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) spans.push({ text: text.slice(last, at) });
    const tok = m[0];
    if (tok.startsWith("**")) spans.push({ text: tok.slice(2, -2), bold: true });
    else if (tok.startsWith("`")) spans.push({ text: tok.slice(1, -1), code: true });
    else spans.push({ text: tok.slice(1, -1), italic: true });
    last = at + tok.length;
  }
  if (last < text.length) spans.push({ text: text.slice(last) });

  return spans.filter((s) => s.text !== "");
}

/** True for the lines we never want to show: separators, the version heading
 *  (the banner already states the version) and the changelog's own preamble. */
function isSkippable(line: string): boolean {
  return /^-{3,}$/.test(line) || /^={3,}$/.test(line) || /^#{1,2}\s/.test(line);
}

export function parseReleaseNotes(md: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  const lines = md.replace(/\r/g, "").split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed === "") continue;
    if (isSkippable(trimmed)) continue;

    const section = /^###\s+(.*)$/.exec(trimmed);
    if (section) {
      blocks.push({ kind: "section", label: section[1].replace(/[*`]/g, "").trim() });
      continue;
    }

    const heading = /^#{4,6}\s+(.*)$/.exec(trimmed);
    if (heading) {
      blocks.push({ kind: "heading", spans: parseInline(heading[1]) });
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (quote) {
      blocks.push({ kind: "quote", spans: parseInline(quote[1]) });
      continue;
    }

    const bullet = /^([-*+]|\d+\.)\s+(.*)$/.exec(trimmed);
    if (bullet) {
      const indent = line.length - line.trimStart().length;
      blocks.push({
        kind: "bullet",
        depth: indent >= 2 ? 1 : 0,
        spans: parseInline(bullet[2].replace(SOURCE_CITATION, "")),
      });
      continue;
    }

    // A wrapped continuation of the previous bullet/paragraph rather than a new
    // one — markdown joins these with a space.
    const prev = blocks[blocks.length - 1];
    if (prev && (prev.kind === "bullet" || prev.kind === "para" || prev.kind === "quote")) {
      prev.spans.push(...parseInline(" " + trimmed.replace(SOURCE_CITATION, "")));
      continue;
    }

    blocks.push({ kind: "para", spans: parseInline(trimmed.replace(SOURCE_CITATION, "")) });
  }

  // A section label with nothing under it (everything got filtered) is noise.
  return blocks.filter(
    (b, i) => b.kind !== "section" || (blocks[i + 1] && blocks[i + 1].kind !== "section"),
  );
}

/** Which accent a `###` group is drawn with. Falls back to neutral for any
 *  label the changelog invents later. */
export type SectionTone = "added" | "fixed" | "changed" | "neutral";

export function sectionTone(label: string): SectionTone {
  const l = label.toLowerCase();
  if (l.startsWith("add") || l.startsWith("new")) return "added";
  if (l.startsWith("fix")) return "fixed";
  if (l.startsWith("chang") || l.startsWith("improv") || l.startsWith("updat")) return "changed";
  return "neutral";
}
