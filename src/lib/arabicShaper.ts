/**
 * Arabic contextual shaping for PDF rendering.
 *
 * PDF "simple" fonts draw one glyph per character code with no OpenType
 * shaping, so Arabic letters would otherwise render in their isolated,
 * disconnected forms. This module converts a logical-order Arabic string into
 * the correct Unicode *presentation forms* (U+FE70–U+FEFF) — picking the
 * isolated / initial / medial / final glyph for each letter based on its
 * neighbours — and combines lam + alef into their mandatory ligatures.
 *
 * It does NOT do bidirectional reordering; run the output through a bidi pass
 * before drawing. Latin characters, digits, punctuation and whitespace pass
 * through untouched. Tashkeel (harakat) are treated as transparent: they are
 * preserved in place and ignored when computing letter adjacency.
 */

// base code → [isolated, initial, medial, final]; undefined = form not available.
type Forms = [number, number | undefined, number | undefined, number | undefined];

const FORMS: Record<number, Forms> = {
  0x0621: [0xfe80, undefined, undefined, undefined], // ء hamza
  0x0622: [0xfe81, undefined, undefined, 0xfe82], // آ alef madda
  0x0623: [0xfe83, undefined, undefined, 0xfe84], // أ alef hamza above
  0x0624: [0xfe85, undefined, undefined, 0xfe86], // ؤ waw hamza
  0x0625: [0xfe87, undefined, undefined, 0xfe88], // إ alef hamza below
  0x0626: [0xfe89, 0xfe8b, 0xfe8c, 0xfe8a], // ئ yeh hamza
  0x0627: [0xfe8d, undefined, undefined, 0xfe8e], // ا alef
  0x0628: [0xfe8f, 0xfe91, 0xfe92, 0xfe90], // ب beh
  0x0629: [0xfe93, undefined, undefined, 0xfe94], // ة teh marbuta
  0x062a: [0xfe95, 0xfe97, 0xfe98, 0xfe96], // ت teh
  0x062b: [0xfe99, 0xfe9b, 0xfe9c, 0xfe9a], // ث theh
  0x062c: [0xfe9d, 0xfe9f, 0xfea0, 0xfe9e], // ج jeem
  0x062d: [0xfea1, 0xfea3, 0xfea4, 0xfea2], // ح hah
  0x062e: [0xfea5, 0xfea7, 0xfea8, 0xfea6], // خ khah
  0x062f: [0xfea9, undefined, undefined, 0xfeaa], // د dal
  0x0630: [0xfeab, undefined, undefined, 0xfeac], // ذ thal
  0x0631: [0xfead, undefined, undefined, 0xfeae], // ر reh
  0x0632: [0xfeaf, undefined, undefined, 0xfeb0], // ز zain
  0x0633: [0xfeb1, 0xfeb3, 0xfeb4, 0xfeb2], // س seen
  0x0634: [0xfeb5, 0xfeb7, 0xfeb8, 0xfeb6], // ش sheen
  0x0635: [0xfeb9, 0xfebb, 0xfebc, 0xfeba], // ص sad
  0x0636: [0xfebd, 0xfebf, 0xfec0, 0xfebe], // ض dad
  0x0637: [0xfec1, 0xfec3, 0xfec4, 0xfec2], // ط tah
  0x0638: [0xfec5, 0xfec7, 0xfec8, 0xfec6], // ظ zah
  0x0639: [0xfec9, 0xfecb, 0xfecc, 0xfeca], // ع ain
  0x063a: [0xfecd, 0xfecf, 0xfed0, 0xfece], // غ ghain
  0x0641: [0xfed1, 0xfed3, 0xfed4, 0xfed2], // ف feh
  0x0642: [0xfed5, 0xfed7, 0xfed8, 0xfed6], // ق qaf
  0x0643: [0xfed9, 0xfedb, 0xfedc, 0xfeda], // ك kaf
  0x0644: [0xfedd, 0xfedf, 0xfee0, 0xfede], // ل lam
  0x0645: [0xfee1, 0xfee3, 0xfee4, 0xfee2], // م meem
  0x0646: [0xfee5, 0xfee7, 0xfee8, 0xfee6], // ن noon
  0x0647: [0xfee9, 0xfeeb, 0xfeec, 0xfeea], // ه heh
  0x0648: [0xfeed, undefined, undefined, 0xfeee], // و waw
  0x0649: [0xfeef, undefined, undefined, 0xfef0], // ى alef maksura
  0x064a: [0xfef1, 0xfef3, 0xfef4, 0xfef2], // ي yeh
  0x0671: [0xfb50, undefined, undefined, 0xfb51], // ٱ alef wasla
  0x0679: [0xfb66, 0xfb68, 0xfb69, 0xfb67], // ٹ tteh
  0x067e: [0xfb56, 0xfb58, 0xfb59, 0xfb57], // پ peh
  0x0686: [0xfb7a, 0xfb7c, 0xfb7d, 0xfb7b], // چ tcheh
  0x0688: [0xfb88, undefined, undefined, 0xfb89], // ڈ ddal
  0x0691: [0xfb8c, undefined, undefined, 0xfb8d], // ڑ rreh
  0x0698: [0xfb8a, undefined, undefined, 0xfb8b], // ژ jeh
  0x06a9: [0xfb8e, 0xfb90, 0xfb91, 0xfb8f], // ک keheh
  0x06af: [0xfb92, 0xfb94, 0xfb95, 0xfb93], // گ gaf
  0x06ba: [0xfb9e, undefined, undefined, 0xfb9f], // ں noon ghunna
  0x06be: [0xfbaa, 0xfbac, 0xfbad, 0xfbab], // ھ heh doachashmee
  0x06c1: [0xfba6, 0xfba8, 0xfba9, 0xfba7], // ہ heh goal
  0x06cc: [0xfbfc, 0xfbfe, 0xfbff, 0xfbfd], // ی farsi yeh
  0x06d2: [0xfbae, undefined, undefined, 0xfbaf], // ے yeh barree
};

// Lam + alef variant → [isolated ligature, final ligature].
const LAM_ALEF: Record<number, [number, number]> = {
  0x0622: [0xfef5, 0xfef6], // lam + alef madda
  0x0623: [0xfef7, 0xfef8], // lam + alef hamza above
  0x0625: [0xfef9, 0xfefa], // lam + alef hamza below
  0x0627: [0xfefb, 0xfefc], // lam + alef
};

// Tashkeel / combining marks that are transparent to joining.
function isTransparent(cp: number): boolean {
  return (
    (cp >= 0x064b && cp <= 0x065f) || // harakat + extra marks
    cp === 0x0670 || // superscript alef
    (cp >= 0x06d6 && cp <= 0x06dc) ||
    (cp >= 0x06df && cp <= 0x06e4) ||
    (cp >= 0x06e7 && cp <= 0x06e8) ||
    (cp >= 0x06ea && cp <= 0x06ed)
  );
}

function isArabicLetter(cp: number): boolean {
  return Object.prototype.hasOwnProperty.call(FORMS, cp);
}

// A letter "joins forward" (connects to the following letter) iff it has an
// initial form. Such letters are dual-joining; the rest are right-joining only.
function joinsForward(cp: number): boolean {
  const f = FORMS[cp];
  return !!f && f[1] !== undefined;
}

/**
 * Reshape a logical-order string to Arabic presentation forms. Non-Arabic
 * characters are returned unchanged. The result is still in logical order.
 */
export function reshapeArabic(input: string): string {
  if (!/[؀-ۿ]/.test(input)) return input;

  const cps = Array.from(input, (c) => c.codePointAt(0)!);

  // Precompute, for each position, the previous/next *letter* code (skipping
  // transparent marks); 0 when the neighbour is not an Arabic letter.
  const n = cps.length;
  const prevLetter: number[] = new Array(n).fill(0);
  const nextLetter: number[] = new Array(n).fill(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const cp = cps[i];
    if (isTransparent(cp)) {
      prevLetter[i] = last;
      continue;
    }
    prevLetter[i] = last;
    last = isArabicLetter(cp) ? cp : 0;
  }
  let next = 0;
  for (let i = n - 1; i >= 0; i--) {
    const cp = cps[i];
    if (isTransparent(cp)) {
      nextLetter[i] = next;
      continue;
    }
    nextLetter[i] = next;
    next = isArabicLetter(cp) ? cp : 0;
  }

  let out = "";
  for (let i = 0; i < n; i++) {
    const cp = cps[i];

    if (isTransparent(cp) || !isArabicLetter(cp)) {
      out += String.fromCodePoint(cp);
      continue;
    }

    const connectsPrev = joinsForward(prevLetter[i]); // prev exists & joins to us

    // Lam + alef mandatory ligature.
    if (cp === 0x0644 && nextLetter[i] in LAM_ALEF) {
      const lig = LAM_ALEF[nextLetter[i]];
      out += String.fromCodePoint(connectsPrev ? lig[1] : lig[0]);
      // Skip the alef we just consumed (and any transparent marks before it).
      let j = i + 1;
      while (j < n && isTransparent(cps[j])) {
        out += String.fromCodePoint(cps[j]);
        j++;
      }
      i = j; // the alef itself
      continue;
    }

    const f = FORMS[cp];
    const connectsNext = joinsForward(cp) && isArabicLetter(nextLetter[i]);

    let form: number | undefined;
    if (connectsPrev && connectsNext) form = f[2] ?? f[3] ?? f[0]; // medial
    else if (connectsPrev) form = f[3] ?? f[0]; // final
    else if (connectsNext) form = f[1] ?? f[0]; // initial
    else form = f[0]; // isolated

    out += String.fromCodePoint(form ?? cp);
  }

  return out;
}
