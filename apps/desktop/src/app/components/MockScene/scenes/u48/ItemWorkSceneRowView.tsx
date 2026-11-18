import { Button } from '@goodboy/ui';
import { actionButtonLookOf } from '../../../../../features/actions/actionButtonLookOf';
import { ItemWorkLine } from '../../../../../features/live-state/itemWork/ItemWorkLine';
import { agentStepPhraseOf } from '../../../../../features/live-state/itemWork/agentStepPhraseOf';
import { ITEM_WORK_WORDS } from '../../../../../features/live-state/itemWork/itemWorkWords';
import type { ItemWorkSceneRow } from './itemWorkSceneRows';

type Props = {
  readonly row: ItemWorkSceneRow;
};

const STOP_LOOK = actionButtonLookOf({ verb: ITEM_WORK_WORDS.verb.stop, variant: 'quiet' });

export const ItemWorkSceneRowView = ({ row }: Props) => {
  const detail =
    row.transcript === null ? row.detail : agentStepPhraseOf({ transcript: row.transcript });
  const action =
    row.action === null ? null : (
      <Button size="xs" variant="secondary" isBusy={row.state === 'starting'}>
        {row.action}
      </Button>
    );
  const verbs = row.hasVerbs ? (
    <>
      <Button size="xs" variant={STOP_LOOK.variant} intent={STOP_LOOK.intent}>
        {ITEM_WORK_WORDS.verb.stop}
      </Button>
      <Button size="xs" variant="quiet">
        {ITEM_WORK_WORDS.verb.openTranscript}
      </Button>
    </>
  ) : null;
  return (
    <li
      data-scene-row={row.id}
      className="group/row flex min-w-0 flex-col gap-1 rounded-lg px-3 py-2 hover:bg-hover"
    >
      <span className="truncate text-ui text-foreground">{row.title}</span>
      <ItemWorkLine
        state={row.state}
        detail={detail}
        agentId={row.agentId}
        isAgentWaiting={row.isAgentWaiting}
        verbs={verbs}
        action={action}
      />
    </li>
  );
};
