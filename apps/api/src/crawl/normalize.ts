import { load } from "cheerio";

export function normalizeHtmlToText(html: string): string {
  const $ = load(html ?? "");
  $("script,style,ins,iframe,button,.ads,.advertisement").remove();
  const text = $("body")
    .text()
    .replace(/\u00a0/g, " ")
    .replace(/\s+\n/g, "\n")
    .trim();
  return text;
}
