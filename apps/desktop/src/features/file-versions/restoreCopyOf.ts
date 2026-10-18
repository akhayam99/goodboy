import type { RestoreOutcome, RestoreTarget } from './useChangesRestore';

type Params = Readonly<{ outcome: RestoreOutcome }>;

type ListParams = Readonly<{ paths: ReadonlyArray<string> }>;

type TargetParams = Readonly<{ target: RestoreTarget }>;

type AskParams = TargetParams & Readonly<{ changedSince: ReadonlyArray<string> }>;

export type RestoreCopy = Readonly<{
  title: string;
  body: string;
  confirm: string;
}>;

const NAMED_PATHS = 3;

const listOf = ({ paths }: ListParams): string => {
  if (paths.length <= 1) {
    return paths[0] ?? 'A file';
  }
  if (paths.length > NAMED_PATHS) {
    return `${paths.slice(0, NAMED_PATHS - 1).join(', ')} and ${paths.length - NAMED_PATHS + 1} more files`;
  }
  return `${paths.slice(0, -1).join(', ')} and ${paths.at(-1) ?? ''}`;
};

const askOf = ({ target, changedSince }: AskParams): RestoreCopy => {
  if (target.scope === 'turn') {
    return {
      title: `${listOf({ paths: changedSince })} changed after turn ${target.turnNumber}.`,
      body: 'Your current text is saved as a version before the turn goes back.',
      confirm: 'Restore anyway',
    };
  }
  if (target.scope === 'undo') {
    return {
      title: `${listOf({ paths: changedSince })} changed after the restore.`,
      body: 'Your current text is saved as a version before the undo.',
      confirm: 'Undo anyway',
    };
  }
  if (target.isNewFile) {
    return {
      title: `${target.subject} changed after this turn.`,
      body: 'Removing it saves its current text as a version first.',
      confirm: 'Remove anyway',
    };
  }
  return {
    title: `${target.subject} changed after this turn.`,
    body: 'Your current text is saved as a version before it goes back.',
    confirm: 'Restore anyway',
  };
};

const doneOf = ({ target }: TargetParams): RestoreCopy => {
  if (target.scope === 'turn') {
    return {
      title: `Restored turn ${target.turnNumber}.`,
      body: 'What its files had a moment ago is saved as a version too.',
      confirm: '',
    };
  }
  if (target.isNewFile) {
    return {
      title: `Removed ${target.subject}.`,
      body: 'It is saved as a version, so Undo restore puts it back.',
      confirm: '',
    };
  }
  return {
    title: `Restored ${target.subject} to before turn ${target.turnNumber}.`,
    body: 'The text it had a moment ago is saved as a version too.',
    confirm: '',
  };
};

const nothingOf = ({ target }: TargetParams): RestoreCopy => ({
  title: 'Nothing to restore.',
  body:
    target.scope === 'turn'
      ? `Every file of turn ${target.turnNumber} already matches how it was before it.`
      : `${target.subject} already matches how it was before turn ${target.turnNumber}.`,
  confirm: '',
});

const failedOf = ({ target }: TargetParams): RestoreCopy => {
  if (target.scope === 'turn') {
    return {
      title: `Couldn't restore turn ${target.turnNumber}`,
      body: 'Files restored before the error read Restored in the list.',
      confirm: '',
    };
  }
  if (target.scope === 'undo') {
    return {
      title: `Couldn't undo the restore of ${target.subject}`,
      body: 'The file is as it was.',
      confirm: '',
    };
  }
  return {
    title: `Couldn't ${target.isNewFile ? 'remove' : 'restore'} ${target.subject}`,
    body: 'The file is as it was.',
    confirm: '',
  };
};

export const restoreCopyOf = ({ outcome }: Params): RestoreCopy => {
  switch (outcome.kind) {
    case 'ask':
      return askOf({ target: outcome.target, changedSince: outcome.changedSince });
    case 'done':
      return doneOf({ target: outcome.target });
    case 'nothing':
      return nothingOf({ target: outcome.target });
    case 'failed':
      return failedOf({ target: outcome.target });
    default: {
      const unreachable: never = outcome;
      return unreachable;
    }
  }
};
