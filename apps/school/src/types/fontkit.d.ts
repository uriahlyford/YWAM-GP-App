/**
 * fontkit ships no type declarations. Only the two things the PDF exporter needs
 * are declared here: opening a font from a buffer, and asking whether it has a
 * glyph for a codepoint. pdfkit already depends on fontkit and does the shaping;
 * this module is used purely to decide which face can draw which character.
 */
declare module "fontkit" {
  export type Font = {
    readonly postscriptName: string;
    hasGlyphForCodePoint(codePoint: number): boolean;
  };

  export function create(buffer: Buffer): Font;
}
