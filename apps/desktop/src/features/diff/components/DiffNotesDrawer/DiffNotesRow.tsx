import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore, agentPlace } from '../../../../store';
import { NOTE_ACTION_LABEL } from '../../diffNotesCopy';
import { NOTE_FIX_GROUP_LABEL, type NoteFix } from '../../lib/noteFixes';

type Props = {
  readonly sessionId: SessionId;
  readonly fix: NoteFix;
};

const fileName = (path: string): string => path.split('/').at(-1) ?? path;

const placeOf = ({ fix }: { readonly fix: NoteFix }): string => {
  const name = fileName(fix.note.filePath);
  const anchor = fix.note.anchor;
  return anchor === undefined ? name : `${name}:${anchor.lineNumber}`;
};

const firstLine = (body: string): string => body.split('\n')[0] ?? '';

export const DiffNotesRow = ({ sessionId, fix }: Props) => {
  const showDiffNoteLaunch = useAppStore((s) => s.showDiffNoteLaunch);
  const setDiffFocus = useAppStore((s) => s.setDiffFocus);
  const navigate = useAppStore((s) => s.navigate);
  const { agentId } = fix;
  const meta = fix.run ?? (fix.group === 'open' ? NOTE_FIX_GROUP_LABEL.open : null);

  return (
    <li
      data-note-id={fix.note.id}
      className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 hover:bg-hover"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <button
          type="button"
          onClick={() => setDiffFocus(sessionId, { kind: 'branch', path: fix.note.filePath })}
          title={fix.note.filePath}
          className="w-fit max-w-full truncate rounded-sm text-left text-code text-muted-foreground hover:text-foreground"
        >
          {placeOf({ fix })}
        </button>
        <span className="truncate text-label text-foreground">{firstLine(fix.note.body)}</span>
        {meta !== null ? (
          <span className="truncate text-secondary text-faint-foreground">{meta}</span>
        ) : null}
      </div>
      {fix.canFix ? (
        <Button
          size="sm"
          variant="secondary"
          emphasis="outline"
          onClick={() => showDiffNoteLaunch({ sessionId, threadIds: [fix.threadId] })}
        >
          {NOTE_ACTION_LABEL.fix}
        </Button>
      ) : agentId !== null ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate({ to: agentPlace({ sessionId, agentId }) })}
        >
          {NOTE_ACTION_LABEL.openBrief}
        </Button>
      ) : null}
    </li>
  );
};
