#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const configPath = path.join(__dirname, "banned-colors.json");
const allowComment = "ct-allow-hardcoded-color";

const supportedGlobs = [
  "--glob",
  "*.{js,jsx,ts,tsx,css,scss,less,md,mdx,html}",
  "--glob",
  "!node_modules/**",
  "--glob",
  "!dist/**",
  "--glob",
  "!build/**",
  "--glob",
  "!coverage/**",
  "--glob",
  "!**/*.min.*",
  "--glob",
  "!**/package-lock.json",
  "--glob",
  "!**/yarn.lock",
];

function loadConfig() {
  if (!fs.existsSync(configPath)) {
    return { bannedHexCodes: [], bannedClassnames: [] };
  }

  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw);
}

function runRg(pattern, { fixedString = false } = {}) {
  const args = [
    "--line-number",
    "--no-heading",
    "--color=never",
    ...supportedGlobs,
  ];

  if (fixedString) {
    args.push("--fixed-strings");
  }

  args.push(pattern);

  const result = spawnSync("rg", args, { cwd: repoRoot, encoding: "utf8" });

  if (result.status === 1) {
    return [];
  }

  if (result.status !== 0) {
    const message = result.stderr || result.stdout || "Unknown ripgrep error.";
    throw new Error(message);
  }

  return result.stdout.trim().split("\n").filter(Boolean);
}

function parseRgLine(line) {
  const match = line.match(/^(.*?):(\d+):(.*)$/);
  if (!match) {
    return null;
  }
  return {
    filePath: match[1],
    lineNumber: Number.parseInt(match[2], 10),
    content: match[3],
  };
}

const fileCache = new Map();

function getFileLines(filePath) {
  if (!fileCache.has(filePath)) {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(repoRoot, filePath);
    const contents = fs.readFileSync(fullPath, "utf8");
    fileCache.set(filePath, contents.split(/\r?\n/));
  }

  return fileCache.get(filePath);
}

function hasAllowComment(filePath, lineNumber, content) {
  if (content.includes(allowComment)) {
    return true;
  }

  const lines = getFileLines(filePath);
  const previousLine = lines[lineNumber - 2];
  return Boolean(previousLine && previousLine.includes(allowComment));
}

function collectMatches(label, pattern, options = {}) {
  const results = [];
  const lines = runRg(pattern, options);

  for (const line of lines) {
    const parsed = parseRgLine(line);
    if (!parsed) {
      continue;
    }
    if (hasAllowComment(parsed.filePath, parsed.lineNumber, parsed.content)) {
      continue;
    }
    results.push({
      ...parsed,
      label,
    });
  }

  return results;
}

function main() {
  const { bannedHexCodes = [], bannedClassnames = [] } = loadConfig();

  if (bannedHexCodes.length === 0 && bannedClassnames.length === 0) {
    console.log(
      "No banned hex codes or classnames configured. Update scripts/banned-colors.json to enable checks."
    );
    return;
  }

  const violations = [];

  for (const hex of bannedHexCodes) {
    violations.push(
      ...collectMatches(`banned hex code: ${hex}`, hex, { fixedString: true })
    );
  }

  for (const classname of bannedClassnames) {
    violations.push(
      ...collectMatches(`banned classname: ${classname}`, classname, {
        fixedString: true,
      })
    );
  }

  if (violations.length === 0) {
    console.log("No banned color usages found.");
    return;
  }

  console.error("Banned color usages detected:\n");
  for (const violation of violations) {
    console.error(
      `${violation.filePath}:${violation.lineNumber}: ${violation.label}`
    );
    console.error(`  ${violation.content.trim()}`);
  }
  console.error(
    "\nAdd // ct-allow-hardcoded-color (or /* ct-allow-hardcoded-color */) to allow specific usages."
  );
  process.exitCode = 1;
}

main();
