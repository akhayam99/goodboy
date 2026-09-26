import { BAND_ROW_CLASS, Button, cn } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { SentryLinkSuggestion } from './suggestLinks';

type Props = {
  readonly suggestion: SentryLinkSuggestion;
  readonly isBusy: boolean;
  readonly onLink: () => void;
};

export const SuggestionRow = ({ suggestion, isBusy, onLink }: Props) => (
  <li className={cn(BAND_ROW_CLASS, 'gap-3 text-label')}>
    <CONCEPT_ICONS.suggestion
      size={ICON_SIZE.row}
      aria-hidden
      className="shrink-0 text-muted-foreground"
    />
    <span className="min-w-0 flex-1 truncate text-foreground">
      {`${suggestion.sentryProject} → ${suggestion.projectName}`}
      <span className="text-muted-foreground">{` · mapped to ${suggestion.repoName} in Sentry`}</span>
    </span>
    <Button variant="secondary" size="sm" disabled={isBusy} onClick={onLink}>
      Link
    </Button>
  </li>
);
