// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'gen']);
const LINEAR_LOOKUP = /\b(?:sessions|projects)\??\.find\(/g;
const ID_PREDICATE = /^\s*\(?\s*(\w+)\s*\)?\s*=>\s*\1\.id\s*===/;

const ALLOWED: Readonly<Record<string, number>> = {
  'app/components/MockScene/scenes/brand/brandChrome.ts': 2,
  'features/impact/components/ImpactStudio/index.tsx': 1,
  'features/integrations/bitbucket/useWorkspaceBitbucketRepo/index.ts': 1,
  'features/integrations/gitlab/MergeRequest/useGitlabIssues.ts': 1,
  'features/integrations/jira/JiraStudio/useJiraIssues.ts': 1,
  'features/integrations/linear/LinearStudio/useLinearIssues.ts': 1,
  'features/onboarding/OnboardingWizard/WizardFrame.tsx': 1,
  'features/search/grammar.ts': 1,
  'features/settings/components/SettingsStudio/WorkspaceDevProjectBand.tsx': 1,
  'features/workspace/components/WorkspaceLinkStudio/index.tsx': 1,
  'store/slices/sessions/deleteTask.ts': 1,
  'store/slices/turn/resolveSkillPrompt.ts': 1,
  'store/slices/turn/turnHelpers.ts': 1,
  'store/slices/worktrees/reconcileOrphanWorktrees.ts': 1,
};

const walk = (directory: string): ReadonlyArray<string> => {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory).flatMap((entry) => {
    if (SKIPPED_DIRECTORIES.has(entry)) {
      return [];
    }
    const full = join(directory, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
};

const toPath = (full: string): string => relative(DESKTOP_SRC, full).split(sep).join('/');

const isProductSource = (path: string): boolean =>
  /\.tsx?$/.test(path) &&
  !path.endsWith('.d.ts') &&
  !/\.test\.tsx?$/.test(path) &&
  !path.startsWith('__tests__/') &&
  !path.startsWith('test/') &&
  !path.endsWith('/storyHarness.ts') &&
  !path.endsWith('/mock-data.ts');

const productSources = (): ReadonlyArray<string> =>
  walk(DESKTOP_SRC).map(toPath).filter(isProductSource);

const countLookups = (text: string): number => (text.match(LINEAR_LOOKUP) ?? []).length;

const idLookupsIn = (text: string): number =>
  [...text.matchAll(LINEAR_LOOKUP)].filter((match) =>
    ID_PREDICATE.test(
      text.slice(match.index + match[0].length, match.index + match[0].length + 80),
    ),
  ).length;

const measure = (): Readonly<Record<string, number>> =>
  Object.fromEntries(
    productSources()
      .map((path) => [path, countLookups(readFileSync(join(DESKTOP_SRC, path), 'utf8'))] as const)
      .filter(([, count]) => count > 0),
  );

describe('lookups by id go through the index', () => {
  it('scans the store and the features, never an empty sweep', () => {
    const sources = productSources();

    expect(sources.some((path) => path.startsWith('store/slices/'))).toBe(true);
    expect(sources.some((path) => path.startsWith('features/'))).toBe(true);
    expect(sources).toContain('store/slices/sessions/sessionIndex.ts');
  });

  it('recognises a linear lookup on sessions or projects, and nothing else', () => {
    expect(countLookups('const s = state.sessions.find((x) => x.id === id);')).toBe(1);
    expect(countLookups('const p = get().projects.find((x) => x.id === id);')).toBe(1);
    expect(countLookups('const s = sessions.find(\n (x) => x.id === id,\n);')).toBe(1);
    expect(countLookups('const s = sessionById(state.sessions, id);')).toBe(0);
    expect(countLookups('const s = state.sessions?.find((x) => x.id === id);')).toBe(1);
    expect(countLookups('const p = state.projects?.find((x) => x.id === id);')).toBe(1);
    expect(countLookups('const s = archivedSessions.find((x) => x.id === id);')).toBe(0);
    expect(countLookups('const p = subprojects.find((x) => x.id === id);')).toBe(0);
  });

  it('adds no linear lookup on sessions or projects beyond the allowlist', () => {
    const grown = Object.entries(measure()).flatMap(([path, count]) => {
      const allowed = ALLOWED[path] ?? 0;
      return count > allowed ? [`  - ${path}: ${count} (allowed ${allowed})`] : [];
    });

    expect(
      grown,
      `read a session or a project by id with sessionById, projectById, selectSessionById or ` +
        `selectProjectById (docs/file-system.md, Store slices). A lookup by another field may ` +
        `stay, but the allowlist only shrinks:\n${grown.join('\n')}`,
    ).toEqual([]);
  });

  it('recognises a lookup by id, however the callback is spelled', () => {
    expect(idLookupsIn('state.sessions.find((s) => s.id === id)')).toBe(1);
    expect(idLookupsIn('state.sessions?.find((candidate) => candidate.id === id)')).toBe(1);
    expect(idLookupsIn('projects.find(\n  (p) => p.id === id,\n)')).toBe(1);
    expect(idLookupsIn('projects.find((p) => p.name === name)')).toBe(0);
    expect(idLookupsIn('sessions.find((s) => sessionMatchesIssue(s, issue))')).toBe(0);
  });

  it('keeps every lookup by id on the index, even in an allowlisted file', () => {
    const offenders = productSources().filter(
      (path) => idLookupsIn(readFileSync(join(DESKTOP_SRC, path), 'utf8')) > 0,
    );

    expect(offenders).toEqual([]);
  });

  it('drops an allowlist entry once its lookup is gone', () => {
    const current = measure();
    const stale = Object.entries(ALLOWED).flatMap(([path, allowed]) => {
      const count = current[path] ?? 0;
      return count < allowed ? [`  - ${path}: ${count} (allowed ${allowed})`] : [];
    });

    expect(stale, `lower or delete these entries:\n${stale.join('\n')}`).toEqual([]);
  });
});
