import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const readRepoFile = ({ path }) => readFileSync(resolve(ROOT, path), 'utf8');

const SKIPPED_STEPS = {
  audit: 'network advisory lookup, only on a pull request that changes the lockfile',
  'lockfile changed': 'decides whether the audit runs',
  'detect rust changes': 'the gate decides with git diff against the base',
  'lint scope':
    'gate:quick lints the changed files with its own git diff, the full gate lints the tree',
  'toolchain pin': 'compares workflow files, not a code check',
  'stub frontend dist': 'ensure_frontend_dist in scripts/gate.sh',
};

const PLUMBING =
  /^(echo|printf|mkdir|exit|git fetch|git diff|grep|tr |true|\[|files=|if |fi$|then$|for |do$|done$)/;

const jobSteps = ({ text, job }) => {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line === `  ${job}:`);
  if (start < 0) {
    return [];
  }
  const after = lines.slice(start + 1);
  const length = after.findIndex((line) => /^ {2}\S/.test(line));
  const body = length < 0 ? after : after.slice(0, length);
  const steps = [];
  for (let index = 0; index < body.length; index += 1) {
    const line = body[index];
    const named = line.match(/^ {6}- name: (.+)$/);
    if (named) {
      steps.push({ name: named[1].trim(), run: '' });
      continue;
    }
    const current = steps[steps.length - 1];
    const inline = line.match(/^ {8}run: (?![|>])(.+)$/);
    if (current && inline) {
      current.run = inline[1];
      continue;
    }
    if (current && /^ {8}run: [|>]-?$/.test(line)) {
      const block = [];
      while (index + 1 < body.length && /^ {10}\S|^\s*$/.test(body[index + 1])) {
        index += 1;
        block.push(body[index].trim());
      }
      current.run = block.join('\n');
    }
  }
  return steps;
};

const stripToStatic = ({ segment }) => {
  const tokens = segment.split(/\s+/).filter((token) => token !== '');
  const dynamic = tokens.findIndex((token) => token.includes('$'));
  const kept = dynamic < 0 ? tokens : tokens.slice(0, dynamic);
  if (kept[0] === 'xargs') {
    const rest = kept.slice(1);
    const first = rest.findIndex((token) => !token.startsWith('-'));
    return rest.slice(first < 0 ? rest.length : first).join(' ');
  }
  return kept.join(' ');
};

const commandsOf = ({ run }) =>
  run
    .split('\n')
    .flatMap((line) => line.split(/&&|\|\||\||;/))
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '' && !PLUMBING.test(segment))
    .map((segment) => stripToStatic({ segment }))
    .filter((command) => command !== '');

const ciCommands = ({ workflow, job }) =>
  jobSteps({ text: readRepoFile({ path: `.github/workflows/${workflow}` }), job })
    .filter(({ name }) => !(name in SKIPPED_STEPS))
    .flatMap(({ run }) => commandsOf({ run }));

const missingFromGate = ({ gate, commands }) => {
  const flat = gate.replace(/\s+/g, ' ');
  return commands.filter((command) => !flat.includes(command));
};

const gateText = readRepoFile({ path: 'scripts/gate.sh' });

describe('commandsOf', () => {
  it('splits chained commands and drops plumbing', () => {
    assert.deepEqual(
      commandsOf({ run: 'git fetch --depth=1 origin main && pnpm run check:rules' }),
      ['pnpm run check:rules'],
    );
    assert.deepEqual(commandsOf({ run: 'a --x && b --y' }), ['a --x', 'b --y']);
  });

  it('cuts a command at its first dynamic argument', () => {
    assert.deepEqual(commandsOf({ run: 'pnpm exec commitlint --from "$BASE" --to "$HEAD"' }), [
      'pnpm exec commitlint --from',
    ]);
    assert.deepEqual(commandsOf({ run: 'printf \'%s\' "$TITLE" | pnpm exec commitlint' }), [
      'pnpm exec commitlint',
    ]);
  });

  it('reads the command behind xargs', () => {
    assert.deepEqual(commandsOf({ run: 'echo "$files" | xargs -0 pnpm exec prettier --check' }), [
      'pnpm exec prettier --check',
    ]);
  });
});

describe('missingFromGate', () => {
  it('reports a command the gate does not run', () => {
    assert.deepEqual(
      missingFromGate({
        gate: 'step a pnpm run check:rules',
        commands: ['pnpm run check:rules', 'pnpm run check:nothing'],
      }),
      ['pnpm run check:nothing'],
    );
  });
});

describe('scripts/gate.sh against the CI jobs', () => {
  for (const { workflow, job } of [
    { workflow: 'ci.yml', job: 'checks' },
    { workflow: 'ci.yml', job: 'commits' },
    { workflow: 'rust.yml', job: 'check' },
  ]) {
    it(`runs every command of ${workflow} ${job}`, () => {
      const commands = ciCommands({ workflow, job });
      assert.ok(commands.length > 0, `${workflow} ${job} has commands to compare`);
      assert.deepEqual(missingFromGate({ gate: gateText, commands }), []);
    });
  }

  it('checks the formatting of changed files in CI', () => {
    const commands = ciCommands({ workflow: 'ci.yml', job: 'checks' });
    assert.ok(commands.includes('pnpm exec prettier --check'));
  });

  it('checks commit messages and the pull request title in CI', () => {
    const commands = ciCommands({ workflow: 'ci.yml', job: 'commits' });
    assert.ok(commands.includes('pnpm exec commitlint --from'));
    assert.ok(commands.includes('pnpm exec commitlint'));
  });

  it('honors GATE_WORKERS and the environment target dir', () => {
    assert.match(gateText, /GATE_WORKERS:-2/);
    assert.match(gateText, /CARGO_TARGET_DIR="\$\{CARGO_TARGET_DIR:-\$\(shared_target_dir\)\}"/);
    assert.match(gateText, /^export CARGO_TARGET_DIR$/m);
  });

  it('builds Rust in the target folder of the main checkout', () => {
    const fn = gateText.match(/^shared_target_dir\(\) \{\n[\s\S]*?\n\}$/m)?.[0];
    assert.ok(fn !== undefined, 'gate.sh defines shared_target_dir');
    const dir = execFileSync(
      'bash',
      ['-c', `TAURI_DIR=apps/desktop/src-tauri\n${fn}\nshared_target_dir`],
      {
        cwd: ROOT,
        encoding: 'utf8',
      },
    ).trim();
    const common = execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      {
        cwd: ROOT,
        encoding: 'utf8',
      },
    ).trim();
    assert.equal(dir, `${dirname(common)}/apps/desktop/src-tauri/target`);
  });

  it('picks the quick gate tests with the quick plan and the import graph CI uses', () => {
    assert.match(gateText, /node scripts\/ci-changes\.mjs --quick "\$MERGE_BASE"/);
    assert.doesNotMatch(gateText, /vitest related/);
  });

  it('runs the full unit suites when the quick plan is full', () => {
    assert.match(gateText, /\[ "\$scope" = full \] && \{ check_full_tests/);
  });

  it('runs check:doc-refs when the quick plan asks for it', () => {
    assert.match(gateText, /grep -qx 'check doc-refs' && \{ pnpm run check:doc-refs/);
  });

  it('lints only the changed files when a suppressions file changed', () => {
    const lint = gateText.slice(gateText.indexOf('check_lint_ts() {'));
    assert.doesNotMatch(gateText.match(/^LINT_CONFIG=.*$/m)[0], /suppressions/);
    assert.match(
      lint,
      /grep -qE "\$LINT_SUPPRESSIONS" && unpruned=--pass-on-unpruned-suppressions/,
    );
    assert.equal(
      lint.slice(0, lint.indexOf('\n}\n')).match(/--no-warn-ignored \$unpruned/g).length,
      2,
    );
  });

  it('prints the output contract', () => {
    assert.match(gateText, /echo "gate ok"/);
    assert.match(gateText, /echo "gate failed at \$name: \$log"/);
  });
});

describe('gate wiring', () => {
  const workflow = readRepoFile({ path: '.github/workflows/ci.yml' });
  const manifest = JSON.parse(readRepoFile({ path: 'package.json' }));

  it('exposes the full and the quick gate as scripts', () => {
    assert.equal(manifest.scripts.gate, 'bash scripts/gate.sh');
    assert.equal(manifest.scripts['gate:quick'], 'bash scripts/gate.sh --quick');
  });

  it('runs this test with the script tests', () => {
    assert.match(manifest.scripts['test:scripts'], /scripts\/gate\.test\.mjs/);
  });

  it('makes the required gate job wait for commits', () => {
    const gateBlock = workflow.slice(workflow.indexOf('\n  gate:\n'));
    assert.match(gateBlock, /^ {4}needs:\s*\[[^\]]*\bcommits\b[^\]]*\]/m);
  });

  it('reports commits on every event and lints only pull requests', () => {
    const steps = jobSteps({ text: workflow, job: 'commits' });
    assert.ok(steps.length > 0);
    const block = workflow.slice(workflow.indexOf('\n  commits:\n'));
    assert.match(block, /github\.event_name == 'pull_request'/);
    assert.match(block, /PR_TITLE: \$\{\{ github\.event\.pull_request\.title \}\}/);
    assert.doesNotMatch(block, /run: .*\$\{\{ github\.event\.pull_request\.title/);
  });

  it('keeps the logs out of git', () => {
    assert.match(readRepoFile({ path: '.gitignore' }), /^\.gate-logs\/$/m);
  });

  it('lets website.yml report on every pull request', () => {
    const text = readRepoFile({ path: '.github/workflows/website.yml' });
    const trigger = text.slice(text.indexOf('\non:\n'), text.indexOf('\npermissions:'));
    assert.doesNotMatch(trigger, /paths:/);
    assert.match(text, /website=false/);
  });

  it('lists every CI job in the parity table of CONVENTIONS.md', () => {
    const conventions = readRepoFile({ path: 'CONVENTIONS.md' });
    const section = conventions.slice(conventions.indexOf('## CI parity'));
    assert.ok(section.length > 0, 'CONVENTIONS.md has a CI parity section');
    for (const job of ['checks', 'commits', 'test-desktop', 'test-packages', 'rust', 'website']) {
      assert.ok(section.includes(`\`${job}\``), `parity table names ${job}`);
    }
    assert.match(section, /gate:quick/);
  });
});
