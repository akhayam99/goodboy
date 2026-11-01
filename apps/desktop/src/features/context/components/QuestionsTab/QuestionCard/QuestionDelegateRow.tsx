import type { QuestionDelegateControls } from '../../../hooks/useQuestionDelegateControls';
import { DelegateAnswerRow } from '../DelegateAnswerRow';

type Props = {
  readonly delegate: QuestionDelegateControls;
  readonly isDisabled: boolean;
};

export const QuestionDelegateRow = ({ delegate, isDisabled }: Props) => (
  <DelegateAnswerRow
    state={delegate.delegateState}
    hints={delegate.delegateHints}
    routing={delegate.delegateRouting}
    connectedProviders={delegate.connectedProviders}
    isDisabled={isDisabled}
    onChoose={delegate.onChooseDelegate}
    onCancel={delegate.onCancelDelegate}
    onHints={delegate.onDelegateHints}
    onRouting={delegate.onDelegateRouting}
  />
);
