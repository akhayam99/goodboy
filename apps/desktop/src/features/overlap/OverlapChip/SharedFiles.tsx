import { useState } from 'react';
import { Button, ScrollFade } from '@goodboy/ui';
import { actionIntentOf } from '../../actions/actionIntentOf';
import { SharedPathList } from './SharedPathList';

type Props = {
  readonly paths: ReadonlyArray<string>;
  readonly label: string;
};

const SHOWN = 3;
const SHOW_MORE = 'show more';

export const SharedFiles = ({ paths, label }: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const more = paths.length - SHOWN;
  return (
    <section aria-label={label} className="flex min-w-0 flex-col gap-1">
      <h3 className="text-eyebrow text-muted-foreground">{label}</h3>
      {isExpanded ? (
        <ScrollFade className="max-h-40 min-h-0" viewportClassName="min-h-0" fadeFrom="floating">
          <SharedPathList paths={paths} />
        </ScrollFade>
      ) : (
        <SharedPathList paths={paths.slice(0, SHOWN)} />
      )}
      {isExpanded || more <= 0 ? null : (
        <div className="flex">
          <Button
            variant="quiet"
            size="xs"
            intent={actionIntentOf({ verb: SHOW_MORE })}
            onClick={() => setIsExpanded(true)}
          >
            {`Show ${more} more`}
          </Button>
        </div>
      )}
    </section>
  );
};
