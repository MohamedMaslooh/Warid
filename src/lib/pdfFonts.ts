// SPDX-License-Identifier: AGPL-3.0-or-later

import type jsPDF from "jspdf";
import amiriRegularUrl from "../assets/fonts/Amiri-Regular.ttf?url";
import amiriBoldUrl from "../assets/fonts/Amiri-Bold.ttf?url";

/**
 * Loads the bundled Amiri TTFs and registers them with a jsPDF document so it
 * can render Arabic (and Latin) text. jsPDF's built-in fonts only cover
 * Latin-1, so any document containing Arabic must use an embedded Unicode font.
 *
 * The base64 payloads are fetched and decoded once, then cached for the
 * lifetime of the process; each jsPDF instance gets its own VFS entries.
 */

export const AMIRI_FONT = "Amiri";

let cache: Promise<{ regular: string; bold: string }> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000; // avoid call-stack limits on String.fromCharCode
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fetchBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load font: ${url} (${res.status})`);
  return arrayBufferToBase64(await res.arrayBuffer());
}

async function loadAmiri(): Promise<{ regular: string; bold: string }> {
  if (!cache) {
    cache = Promise.all([fetchBase64(amiriRegularUrl), fetchBase64(amiriBoldUrl)])
      .then(([regular, bold]) => ({ regular, bold }))
      .catch((err) => {
        cache = null; // allow a later retry instead of caching the failure
        throw err;
      });
  }
  return cache;
}

/**
 * Register the Amiri family (normal + bold) on the given document. Call before
 * any `doc.setFont(AMIRI_FONT, ...)`. Safe to call once per document.
 */
export async function registerArabicFont(doc: jsPDF): Promise<void> {
  const { regular, bold } = await loadAmiri();
  doc.addFileToVFS("Amiri-Regular.ttf", regular);
  doc.addFont("Amiri-Regular.ttf", AMIRI_FONT, "normal");
  doc.addFileToVFS("Amiri-Bold.ttf", bold);
  doc.addFont("Amiri-Bold.ttf", AMIRI_FONT, "bold");
}
