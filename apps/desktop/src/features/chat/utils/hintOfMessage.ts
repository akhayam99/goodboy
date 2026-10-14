import { OPERATOR_NOTES_GUIDANCE } from './operatorNotesGuidance';
import { RESOLVER_KICKOFF_LABELS } from './resolverKickoffLabels';

type Params = {
  readonly message: string;
};

type Found = {
  readonly at: number;
  readonly end: number;
};

const ANCHORS: ReadonlyArray<string> = [
  `${OPERATOR_NOTES_GUIDANCE}\n\n${RESOLVER_KICKOFF_LABELS.operatorNotes}\n`,
  `${OPERATOR_NOTES_GUIDANCE}\n\n## ${RESOLVER_KICKOFF_LABELS.operatorNotes}\n`,
];

export const hintOfMessage = ({ message }: Params): string | null => {
  const found = ANCHORS.flatMap((anchor): ReadonlyArray<Found> => {
    const at = message.indexOf(anchor);
    return at === -1 ? [] : [{ at, end: at + anchor.length }];
  }).sort((a, b) => a.at - b.at)[0];
  if (found === undefined) {
    return null;
  }
  const hint = message.slice(found.end).trim();
  return hint.length === 0 ? null : hint;
};
