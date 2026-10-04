import { Band } from '@goodboy/ui';
import type { ProviderDisplayInfo } from '../../../../providers';
import { CliUpdateNotice } from '../../CliUpdateNotice';
import { CliRow } from './CliRow';

type Props = {
  readonly info: ProviderDisplayInfo;
  readonly autoUpdate: boolean;
};

export const CliGroup = ({ info, autoUpdate }: Props) => (
  <div className="flex flex-col gap-6">
    <Band label="Account" ariaLabel="Account">
      <CliRow info={info} />
    </Band>
    <CliUpdateNotice providerId={info.id} autoStart={autoUpdate} />
  </div>
);
