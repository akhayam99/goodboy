import type { ComponentType } from 'react';
import type { AutoTreeView } from '../../../../../store/slices/auto-view/state';
import { workLeadDependencyView } from '../../../../../features/auto/testing/workLeadDependencyView';
import { workLeadPushView } from '../../../../../features/auto/testing/workLeadPushView';
import { withHeldAsks } from '../../../../../features/auto/testing/withHeldAsks';
import { AutoChatScene } from '../u24/AutoChatScene';

type ViewParams = {
  readonly view: AutoTreeView;
};

const pushViewOf = ({ view }: ViewParams): AutoTreeView =>
  withHeldAsks({ view, held: workLeadPushView() });

const dependencyViewOf = ({ view }: ViewParams): AutoTreeView =>
  withHeldAsks({ view, held: workLeadDependencyView() });

export const U42_WORK_LEAD_PAGE_SCENES: Readonly<Record<string, ComponentType>> = {
  'work-lead-plan': () => <AutoChatScene state="plan" hasLeadPage />,
  'work-lead-working': () => <AutoChatScene state="leadWorking" hasLeadPage />,
  'work-lead-push': () => (
    <AutoChatScene state="working" hasLeadPage viewOf={pushViewOf} leadRows={{ push: 'ask' }} />
  ),
  'work-lead-dependency': () => (
    <AutoChatScene
      state="working"
      hasLeadPage
      viewOf={dependencyViewOf}
      leadRows={{ dependencies: 'ask' }}
    />
  ),
};
