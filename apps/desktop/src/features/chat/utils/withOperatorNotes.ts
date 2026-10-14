import { OPERATOR_NOTES_GUIDANCE } from './operatorNotesGuidance';
import { RESOLVER_KICKOFF_LABELS } from './resolverKickoffLabels';

type Params = {
  readonly text: string;
  readonly hint: string;
};

export const withOperatorNotes = ({ text, hint }: Params): string => {
  const note = hint.trim();
  if (note.length === 0) {
    return text;
  }
  return `${text}\n\n${OPERATOR_NOTES_GUIDANCE}\n\n## ${RESOLVER_KICKOFF_LABELS.operatorNotes}\n${note}`;
};
