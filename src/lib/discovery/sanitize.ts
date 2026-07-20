/**
 * Enforces the two hard product rules on any user facing text: no emojis and no dash
 * characters of any kind. The model is instructed strongly in the system prompt, this is
 * the safety net that guarantees the rule even if the model slips.
 *
 * Dash handling is done carefully so meaning is preserved:
 *   em and en dashes become a comma plus space or a plain space depending on context
 *   a spaced hyphen used as a dash becomes a comma
 *   a hyphen joining two words becomes a single space
 *   hyphens inside numbers become a space
 */

// Covers the common emoji and pictograph ranges plus variation selectors and ZWJ.
const EMOJI_SOURCE =
  "[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2190}-\\u{21FF}\\u{2B00}-\\u{2BFF}\\u{FE00}-\\u{FE0F}\\u{200D}\\u{20E3}\\u{E0020}-\\u{E007F}]";
const EMOJI_PATTERN = new RegExp(EMOJI_SOURCE, "gu");

const DASH_SOURCE = "[‒–—―−]"; // figure, en, em, horizontal bar, minus
const DASH_CHARS = new RegExp(DASH_SOURCE, "g");

export function containsForbidden(text: string): boolean {
  // Non global regexes so repeated calls are not affected by a lingering lastIndex.
  if (new RegExp(EMOJI_SOURCE, "u").test(text)) return true;
  if (new RegExp(DASH_SOURCE).test(text)) return true;
  // A hyphen used as punctuation or joining words. Allow none at all to honor the rule.
  if (text.includes("-")) return true;
  return false;
}

export function sanitizeUserFacing(input: string): string {
  let text = input.replace(EMOJI_PATTERN, "");

  // Long dashes acting as sentence punctuation, usually spaced.
  text = text.replace(/\s*[‒–—―]\s*/g, ", ");
  // Minus sign fallback.
  text = text.replace(/−/g, " ");

  // A spaced hyphen used as a dash, for example "prices - times".
  text = text.replace(/\s+-\s+/g, ", ");
  // A hyphen between digits, for example a date or range.
  text = text.replace(/(\d)-(\d)/g, "$1 $2");
  // A hyphen joining two word characters, for example follow-up.
  text = text.replace(/([A-Za-zÀ-ɏ])-([A-Za-zÀ-ɏ])/g, "$1 $2");
  // Any remaining hyphen.
  text = text.replace(/-/g, " ");

  // Tidy doubled spaces and stray spaces before punctuation the replacements may create.
  text = text.replace(/[ \t]{2,}/g, " ");
  text = text.replace(/\s+([,.;:!?])/g, "$1");
  text = text.replace(/,\s*,/g, ",");

  return text.trim();
}
