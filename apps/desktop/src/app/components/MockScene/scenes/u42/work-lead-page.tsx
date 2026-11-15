import type { ComponentType } from 'react';
import { AutoChatScene } from '../u24/AutoChatScene';

export const U42_WORK_LEAD_PAGE_SCENES: Readonly<Record<string, ComponentType>> = {
  'work-lead-plan': () => <AutoChatScene state="plan" hasLeadPage />,
  'work-lead-working': () => <AutoChatScene state="working" hasLeadPage />,
};
