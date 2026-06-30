declare module "bidi-js" {
  export interface EmbeddingLevelsResult {
    levels: Uint8Array;
    paragraphs: Array<{ start: number; end: number; level: number }>;
  }

  export interface Bidi {
    getEmbeddingLevels(
      text: string,
      baseDirection?: "ltr" | "rtl" | "auto"
    ): EmbeddingLevelsResult;
    getReorderedString(
      text: string,
      embeddingLevels: EmbeddingLevelsResult,
      start?: number,
      end?: number
    ): string;
    getReorderedIndices(
      text: string,
      embeddingLevels: EmbeddingLevelsResult,
      start?: number,
      end?: number
    ): number[];
    getReorderSegments(
      text: string,
      embeddingLevels: EmbeddingLevelsResult,
      start?: number,
      end?: number
    ): number[][];
  }

  const bidiFactory: () => Bidi;
  export default bidiFactory;
}
