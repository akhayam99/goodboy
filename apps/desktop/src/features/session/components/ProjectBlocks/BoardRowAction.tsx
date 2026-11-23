import { CircleAlert } from '@goodboy/ui/icons';
import { ICON_SIZE, TruncatedText } from '@goodboy/ui';
import { MoveVerb } from '../MoveCard/MoveVerb';
import { useBoardContext } from './useBoardContext';

type Props = {
  readonly rowId: string;
  readonly index?: number;
  readonly text?: string;
};

export const BoardRowAction = ({ rowId, index = 0, text }: Props) => {
  const { cardsByRowId, actionsFor, openFor, rowById } = useBoardContext();
  const card = cardsByRowId.get(rowId)?.[index];
  const row = rowById.get(rowId);
  if (row === undefined || row.isSettled) {
    return null;
  }
  if (card === undefined) {
    const count = index === 0 ? row.askIds.length : 0;
    const fallback = count === 1 ? '1 open question' : `${count} open questions`;
    const shown = text ?? (count === 0 ? '' : fallback);
    return shown === '' ? null : (
      <span className="min-w-0 flex-1 truncate text-foreground">{shown}</span>
    );
  }
  const shownTitle = text ?? card.title;
  const { main, failure } = actionsFor({ card });
  return (
    <>
      {shownTitle === '' ? (
        <span aria-hidden className="min-w-0 flex-1" />
      ) : (
        <TruncatedText className="min-w-0 flex-1 text-foreground">{shownTitle}</TruncatedText>
      )}
      {main === null ? null : (
        <MoveVerb
          verb={main}
          cardId={card.id}
          cardTitle={card.title}
          variant="secondary"
          isMain={false}
          onOpen={openFor({ card })}
        />
      )}
      {failure === null ? null : (
        <span role="alert" className="flex min-w-0 shrink items-center gap-1 text-foreground">
          <CircleAlert size={ICON_SIZE.control} aria-hidden className="shrink-0 text-danger" />
          <TruncatedText className="min-w-0">{failure}</TruncatedText>
        </span>
      )}
    </>
  );
};
