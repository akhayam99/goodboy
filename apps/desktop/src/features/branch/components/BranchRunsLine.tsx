import type { Session } from '@goodboy/types';
import { useBranchArtifactLink } from '../../artifacts/hooks/useBranchArtifactLink';
import { useBranchQuestionLink } from '../../session/hooks/useBranchQuestionLink';
import { useBranchRunLink } from '../../session/hooks/useBranchRunLink';
import { openBranchRuns } from '../../session/openBranchRuns';
import { openBranchWork } from '../../session/openBranchWork';
import { useBranchIdentity } from '../hooks/useBranchIdentity';
import { BranchWorkLinkButton } from './BranchWorkLinkButton';

type Props = {
  readonly session: Session;
};

export const BranchRunsLine = ({ session }: Props) => {
  const { mount, mountPath } = useBranchIdentity({ sessionId: session.id });
  const mountId = mount?.mountId ?? null;
  const runs = useBranchRunLink({ session, mountId });
  const questions = useBranchQuestionLink({ session, mountId });
  const artifacts = useBranchArtifactLink({ sessionId: session.id, mountId });
  if (runs === null && questions === null && artifacts === null) {
    return null;
  }
  const sessionId = session.id;
  return (
    <p data-branch-runs-line="" className="flex min-w-0 items-center gap-2 text-ui">
      <span className="text-muted-foreground">On this branch</span>
      <BranchWorkLinkButton
        link={runs}
        onOpen={({ link }) => openBranchRuns({ sessionId, groupKey: link.groupKey, mountPath })}
      />
      <BranchWorkLinkButton
        link={questions}
        onOpen={({ link }) =>
          openBranchWork({ sessionId, lens: 'questions', groupKey: link.groupKey, mountPath })
        }
      />
      <BranchWorkLinkButton
        link={artifacts}
        onOpen={({ link }) =>
          openBranchWork({ sessionId, lens: 'plans', groupKey: link.groupKey, mountPath })
        }
      />
    </p>
  );
};
