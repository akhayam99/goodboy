import type { MountId, SessionId } from '@goodboy/types';
import type { SuggestionMount } from './deriveNextSteps';
import type { SignalScriptRun, SignalScripts, SignalTurnFiles } from './nextStepSignals';
import { nextScriptRulesOf } from './signals/nextScriptRulesOf';
import { scriptCommandOf } from './signals/scriptCommandOf';
import type { NextScriptRule, SessionSuggestion } from './types';

type NextScript = Extract<SessionSuggestion, { readonly kind: 'next-script' }>;

type Params = {
  readonly sessionId: SessionId;
  readonly mounts: ReadonlyArray<SuggestionMount>;
  readonly turnFiles: ReadonlyArray<SignalTurnFiles>;
  readonly scripts: ReadonlyArray<SignalScripts>;
  readonly scriptRuns: ReadonlyArray<SignalScriptRun>;
};

const SCRIPT_NAMES: Readonly<Record<NextScriptRule, ReadonlyArray<string>>> = {
  lockfile: ['install'],
  schema: ['db:generate', 'prisma:generate', 'generate', 'codegen'],
  migrations: ['db:migrate', 'migrate', 'db:migrate:dev', 'migrate:dev'],
};

const REASON: Readonly<Record<NextScriptRule, string>> = {
  lockfile: 'The lockfile changed in the last turn',
  schema: 'The schema changed in the last turn',
  migrations: 'A migration changed in the last turn',
};

const RULE_ORDER: ReadonlyArray<NextScriptRule> = ['lockfile', 'schema', 'migrations'];

type LatestParams = {
  readonly turnFiles: ReadonlyArray<SignalTurnFiles>;
  readonly mountId: MountId;
};

const latestTurnOf = ({ turnFiles, mountId }: LatestParams): SignalTurnFiles | null =>
  turnFiles
    .filter((entry) => entry.mountId === mountId)
    .sort((first, second) => second.recordedAtMs - first.recordedAtMs)[0] ?? null;

export const nextScriptSuggestionsOf = ({
  sessionId,
  mounts,
  turnFiles,
  scripts,
  scriptRuns,
}: Params): ReadonlyArray<NextScript> =>
  mounts.flatMap((mount): ReadonlyArray<NextScript> => {
    const turn = latestTurnOf({ turnFiles, mountId: mount.mountId });
    const entry = scripts.find((candidate) => candidate.mountId === mount.mountId);
    if (turn === null || entry === undefined) {
      return [];
    }
    const hits = nextScriptRulesOf({ paths: turn.paths });
    for (const rule of RULE_ORDER) {
      const hit = hits.find((candidate) => candidate.rule === rule);
      if (hit === undefined) {
        continue;
      }
      const found = entry.groups
        .flatMap((group) => group.scripts.map((script) => ({ group, script })))
        .find(({ script }) => SCRIPT_NAMES[rule].includes(script.name));
      const fallbackManager = entry.groups[0]?.manager ?? null;
      const name =
        found?.script.name ?? (rule === 'lockfile' && fallbackManager !== null ? 'install' : null);
      const command =
        found?.script.command ??
        (rule === 'lockfile' && fallbackManager !== null ? `${fallbackManager} install` : null);
      if (name === null || command === null) {
        continue;
      }
      const isDone = scriptRuns.some(
        (run) =>
          run.mountId === mount.mountId &&
          run.name === name &&
          run.isOk &&
          run.completedAt >= turn.recordedAtMs,
      );
      if (isDone) {
        continue;
      }
      return [
        {
          id: `next-script:${mount.mountId}:${rule}`,
          kind: 'next-script',
          priority: 46,
          band: 2,
          title: rule === 'lockfile' ? 'Install dependencies' : `Run ${name}`,
          detail: `${REASON[rule]} · ${hit.paths[0] ?? ''}`,
          sessionId,
          targetKey: `script:${mount.mountId}`,
          fingerprint: `next-script:${mount.mountId}:${rule}:${turn.recordedAtMs}`,
          payload: {
            mountId: mount.mountId,
            scriptName: name,
            rule,
            command: scriptCommandOf({
              scriptId: `next-script:${name}`,
              name,
              command,
              cwd: mount.worktreePath,
            }),
          },
        },
      ];
    }
    return [];
  });
