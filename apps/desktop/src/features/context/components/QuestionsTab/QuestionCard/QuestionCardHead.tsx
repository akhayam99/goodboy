import type { AgentKind } from '../../../../session/agent-kind';
import type { QuestionParts } from '../questionParts';
import { QuestionCardControls } from './QuestionCardControls';
import { QuestionCardText } from './QuestionCardText';
import { QuestionCardTop } from './QuestionCardTop';
import type { QuestionPagerModel } from './QuestionPager';

type Props = {
  readonly parts: QuestionParts;
  readonly isCompact: boolean;
  readonly isBlocking: boolean;
  readonly askerName: string | null;
  readonly askerKind: AgentKind | null;
  readonly age: string;
  readonly pager: QuestionPagerModel | null;
  readonly onDismiss: (() => void) | null;
};

export const QuestionCardHead = ({
  parts,
  isCompact,
  isBlocking,
  askerName,
  askerKind,
  age,
  pager,
  onDismiss,
}: Props) => (
  <>
    {isCompact ? null : (
      <QuestionCardTop
        askerName={askerName}
        askerKind={askerKind}
        age={age}
        pager={pager}
        onDismiss={onDismiss}
      />
    )}
    <QuestionCardText
      parts={parts}
      isCompact={isCompact}
      isBlocking={isBlocking}
      trailing={
        isCompact && (pager !== null || onDismiss !== null) ? (
          <QuestionCardControls pager={pager} onDismiss={onDismiss} />
        ) : null
      }
    />
  </>
);
