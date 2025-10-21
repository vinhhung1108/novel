import { load } from "cheerio";

export function normalizeHtmlToText(html: string): string {
  const $ = load(html ?? "");
  // Remove ads / scripts / styles / buttons:
  $("script,style,ins,iframe,button,.ads,.advertisement").remove();
  // Basic clean:
  const text = $("body")
    .text()
    .replace(/\u00a0/g, " ")
    .replace(/\s+\n/g, "\n")
    .trim();
  return text;
}
