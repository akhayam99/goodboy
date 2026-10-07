import type { ProviderId } from '@goodboy/types';
import { Notice } from '@goodboy/ui';
import { useAutoDetour } from '../../../hooks/useAutoDetour';
import { useProviderLimitsChip } from '../../../hooks/useProviderLimitsChip';
import { usageNotice } from '../../../limits/usageNotice';

type Props = {
  readonly providerId: ProviderId;
};

export const ProviderAttentionNotice = ({ providerId }: Props) => {
  const { chip, nowMs } = useProviderLimitsChip({ providerId });
  const detour = useAutoDetour({ providerId });
  const notice = usageNotice({ chip, nowMs, detour });
  if (notice === null || (notice.tone !== 'warning' && notice.tone !== 'danger')) {
    return null;
  }
  return (
    <Notice
      tone={notice.tone}
      placement="inline"
      title={notice.title}
      {...(notice.body !== null && { body: notice.body })}
    />
  );
};
