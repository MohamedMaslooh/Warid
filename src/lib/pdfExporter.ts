import jsPDF from "jspdf";
import { invoke } from "@tauri-apps/api/core";
import bidiFactory from "bidi-js";
import { reshapeArabic } from "./arabicShaper";
import { registerArabicFont, AMIRI_FONT } from "./pdfFonts";

const bidi = bidiFactory();

type LineStyle = "h1" | "h2" | "h3" | "body" | "gap";

/**
 * Strip inline Markdown emphasis so body text never shows stray markers
 * (`**bold**`, `*italic*`, `__x__`, `` `code` ``, `~~strike~~`). jsPDF renders
 * each line in a single weight, so we normalise to clean plain text instead of
 * leaking asterisks/backticks into the output.
 */
function stripInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/(^|[^\w])_(.+?)_(?=[^\w]|$)/g, "$1$2")
    .replace(/`(.+?)`/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .trim();
}

/**
 * Convert Markdown into styled lines for jsPDF's manual layout.
 *
 * Parses LINE BY LINE (not by blank-line blocks): a heading followed directly
 * by its paragraph — with no blank line between — must not bleed its heading
 * style onto the paragraph. Each line is classified independently.
 */
function parseMarkdownLines(text: string): Array<{ text: string; style: LineStyle }> {
  const rawLines = text.replace(/\r\n/g, "\n").split("\n");
  const lines: Array<{ text: string; style: LineStyle }> = [];

  const pushGap = () => {
    // Collapse consecutive blank lines into a single gap.
    if (lines.length === 0 || lines[lines.length - 1].style === "gap") return;
    lines.push({ text: "", style: "gap" });
  };

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      pushGap();
      continue;
    }

    if (trimmed.startsWith("### ")) {
      lines.push({ text: stripInline(trimmed.slice(4)), style: "h3" });
    } else if (trimmed.startsWith("## ")) {
      lines.push({ text: stripInline(trimmed.slice(3)), style: "h2" });
    } else if (trimmed.startsWith("# ")) {
      lines.push({ text: stripInline(trimmed.slice(2)), style: "h1" });
    } else {
      // List items: normalise "-", "*", "+" bullets to a real bullet glyph;
      // keep "1." numbering as-is. Everything else is a plain paragraph line.
      let body = trimmed;
      if (/^[-*+]\s+/.test(body)) body = "•  " + body.replace(/^[-*+]\s+/, "");
      lines.push({ text: stripInline(body), style: "body" });
    }
  }

  return lines;
}

export async function exportToPDF(fileName: string, text: string): Promise<void> {
  // Does the document contain Arabic anywhere? jsPDF's built-in fonts can't
  // render Arabic and do no letter-joining or bidi, so any Arabic forces the
  // embedded Amiri font plus the shaping + reordering pipeline below.
  const hasArabic = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
  // Base paragraph direction follows the dominant script; Arabic runs inside an
  // LTR document (and vice-versa) are still placed correctly by the bidi pass.
  const arabicCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const latinCount = (text.match(/[A-Za-z]/g) || []).length;
  const baseRTL = hasArabic && arabicCount >= latinCount;
  const baseDir = baseRTL ? "rtl" : "ltr";

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  if (hasArabic) await registerArabicFont(doc);
  const fontFamily = hasArabic ? AMIRI_FONT : "helvetica";

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 20;
  const marginY = 20;
  const contentWidth = pageW - marginX * 2;

  // Shape Arabic to presentation forms (logical order) then reorder each
  // wrapped line to its final visual order. Pure-Latin documents skip this.
  const toVisualLines = (logical: string): string[] => {
    const shaped = hasArabic ? reshapeArabic(logical) : logical;
    const wrapped = doc.splitTextToSize(shaped, contentWidth) as string[];
    if (!hasArabic) return wrapped;
    return wrapped.map((ln) =>
      bidi.getReorderedString(ln, bidi.getEmbeddingLevels(ln, baseDir))
    );
  };

  const PT_TO_MM = 25.4 / 72;
  const LINE_HEIGHT = 1.25; // line-spacing factor, shared by jsPDF and our math
  doc.setLineHeightFactor(LINE_HEIGHT);

  let y = marginY;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - marginY) {
      doc.addPage();
      y = marginY;
    }
  };

  const parsedLines = parseMarkdownLines(text);

  for (const line of parsedLines) {
    if (line.style === "gap") {
      y += 3.5;
      continue;
    }

    // One consistent type scale. Body is always the same weight/size; only
    // headings differ. spaceBefore groups a section heading with the text
    // that follows it by adding room above it.
    let fontSize = 11;
    let isBold = false;
    let spaceBefore = 0;
    if (line.style === "h1") { fontSize = 19; isBold = true; }
    else if (line.style === "h2") { fontSize = 15; isBold = true; spaceBefore = 4; }
    else if (line.style === "h3") { fontSize = 12.5; isBold = true; spaceBefore = 3; }

    doc.setFontSize(fontSize);
    doc.setFont(fontFamily, isBold ? "bold" : "normal");

    const wrapped = toVisualLines(line.text);
    const lineHeightMm = fontSize * PT_TO_MM * LINE_HEIGHT;
    const blockHeight = wrapped.length * lineHeightMm;

    ensureSpace(spaceBefore + blockHeight + 4);
    y += spaceBefore;

    // y tracks the top of the block; jsPDF anchors text at the baseline, so
    // offset the first line down by roughly one font height.
    const baselineOffset = fontSize * PT_TO_MM;
    const xPos = baseRTL ? pageW - marginX : marginX;
    const align = baseRTL ? "right" : "left";

    doc.text(wrapped, xPos, y + baselineOffset, { align } as Parameters<typeof doc.text>[3]);
    y += blockHeight;

    if (line.style === "h1") {
      y += 2;
      doc.setDrawColor(200, 195, 185);
      doc.setLineWidth(0.4);
      doc.line(marginX, y, pageW - marginX, y);
      y += 5;
    } else if (isBold) {
      y += 2; // breathing room under section headings
    } else {
      y += 1.5;
    }
  }

  const uint8 = new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
  const byteArray = Array.from(uint8);

  const baseName = fileName.replace(/\.[^/.]+$/, "");

  try {
    await invoke<string>("save_pdf", {
      fileName: baseName,
      pdfBytes: byteArray,
    });
  } catch (err) {
    // "cancelled" means user closed the dialog — not an error
    if (err !== "cancelled") {
      throw new Error(`PDF save failed: ${err}`);
    }
  }
}
