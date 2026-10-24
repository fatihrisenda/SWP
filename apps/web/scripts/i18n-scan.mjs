// Pemindai kunci i18n: daftar `t('…')` literal + templat dinamis di src/.
// Pakai: node apps/web/scripts/i18n-scan.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.argv[2] ?? join(process.cwd(), 'apps/web/src');

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(full) ? [full] : [];
  });
}

const literal = new Set();
const dynamic = new Map();

for (const file of walk(root)) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(join(root, '..'), file);
  // t('key') / t("key") — juga lewat variabel `t` hasil useTranslation.
  for (const m of src.matchAll(/(?:^|[^A-Za-z0-9_$.])t\(\s*'([a-zA-Z0-9_.-]+)'/g)) literal.add(`${m[1]}\t${rel}`);
  for (const m of src.matchAll(/(?:^|[^A-Za-z0-9_$.])t\(\s*"([a-zA-Z0-9_.-]+)"/g)) literal.add(`${m[1]}\t${rel}`);
  // t(`prefix.${expr}`)
  for (const m of src.matchAll(/t\(\s*`([a-zA-Z0-9_.-]*)\.\$\{[^}]+\}`/g)) {
    const prefix = m[1];
    if (!dynamic.has(prefix)) dynamic.set(prefix, new Set());
    dynamic.get(prefix).add(rel);
  }
  // Key dari sumber data (bukan literal `t(`): energyKey / reasonKey / tipKeys / dst.
  for (const m of src.matchAll(/['"`]((?:rec|errors|form|time|tasks|priority|scale|mood|categoryType|roles|settings|auth)\.[a-zA-Z0-9_.-]+)['"`]/g)) {
    literal.add(`(data) ${m[1]}\t${rel}`);
  }
}

const keys = [...literal].map((line) => line.split('\t'));
keys.sort((a, b) => a[0].localeCompare(b[0]));

let current = '';
for (const [key, where] of keys) {
  const head = key.split('.')[0];
  if (head !== current) {
    current = head;
    console.log(`\n# ${current}`);
  }
  console.log(`  ${key}\t${where}`);
}

console.log('\n# TEMPLAT DINAMIS (prefix)');
for (const [prefix, files] of [...dynamic.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`  ${prefix}.*\t${[...files].join(', ')}`);
}
