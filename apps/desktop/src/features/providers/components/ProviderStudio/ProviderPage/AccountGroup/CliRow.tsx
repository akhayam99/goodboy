import { BAND_ROW_CLASS, cn } from '@goodboy/ui';
import type { ProviderDisplayInfo } from '../../../../providers';
import { CLI_LABEL } from '../../../../cliLabel';

export const CliRow = ({ info }: { readonly info: ProviderDisplayInfo }) => (
  <div className={cn(BAND_ROW_CLASS, 'gap-3 text-label')}>
    <span className="w-28 shrink-0 text-muted-foreground">{CLI_LABEL[info.id]}</span>
    <span className="min-w-0 flex-1 truncate tabular-nums text-foreground">
      {info.version ?? info.binary}
    </span>
  </div>
);
