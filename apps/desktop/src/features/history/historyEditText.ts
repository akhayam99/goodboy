import type { HistoryEdit } from './historyEdits';
import type { HistoryAction } from './historyRowMarks';

type TitleOf = (sha: string) => string;

type Params = {
  readonly edit: HistoryEdit;
  readonly titleOf: TitleOf;
  readonly targetTitleOf?: TitleOf;
};

export const quoted = ({ text }: { readonly text: string }): string => `“${text}”`;

export const historyEditAction = ({ edit }: { readonly edit: HistoryEdit }): HistoryAction =>
  edit.kind;

export const historyEditText = ({ edit, titleOf, targetTitleOf = titleOf }: Params): string => {
  switch (edit.kind) {
    case 'fixup':
      return `Folded ${quoted({ text: titleOf(edit.sha) })} into ${quoted({ text: targetTitleOf(edit.target) })}, keeping its title`;
    case 'squash':
      return `Combined ${quoted({ text: titleOf(edit.sha) })} with ${quoted({ text: targetTitleOf(edit.target) })}, both messages kept`;
    case 'move': {
      const title = quoted({ text: titleOf(edit.sha) });
      const relation = edit.move.relation;
      if (relation.where === 'bottom') {
        return `Moved ${title} to the bottom`;
      }
      return `Moved ${title} ${relation.where} ${quoted({ text: targetTitleOf(relation.sha) })}`;
    }
    case 'reword':
      return `Renamed ${quoted({ text: titleOf(edit.sha) })} to ${quoted({ text: edit.message.split('\n')[0] ?? edit.message })}`;
    case 'drop':
      return `Removed ${quoted({ text: titleOf(edit.sha) })}`;
    case 'rebase':
      return edit.count === 0
        ? "Started the branch from today's main"
        : `Started the branch from today's main, ${edit.count} new ${edit.count === 1 ? 'commit goes' : 'commits go'} underneath`;
    default: {
      const exhaustive: never = edit;
      return exhaustive;
    }
  }
};

export const commitCount = ({ count }: { readonly count: number }): string =>
  `${count} ${count === 1 ? 'commit' : 'commits'}`;
