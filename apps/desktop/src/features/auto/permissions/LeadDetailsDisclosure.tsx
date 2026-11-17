import { useState } from 'react';
import { Disclosure } from '@goodboy/ui';
import type { LeadDetailsDataModel } from './LeadDetailsData';
import { LeadPermissionsPanel } from './LeadPermissionsPanel';
import { LEAD_LEVEL_COPY } from './leadLevelCopy';

type Props = {
  readonly model: LeadDetailsDataModel;
};

export const LeadDetailsDisclosure = ({ model }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const { permissions } = model;
  return (
    <Disclosure
      testId="lead-details-disclosure"
      label={<span className="text-row text-foreground">{LEAD_LEVEL_COPY.fineTuneDefault}</span>}
      isOpen={isOpen}
      onToggle={() => setIsOpen((was) => !was)}
      actions={
        <span className="shrink-0 text-meta text-faint-foreground">
          {LEAD_LEVEL_COPY.fineTuneDefaultHint}
        </span>
      }
    >
      <div className="flex min-w-0 flex-col pt-3 pb-2">
        {permissions === null ? (
          <p
            role={model.readError === null ? 'status' : 'alert'}
            className="text-meta text-muted-foreground"
          >
            {model.readError ?? 'Reading the details.'}
          </p>
        ) : (
          <LeadPermissionsPanel
            permissions={permissions}
            rowErrors={model.rowErrors}
            isDisabled={model.isBusy}
            onChange={({ key, value }) => void model.change({ key, value })}
          />
        )}
      </div>
    </Disclosure>
  );
};
