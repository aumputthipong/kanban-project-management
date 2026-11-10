#!/usr/bin/env node
// Fails when backend statement coverage drops under backend/coverage-floors.json.
// Usage: node scripts/check-go-coverage.mjs backend/coverage.out
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backend = join(root, "backend");
const profilePath = process.argv[2] ?? join(backend, "coverage.out");
const floors = JSON.parse(readFileSync(join(backend, "coverage-floors.json"), "utf8"));
const modulePath = readFileSync(join(backend, "go.mod"), "utf8").match(/^module\s+(\S+)/m)[1];

const generatedCache = new Map();
function isGenerated(rel) {
  if (!generatedCache.has(rel)) {
    const file = join(backend, rel);
    const head = existsSync(file) ? readFileSync(file, "utf8").slice(0, 2000) : "";
    generatedCache.set(rel, /^\/\/ Code generated .* DO NOT EDIT\.$/m.test(head));
  }
  return generatedCache.get(rel);
}

// A block can appear once per test binary that ran it; keep it once, covered if any run hit it.
const blocks = new Map();
for (const line of readFileSync(profilePath, "utf8").split(/\r?\n/).slice(1)) {
  const m = line.match(/^(.+):(\d+\.\d+,\d+\.\d+) (\d+) (\d+)$/);
  if (!m) continue;
  const rel = m[1].startsWith(modulePath + "/") ? m[1].slice(modulePath.length + 1) : m[1];
  if (floors.exclude.some((prefix) => rel.startsWith(prefix)) || isGenerated(rel)) continue;
  const key = `${rel}:${m[2]}`;
  const prev = blocks.get(key);
  blocks.set(key, { rel, stmts: Number(m[3]), hit: (prev?.hit ?? false) || Number(m[4]) > 0 });
}

const totals = new Map();
const add = (pkg, b) => {
  const t = totals.get(pkg) ?? { covered: 0, total: 0 };
  t.total += b.stmts;
  if (b.hit) t.covered += b.stmts;
  totals.set(pkg, t);
};
for (const b of blocks.values()) {
  add(dirname(b.rel), b);
  add("(global)", b);
}

if (!totals.has("(global)")) {
  console.error(`no coverage blocks found in ${profilePath}`);
  process.exit(1);
}

const pct = (t) => (t.total ? (100 * t.covered) / t.total : 0);
const failures = [];
const rows = [...totals.keys()].sort().map((pkg) => {
  const actual = pct(totals.get(pkg));
  const floor = pkg === "(global)" ? floors.global : floors.packages[pkg];
  if (floor !== undefined && actual < floor) failures.push(`${pkg}: ${actual.toFixed(1)}% < floor ${floor}%`);
  const hint = floor !== undefined && actual - floor > 5 ? "  (consider raising the floor)" : "";
  return `${pkg.padEnd(28)} ${actual.toFixed(1).padStart(5)}%  floor ${floor === undefined ? "  -" : String(floor).padStart(3)}${hint}`;
});
console.log(rows.join("\n"));

for (const pkg of Object.keys(floors.packages)) {
  if (!totals.has(pkg)) failures.push(`${pkg}: has a floor but no coverage data (renamed or excluded?)`);
}

if (failures.length) {
  console.error(`\nBackend coverage under floor:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("\nBackend coverage floors OK");
