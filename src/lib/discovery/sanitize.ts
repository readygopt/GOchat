/**
 * Enforces the two hard product rules on any user facing text: no emojis and no dash
 * characters of any kind. The model is instructed strongly in the system prompt, this is
 * the safety net that guarantees the rule even if the model slips.
 *
 * Dash handling covers every Unicode character that behaves like a dash, not just the ASCII
 * hyphen minus. Two families are treated differently so meaning is preserved:
 *   hyphen like characters (join words, for example a Portuguese enclitic like dizer-me, or a
 *     compound like follow-up) collapse to a single space
 *   long dash like characters (act as sentence punctuation, for example an em dash aside)
 *     become a comma
 * Every character below was chosen because a real model output has used it, or because it is
 * a documented Unicode dash punctuation character a model could plausibly emit.
 */

// Covers the common emoji and pictograph ranges plus variation selectors and ZWJ.
const EMOJI_SOURCE =
  "[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2190}-\\u{21FF}\\u{2B00}-\\u{2BFF}\\u{FE00}-\\u{FE0F}\\u{200D}\\u{20E3}\\u{E0020}-\\u{E007F}]";
const EMOJI_PATTERN = new RegExp(EMOJI_SOURCE, "gu");

// Hyphen like: joins two words or a word and an enclitic pronoun. Collapses to a space.
// U+002D hyphen minus, U+2010 hyphen, U+2011 non breaking hyphen, U+2043 hyphen bullet,
// U+FE63 small hyphen minus, U+FF0D fullwidth hyphen minus, U+058A Armenian hyphen.
const HYPHEN_LIKE_SOURCE = "[\\u002D\\u2010\\u2011\\u2043\\uFE63\\uFF0D\\u058A]";
const HYPHEN_LIKE_PATTERN = new RegExp(HYPHEN_LIKE_SOURCE, "g");

// Long dash like: acts as sentence punctuation, an aside, or a range. Becomes a comma.
// U+2012 figure dash, U+2013 en dash, U+2014 em dash, U+2015 horizontal bar, U+2212 minus
// sign, U+2E3A two em dash, U+2E3B three em dash, U+FE58 small em dash, U+2053 swung dash,
// U+301C wave dash, U+3030 wavy dash.
const LONG_DASH_SOURCE =
  "[\\u2012\\u2013\\u2014\\u2015\\u2212\\u2E3A\\u2E3B\\uFE58\\u2053\\u301C\\u3030]";
const LONG_DASH_SPACED_PATTERN = new RegExp(`\\s*${LONG_DASH_SOURCE}\\s*`, "g");

const ANY_DASH_SOURCE = `(?:${HYPHEN_LIKE_SOURCE}|${LONG_DASH_SOURCE})`;

export function containsForbidden(text: string): boolean {
  // Non global regexes so repeated calls are not affected by a lingering lastIndex.
  if (new RegExp(EMOJI_SOURCE, "u").test(text)) return true;
  if (new RegExp(ANY_DASH_SOURCE).test(text)) return true;
  return false;
}

export function sanitizeUserFacing(input: string): string {
  let text = input.replace(EMOJI_PATTERN, "");

  // Long dashes acting as sentence punctuation, usually spaced.
  text = text.replace(LONG_DASH_SPACED_PATTERN, ", ");

  // Normalize every hyphen like character to a plain ASCII hyphen so the rules below apply
  // uniformly regardless of which Unicode hyphen variant was used.
  text = text.replace(HYPHEN_LIKE_PATTERN, "-");

  // A spaced hyphen used as a dash, for example "prices - times".
  text = text.replace(/\s+-\s+/g, ", ");
  // A hyphen between digits, for example a date or range.
  text = text.replace(/(\d)-(\d)/g, "$1 $2");
  // A hyphen joining two word characters, for example follow-up or an enclitic like dizer-me.
  text = text.replace(/([A-Za-zÀ-ɏ])-([A-Za-zÀ-ɏ])/g, "$1 $2");
  // Any remaining hyphen.
  text = text.replace(/-/g, " ");

  // Tidy doubled spaces and stray spaces before punctuation the replacements may create.
  text = text.replace(/[ \t]{2,}/g, " ");
  text = text.replace(/\s+([,.;:!?])/g, "$1");
  text = text.replace(/,\s*,/g, ",");

  return text.trim();
}
