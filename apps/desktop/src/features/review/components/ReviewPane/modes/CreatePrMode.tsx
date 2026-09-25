import type { SessionId } from '@goodboy/types';
import { CreatePrPanel } from '../../../../github/components/PullRequest/CreatePrPanel';

type ClosedPr = { readonly number: number; readonly url: string };

type Props = {
  readonly sessionId: SessionId;
  readonly defaultTitle: string;
  readonly closedPr: ClosedPr | null;
  readonly onCreated: () => void;
  readonly onCancel: () => void;
};

export const CreatePrMode = ({ sessionId, defaultTitle, closedPr, onCreated, onCancel }: Props) => (
  <section aria-label="New pull request" className="flex flex-col gap-6">
    <CreatePrPanel
      sessionId={sessionId}
      defaultTitle={defaultTitle}
      {...(closedPr !== null && { closedPr })}
      onCreated={onCreated}
      onCancel={onCancel}
    />
  </section>
);
