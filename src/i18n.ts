import { labelKeys, labelRows } from "./locales/labels";
import { helpKeys, helpRows } from "./locales/help";
export const supportedLocales = [
  { code: "en", name: "English", dir: "ltr" },
  { code: "zh-CN", name: "简体中文", dir: "ltr" },
  { code: "ja", name: "日本語", dir: "ltr" },
  { code: "ko", name: "한국어", dir: "ltr" },
  { code: "fr", name: "Français", dir: "ltr" },
  { code: "de", name: "Deutsch", dir: "ltr" },
  { code: "es", name: "Español", dir: "ltr" },
  { code: "pt-BR", name: "Português (Brasil)", dir: "ltr" },
  { code: "it", name: "Italiano", dir: "ltr" },
  { code: "nl", name: "Nederlands", dir: "ltr" },
  { code: "ru", name: "Русский", dir: "ltr" },
  { code: "pl", name: "Polski", dir: "ltr" },
  { code: "tr", name: "Türkçe", dir: "ltr" },
  { code: "ar", name: "العربية", dir: "rtl" },
  { code: "hi", name: "हिन्दी", dir: "ltr" },
  { code: "th", name: "ไทย", dir: "ltr" },
] as const;
export type Locale = (typeof supportedLocales)[number]["code"];
export type Messages = Readonly<Record<string, string>>;
const dictionaries: Record<string, Record<string, string>> = {
  en: Object.fromEntries([...labelKeys, ...helpKeys].map((key) => [key, key])),
};
for (const { code } of supportedLocales) {
  if (code === "en") continue;
  const labels = labelRows[code].split("|"),
    help = helpRows[code].split("|");
  if (labels.length !== labelKeys.length || help.length !== helpKeys.length)
    throw new Error(`Incomplete translation: ${code}`);
  dictionaries[code] = Object.fromEntries([
    ...labelKeys.map((key, i) => [key, labels[i]]),
    ...helpKeys.map((key, i) => [key, help[i]]),
  ]);
}
/** Match BCP 47 region variants, then fall back to English. No browser globals at import time. */
export function resolveLocale(value?: string | readonly string[]): Locale {
  const candidates = value
    ? typeof value === "string"
      ? [value]
      : value
    : typeof navigator !== "undefined"
      ? navigator.languages
      : ["en"];
  for (const candidate of candidates) {
    const normalized = candidate.trim().replaceAll("_", "-").toLowerCase();
    const match = supportedLocales.find(
      (l) =>
        l.code.toLowerCase() === normalized ||
        l.code.toLowerCase().split("-")[0] === normalized.split("-")[0],
    );
    if (match) return match.code;
  }
  return "en";
}
export function getMessages(locale: string): Messages {
  return dictionaries[resolveLocale(locale)];
}
export function translate(
  message: string,
  locale: string,
  overrides: Messages = {},
): string {
  if (Object.prototype.hasOwnProperty.call(overrides, message))
    return overrides[message];
  const dictionary = getMessages(locale);
  if (Object.prototype.hasOwnProperty.call(dictionary, message))
    return dictionary[message];
  const shortcut = message.match(/^(.+) (\([^)]*\))$/);
  if (shortcut && dictionary[shortcut[1]])
    return `${dictionary[shortcut[1]]} ${shortcut[2]}`;
  if (message.endsWith(" filter") && dictionary[message.slice(0, -7)])
    return resolveLocale(locale) === "en"
      ? message
      : `${dictionary[message.slice(0, -7)]} · ${dictionary.Filter}`;
  return message;
}
/** Translate trusted UI text without parsing translations as HTML or replacing elements. */
export class DOMLocalizer {
  private texts = new WeakMap<Node, { source: string; last: string }>();
  private attrs = new WeakMap<
    Element,
    Map<string, { source: string; last: string }>
  >();
  apply(root: Node, locale: string, overrides: Messages = {}) {
    const visit = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const current = node.textContent ?? "";
        let record = this.texts.get(node);
        if (!record || current !== record.last)
          record = { source: current, last: current };
        const source = record.source,
          key = source.trim(),
          translated = translate(key, locale, overrides);
        record.last = key ? source.replace(key, () => translated) : source;
        node.textContent = record.last;
        this.texts.set(node, record);
        return;
      }
      if (node instanceof Element) {
        if (node.matches("style,script,pre,code,[data-no-i18n]")) return;
        let map = this.attrs.get(node);
        if (!map) {
          map = new Map();
          this.attrs.set(node, map);
        }
        for (const attr of ["aria-label", "title", "placeholder"]) {
          const current = node.getAttribute(attr);
          if (current === null) continue;
          let record = map.get(attr);
          if (!record || current !== record.last)
            record = { source: current, last: current };
          record.last = translate(record.source, locale, overrides);
          node.setAttribute(attr, record.last);
          map.set(attr, record);
        }
      }
      for (const child of node.childNodes) visit(child);
    };
    visit(root);
  }
}
