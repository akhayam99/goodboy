#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TRANSFORM_FLAG = '--experimental-transform-types';

if (!process.execArgv.includes(TRANSFORM_FLAG)) {
  const { status } = spawnSync(
    process.execPath,
    [TRANSFORM_FLAG, '--disable-warning=ExperimentalWarning', ...process.argv.slice(1)],
    { stdio: 'inherit' },
  );
  process.exit(status ?? 1);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DB_SRC = join(ROOT, 'packages', 'db', 'src');

const FIXTURE_SHAPE = {
  workspaces: ['Harborline', 'Northwind', 'Acme', 'Cascadia'],
  projects: ['ledger-core', 'notify-relay', 'payments-api'],
  sessions: 7,
  agentsPerSession: 150,
  heavyAgentEvents: 5000,
  worktrees: 60,
  mergedPullRequests: 24,
};

const BASE_TIME = Date.parse('2026-11-01T09:00:00.000Z');
const MINUTE = 60_000;
const SUMMARY_SENTENCE =
  'Reconciled the ledger export against the notify-relay queue and left the payments-api totals unchanged. ';
const TOOL_OUTPUT_LINE =
  'ledger-core/src/importer/rows.ts:118: skipped trailing-comma row for Harborline invoice batch\n';
const TOOL_NAMES = ['Read', 'Grep', 'Bash', 'Edit'];
const EVENT_CHUNK = 100;

const tryResolve = ({ specifier, context, nextResolve }) => {
  try {
    return nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
      throw error;
    }
    for (const suffix of ['.ts', '/index.ts']) {
      try {
        return nextResolve(`${specifier}${suffix}`, context);
      } catch {
        continue;
      }
    }
    throw error;
  }
};

let hasHooks = false;

const installTypeScriptHooks = () => {
  if (hasHooks) {
    return;
  }
  hasHooks = true;
  registerHooks({
    resolve: (specifier, context, nextResolve) => tryResolve({ specifier, context, nextResolve }),
  });
};

const loadDb = async () => {
  installTypeScriptHooks();
  const load = (relative) => import(pathToFileURL(join(DB_SRC, relative)).href);
  const [testDb, migrationsIndex, runner, queries] = await Promise.all([
    load('test-helpers/test-db.ts'),
    load('migrations/index.ts'),
    load('migrations/runner.ts'),
    load('index.ts'),
  ]);
  const testing = await import(
    pathToFileURL(join(ROOT, 'packages', 'types', 'src', 'testing', 'index.ts')).href
  );
  return { testDb, migrationsIndex, runner, queries, testing };
};

const isoAt = ({ offsetMs }) => new Date(BASE_TIME + offsetMs).toISOString();

const slugOf = ({ name }) => name.toLowerCase();

const summaryOf = ({ index }) =>
  `${SUMMARY_SENTENCE.repeat(6)}step ${index}`.slice(0, 860 + (index % 40));

const toolOutputOf = ({ index }) => TOOL_OUTPUT_LINE.repeat(120 + (index % 160));

const heavyEventsOf = ({ agentId, sessionId, count }) => {
  const runId = `run-${agentId}`;
  const events = [];
  let step = 0;
  while (events.length < count) {
    const at = isoAt({ offsetMs: step * 1500 });
    const toolUseId = `tool-${step}`;
    events.push({
      id: `evt-${agentId}-${events.length}`,
      sessionId,
      agentId,
      event: { kind: 'assistant_text', runId, delta: `Checking batch ${step} of the ledger.`, at },
    });
    events.push({
      id: `evt-${agentId}-${events.length}`,
      sessionId,
      agentId,
      event: {
        kind: 'tool_call_start',
        runId,
        toolUseId,
        toolName: TOOL_NAMES[step % TOOL_NAMES.length],
        input: { path: `ledger-core/src/importer/batch-${step}.ts` },
        at,
      },
    });
    events.push({
      id: `evt-${agentId}-${events.length}`,
      sessionId,
      agentId,
      event: {
        kind: 'tool_call_end',
        runId,
        toolUseId,
        output: toolOutputOf({ index: step }),
        isError: false,
        at,
      },
    });
    step += 1;
  }
  return events.slice(0, count);
};

const chunksOf = ({ items, size }) => {
  const chunks = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
};

const buildPerfFixture = async ({ out, through }) => {
  const target = isAbsolute(out) ? out : resolve(process.cwd(), out);
  if (existsSync(target)) {
    throw new Error(`the fixture path already exists: ${target}`);
  }
  mkdirSync(dirname(target), { recursive: true });
  const { testDb, migrationsIndex, runner, queries, testing } = await loadDb();
  const db = testDb.makeTestDatabase(target);
  await runner.migrate(
    db,
    migrationsIndex.migrations.filter((migration) => migration.version <= through),
  );

  const workspaces = FIXTURE_SHAPE.workspaces.map((name, index) =>
    testing.aWorkspace({
      id: `workspace-${slugOf({ name })}`,
      name,
      slug: slugOf({ name }),
      createdAt: isoAt({ offsetMs: index * MINUTE }),
      updatedAt: isoAt({ offsetMs: index * MINUTE }),
    }),
  );
  const projects = [];
  for (const workspace of workspaces) {
    for (const name of FIXTURE_SHAPE.projects) {
      const project = testing.aProject({
        id: `project-${workspace.slug}-${name}`,
        workspaceId: workspace.id,
        name,
        rootPath: `/work/${workspace.slug}/${name}`,
      });
      projects.push(project);
    }
  }
  for (const workspace of workspaces) {
    await queries.insertWorkspace({ db, workspace });
  }
  for (const project of projects) {
    await queries.insertProject({ db, project });
  }

  const home = workspaces[0];
  const homeProjects = projects.filter((project) => project.workspaceId === home.id);
  const sessions = Array.from({ length: FIXTURE_SHAPE.sessions }, (_, index) =>
    testing.aSession({
      id: `session-${index + 1}`,
      workspaceId: home.id,
      goal: `Reconcile ${FIXTURE_SHAPE.projects[index % 3]} batch ${index + 1}`,
      state: { kind: 'idle', lastActivityAt: isoAt({ offsetMs: index * MINUTE }) },
      createdAt: isoAt({ offsetMs: index * MINUTE }),
      updatedAt: isoAt({ offsetMs: (index + 1) * MINUTE }),
    }),
  );
  for (const session of sessions) {
    await queries.insertSession(db, session);
  }

  const heavyAgentId = 'agent-1-0';
  for (const [sessionIndex, session] of sessions.entries()) {
    for (let ordinal = 0; ordinal < FIXTURE_SHAPE.agentsPerSession; ordinal += 1) {
      await queries.insertAgent(db, {
        id: `agent-${sessionIndex + 1}-${ordinal}`,
        sessionId: session.id,
        ordinal,
        name: `agent ${ordinal + 1}`,
        status: 'completed',
        outputSummary: summaryOf({ index: ordinal }),
        startedAt: isoAt({ offsetMs: ordinal * MINUTE }),
        completedAt: isoAt({ offsetMs: ordinal * MINUTE + 30_000 }),
      });
    }
  }

  const events = heavyEventsOf({
    agentId: heavyAgentId,
    sessionId: sessions[0].id,
    count: FIXTURE_SHAPE.heavyAgentEvents,
  });
  for (const chunk of chunksOf({ items: events, size: EVENT_CHUNK })) {
    await queries.insertTurnEventsBatch(db, chunk);
  }

  const mounts = [];
  for (let index = 0; index < FIXTURE_SHAPE.worktrees; index += 1) {
    const session = sessions[index % sessions.length];
    const project = homeProjects[index % homeProjects.length];
    const mount = {
      id: `mount-${index + 1}`,
      sessionId: session.id,
      worktreePath: `/work/harborline/worktrees/wt-${index + 1}`,
      branch: `goodboy/${session.id}-${index + 1}`,
      parallelIndex: Math.floor(index / sessions.length),
      projectId: project.id,
      mountName: project.name,
      repoSlug: `harborline/${project.name}`,
      createdAt: BASE_TIME + index * MINUTE,
    };
    await queries.insertSessionWorktree(db, mount);
    mounts.push({ mount, project });
  }

  for (let index = 0; index < FIXTURE_SHAPE.mergedPullRequests; index += 1) {
    const { mount, project } = mounts[index];
    const at = isoAt({ offsetMs: index * MINUTE });
    await queries.upsertMountPullRequestLink({
      db,
      sessionId: mount.sessionId,
      link: {
        id: `link-${index + 1}`,
        mountId: mount.id,
        provider: 'github',
        host: 'github.com',
        repoSlug: `harborline/${project.name}`,
        prNumber: 100 + index,
        headBranch: mount.branch,
        baseBranch: 'main',
        url: `https://github.com/harborline/${project.name}/pull/${100 + index}`,
        state: 'merged',
        snapshot: null,
        mergedHeadSha: `${index + 1}`.padStart(40, 'a'),
        mergedAt: at,
        lastObservedAt: at,
        createdAt: at,
        updatedAt: at,
      },
    });
  }

  await queries.setSetting(db, 'last.workspace_id', home.id);
  await queries.setSetting(db, 'last.session_id', sessions[0].id);
  await queries.setSetting(db, 'launch.reopen_last', '1');

  return { path: target, heavyAgentId };
};

const optionOf = ({ argv, name }) => {
  const index = argv.indexOf(`--${name}`);
  const value = index === -1 ? undefined : argv[index + 1];
  return value === undefined || value.startsWith('--') ? undefined : value;
};

const paramsOf = ({ argv }) => {
  const out = optionOf({ argv, name: 'out' });
  if (out === undefined) {
    throw new Error('usage: node scripts/make-perf-fixture.mjs --out <path> [--through <version>]');
  }
  const through = optionOf({ argv, name: 'through' });
  return { out, through: through === undefined ? Number.POSITIVE_INFINITY : Number(through) };
};

Promise.resolve()
  .then(() => buildPerfFixture(paramsOf({ argv: process.argv.slice(2) })))
  .then(
    ({ path }) => {
      process.stdout.write(`fixture ok: ${path}\n`);
    },
    (error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    },
  );
