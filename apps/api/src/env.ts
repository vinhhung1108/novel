import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const candidateRoots = new Set<string>([
  process.cwd(),
  resolve(__dirname),
  resolve(__dirname, ".."),
  resolve(__dirname, "..", ".."),
  resolve(__dirname, "..", "..", ".."),
]);

const loadedFiles: string[] = [];

const CANDIDATE_FILES = Array.from(candidateRoots)
  .flatMap((root) => [
    resolve(root, "apps/api/.env"),
    resolve(root, ".env"),
  ])
  .filter((file, index, arr) => arr.indexOf(file) === index);

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  try {
    const content = readFileSync(filePath, "utf8");
    loadedFiles.push(filePath);
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .forEach((line) => {
        const idx = line.indexOf("=");
        if (idx <= 0) return;
        const key = line.slice(0, idx).trim();
        if (!key || process.env[key] !== undefined) return;
        const rawValue = line.slice(idx + 1);
        const value = rawValue.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
        process.env[key] = value;
      });
  } catch {
    // ignore malformed env files
  }
}

CANDIDATE_FILES.forEach(loadEnvFile);

if (loadedFiles.length === 0) {
  // eslint-disable-next-line no-console
  console.warn("[env] No .env files loaded for API");
} else {
  // eslint-disable-next-line no-console
  console.log(
    `[env] Loaded env files: ${loadedFiles
      .map((f) => f.replace(process.cwd(), "."))
      .join(", ")}`
  );
}
