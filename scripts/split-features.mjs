import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT =
  process.env.FEATURE_DOCS_ROOT ?? resolve(fileURLToPath(new URL('..', import.meta.url)));
const FEATURES = resolve(ROOT, 'FEATURES.md');
const DIRECTORY = resolve(ROOT, 'docs/features');
const AREAS = [
  ['setup', 'Set up', ['Welcome to Goodboy', 'Provider connection', 'Integrations']],
  [
    'start',
    'Start a task',
    [
      'Pick up a task, with a drafted brief',
      'Review a pull request',
      'Run a workflow',
      'Ask an agent',
    ],
  ],
  ['overview', 'Overview and activity', ['Session overview', 'Activity', 'Next']],
  ['switching', 'Switch between tasks', ['Activity bar', 'Now chip', 'Notifications']],
  ['search', 'Search and navigation', ['Go anywhere', 'Command palette', 'Search']],
  [
    'workspace',
    'Workspace and projects',
    ['Workspace with several projects', 'Worktrees', 'Repo status across projects'],
  ],
  [
    'branch-history',
    'Commits and history',
    ['Shape the history', 'Safe apply', 'Conflict prediction'],
  ],
  [
    'review',
    'Review and resolve on the Branch page',
    ['Resolve', 'Review sources', 'Close on GitHub', 'Read the code'],
  ],
  ['board', 'The board', ['Stage board', 'Session card']],
  ['workflows', 'Workflows', ['Workflow builder', 'Orchestrated', 'Workflow run', 'Spend cap']],
  ['inbox', 'Tasks and your tools', ['Tasks', 'Trackers', 'Code hosts', 'Start from any item']],
  ['artifacts', 'Plans, reports and wireframes', ['Artifacts', 'Create a wireframe', 'Compare']],
  ['context', 'Shared context', ['Decisions', 'Running summary', 'Context drawer']],
  [
    'providers',
    'Providers, limits and cost',
    [
      'Usage limits chip',
      'Fallback when a limit is hit',
      'Model picker',
      'Impact',
      'Monthly cap and budget alert',
    ],
  ],
  ['storage', 'Storage', ['Worktree folders', 'Branches', 'Goodboy can free N GB']],
  [
    'security',
    'Security, backup and updates',
    ['Security findings', 'Export and import your setup', 'Updates'],
  ],
  ['agents', 'Agents', ['Workspace chat', 'Roles', 'Agent transcript']],
  ['support', 'Support Goodboy', ['Report a bug']],
  [
    'keyboard',
    'Keyboard and terminal',
    ['Terminal', 'Keyboard shortcuts, back and forward', 'Explore'],
  ],
];

const sourceMarkdown = ({ ref }) =>
  execFileSync('git', ['show', `${ref}:FEATURES.md`], { cwd: ROOT, encoding: 'utf8' });

const heading = /^## (.+)$/m;
const sectionFor = ({ markdown, title }) => {
  const match = new RegExp(`^## ${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm').exec(
    markdown,
  );
  if (match === null) return null;
  const start = match.index;
  const endMatch = markdown.slice(start + 3).match(/\n## |\n<details>\n<summary><h2>/);
  const end = endMatch === null ? markdown.length : start + 3 + endMatch.index + 1;
  return markdown.slice(start, end).trim();
};
const keyboardFor = ({ markdown }) => {
  const start = markdown.indexOf('<details>\n<summary><h2>Keyboard and terminal</h2></summary>');
  const end = markdown.indexOf('\n</details>', start);
  return markdown
    .slice(start, end + '\n</details>'.length)
    .replace(
      '<details>\n<summary><h2>Keyboard and terminal</h2></summary>',
      '# Keyboard and terminal',
    )
    .replace(/\n<\/details>$/, '')
    .trim();
};
const anchorsFor = ({ body }) =>
  [...body.matchAll(/^### (.+)$/gm)].map(([, title]) =>
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
      .replace(/ /g, '-'),
  );
const leadFor = ({ body }) =>
  body.split('\n').find((line) => line.length > 0 && !line.startsWith('#')) ?? '';
const indexFor = ({ docs, source }) => {
  const entries = AREAS.map(([slug, title, main]) => {
    const body = docs.get(slug);
    const anchors = anchorsFor({ body })
      .map((anchor) => `<a id="${anchor}"></a>`)
      .join('');
    return `${anchors}\n## ${title}\n\n${leadFor({ body })}\n\n${main.map((item) => `- ${item}`).join('\n')}\n\n[More on ${title.toLowerCase()}](docs/features/${slug}.md)`;
  });
  const introduction = source
    .split('\n')
    .slice(2, 6)
    .filter((line) => !line.startsWith('- ['))
    .join('\n');
  return `# Goodboy features\n\n${introduction}\n\n${entries.join('\n\n')}\n\n<a id="also-there"></a>\n`;
};
const generate = ({ ref }) => {
  const markdown = sourceMarkdown({ ref });
  const docs = new Map();
  for (const [slug, title] of AREAS) {
    const body = slug === 'keyboard' ? keyboardFor({ markdown }) : sectionFor({ markdown, title });
    if (body === null) throw new Error(`Missing ${title}`);
    docs.set(slug, body.replace(/^## /, '# '));
  }
  const additions = {
    workflows: 'After a restart, one Resume all starts the stopped agents again.',
    agents: 'When one recommends the next, its reason and result travel with it.',
  };
  for (const [slug, addition] of Object.entries(additions)) {
    const body = docs.get(slug);
    docs.set(slug, `${body}\n\n${addition}`);
  }
  const also = sectionFor({ markdown, title: 'Also there' });
  const rows = also
    .split('\n')
    .filter((line) =>
      /^\| (?:Written by Goodboy|Resolve again|Checks|Settings rail|Update pill) /.test(line),
    );
  const areas = new Map([
    ['review', rows.filter((line) => /Written by Goodboy|Resolve again|Checks/.test(line))],
    ['setup', rows.filter((line) => /Settings rail/.test(line))],
    ['security', rows.filter((line) => /Update pill/.test(line))],
  ]);
  for (const [slug, areaRows] of areas) {
    const body = docs.get(slug);
    docs.set(
      slug,
      `${body}\n\n**Also in this area**\n\n| Feature | What it does for you |\n| ------- | -------------------- |\n${areaRows.join('\n')}`,
    );
  }
  return { docs, index: indexFor({ docs, source: markdown }) };
};
const nonStructuralLines = ({ markdown, isSource }) =>
  markdown
    .split('\n')
    .filter((line) => line.trim() !== '')
    .filter((line) => !/^#(?: |$)|^## /.test(line))
    .filter((line) => !/^<\/?details>|^<summary><h2>.*<\/h2><\/summary>$/.test(line))
    .filter((line) => !/^<a id=/.test(line))
    .filter((line) => !/^\| (?:Feature|[- ]+\|)/.test(line))
    .filter((line) => !(isSource && /^- \[.*\]\(#.*\)$/.test(line)));
const countLines = ({ lines }) =>
  lines.reduce((counts, line) => counts.set(line, (counts.get(line) ?? 0) + 1), new Map());
const wordCount = ({ markdown }) => (markdown.match(/[\p{L}\p{N}]+/gu) ?? []).length;
const indexEntries = ({ index }) => [
  ...index.matchAll(
    /^## (.+)\n\n[\s\S]*?\n\n((?:- .+\n)+)\n\[More on .*?\]\(docs\/features\/([a-z-]+)\.md\)$/gm,
  ),
];
const checkCurrent = () => {
  const docs = new Map(
    AREAS.map(([slug]) => [slug, readFileSync(resolve(DIRECTORY, `${slug}.md`), 'utf8').trim()]),
  );
  const index = readFileSync(FEATURES, 'utf8');
  const entries = indexEntries({ index });
  const expectedSlugs = new Set(AREAS.map(([slug]) => slug));
  const listedSlugs = new Set(entries.map(([, , , slug]) => slug));
  const files = readdirSync(DIRECTORY)
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.slice(0, -3));
  if (entries.length !== AREAS.length || listedSlugs.size !== AREAS.length)
    throw new Error('FEATURES.md does not list every feature area exactly once');
  for (const slug of expectedSlugs) {
    if (!listedSlugs.has(slug)) throw new Error(`FEATURES.md is missing ${slug}`);
    if (!files.includes(slug)) throw new Error(`docs/features/${slug}.md is missing`);
  }
  for (const slug of files)
    if (!expectedSlugs.has(slug)) throw new Error(`docs/features/${slug}.md is orphaned`);
  for (const [, title, bullets, slug] of entries) {
    const body = docs.get(slug);
    if (!body.startsWith(`# ${title}\n`))
      throw new Error(`${slug}.md H1 does not match its index entry`);
    for (const [, item] of bullets.matchAll(/^- (.+)$/gm)) {
      if (!body.includes(`### ${item}`))
        throw new Error(`${slug}.md is missing index main item ${item}`);
    }
  }
  const anchors = new Set(
    [...index.matchAll(/<a id="([^"]+)"><\/a>/g)].map(([, anchor]) => anchor),
  );
  for (const body of docs.values()) {
    for (const anchor of anchorsFor({ body })) {
      if (!anchors.has(anchor)) throw new Error(`FEATURES.md is missing legacy anchor ${anchor}`);
    }
  }
  const ownership = readFileSync(resolve(ROOT, 'docs/README.md'), 'utf8');
  const globs = new Set();
  for (const slug of expectedSlugs) {
    const row = ownership.match(
      new RegExp(`^\\|\\s*${slug}\\s*\\|\\s*\\x60([^\\x60]+)\\x60\\s*\\|$`, 'm'),
    );
    if (row === null) throw new Error(`docs/README.md has no ownership glob for ${slug}`);
    if (globs.has(row[1])) throw new Error(`source glob ${row[1]} has more than one feature area`);
    globs.add(row[1]);
  }
  console.log(
    `Feature doc contract OK: ${entries.length} index entries, ${files.length} area files, ${globs.size} ownership globs`,
  );
};
const checkParity = ({ ref }) => {
  const docs = new Map(
    AREAS.map(([slug]) => [slug, readFileSync(resolve(DIRECTORY, `${slug}.md`), 'utf8').trim()]),
  );
  const source = sourceMarkdown({ ref });
  const expected = indexFor({ docs, source });
  const actual = readFileSync(FEATURES, 'utf8');
  if (actual !== expected) throw new Error('FEATURES.md is not generated from docs/features');
  for (const [slug, , main] of AREAS) {
    const body = docs.get(slug);
    for (const item of main)
      if (!body.includes(`### ${item}`)) throw new Error(`${slug} is missing main item ${item}`);
  }
  const expectedDocs = generate({ ref }).docs;
  for (const [slug, body] of expectedDocs) {
    if (docs.get(slug) !== body)
      throw new Error(`${slug}.md differs from the HEAD-derived split source`);
  }
  const sourceLines = countLines({
    lines: nonStructuralLines({ markdown: source, isSource: true }),
  });
  const sourceIntroduction = source.slice(0, source.indexOf('\n## '));
  const targetLines = countLines({
    lines: nonStructuralLines({
      markdown: `${sourceIntroduction}\n${[...docs.values()].join('\n')}`,
      isSource: false,
    }),
  });
  for (const [line, count] of sourceLines) {
    if (targetLines.get(line) !== count) throw new Error(`Lost or duplicated source line: ${line}`);
  }
  const sourceHeadings = [...source.matchAll(/^### (.+)$/gm)].map(([, title]) => title);
  const targetHeadings = [...docs.values()].flatMap((body) =>
    [...body.matchAll(/^### (.+)$/gm)].map(([, title]) => title),
  );
  if (JSON.stringify(sourceHeadings.sort()) !== JSON.stringify(targetHeadings.sort()))
    throw new Error('H3 parity failed');
  const tagCount = (markdown) =>
    (markdown.match(/<\/?(?:picture)|<(?:source|img)\b/g) ?? []).length;
  if (tagCount(source) !== tagCount([...docs.values()].join('\n')))
    throw new Error('Image tag parity failed');
  const oldWords = wordCount({ markdown: source });
  const newWords = wordCount({ markdown: `${actual}\n${[...docs.values()].join('\n')}` });
  if (newWords < oldWords - 80)
    throw new Error(`Word parity failed: ${newWords} < ${oldWords - 80}`);
  console.log(
    `Feature split parity OK: ${AREAS.length} areas, ${targetHeadings.length} entries, ${newWords}/${oldWords} words`,
  );
};
const main = () => {
  if (process.argv.length > 2 && !process.argv.includes('--check')) {
    throw new Error('split-features only supports --check');
  }
  return checkCurrent();
};
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
