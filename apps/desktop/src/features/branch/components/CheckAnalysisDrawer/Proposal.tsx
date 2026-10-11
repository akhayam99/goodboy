import { Markdown } from '@goodboy/ui';
import { proposalBlocksOf } from '../../checks/proposalBlocksOf';
import { ProposalDiff } from './ProposalDiff';

type Props = {
  readonly text: string;
};

export const Proposal = ({ text }: Props) => {
  return (
    <div className="flex flex-col gap-3">
      {proposalBlocksOf({ text }).map((block, index) =>
        block.kind === 'diff' ? (
          <ProposalDiff key={index} text={block.text} />
        ) : (
          <Markdown key={index} text={block.text} />
        ),
      )}
    </div>
  );
};
