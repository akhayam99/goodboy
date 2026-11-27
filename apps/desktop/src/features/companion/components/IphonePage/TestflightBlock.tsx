import { useEffect, useState } from 'react';
import { Band, CopyButton } from '@goodboy/ui';
import { bridgeLinkQr } from '../../bridge';

const STEPS = [
  'Scan this code with your iPhone camera.',
  'Install TestFlight if you do not have it yet.',
  'Open Goodboy in TestFlight and install it.',
  'Open Goodboy, then pair it with this Mac.',
] as const;

type Props = {
  readonly link: string;
};

export const TestflightBlock = ({ link }: Props) => {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    if (link === '') {
      return;
    }
    let isCurrent = true;
    bridgeLinkQr({ link })
      .then((next) => {
        if (isCurrent) {
          setSvg(next);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setSvg(null);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [link]);

  if (link === '') {
    return null;
  }
  return (
    <Band
      inset="content"
      label="Get Goodboy for iPhone"
      ariaLabel="Get Goodboy for iPhone"
      headingLevel={2}
    >
      <div className="flex flex-wrap items-start gap-8">
        {svg === null ? null : (
          <div
            data-testflight-qr=""
            className="size-[180px] rounded-lg border border-border-soft bg-white p-3 [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
        <div className="flex min-w-0 max-w-[22rem] flex-1 flex-col gap-3">
          <p className="text-ui text-muted-foreground">
            Decide what needs you from your pocket while this Mac keeps working. The iPhone talks to
            this Mac only.
          </p>
          <ol className="flex list-inside list-decimal flex-col gap-1 text-ui text-foreground">
            {STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="flex items-center gap-3">
            <CopyButton value={link} label="Copy link">
              Copy link
            </CopyButton>
            <span className="min-w-0 truncate font-mono text-meta text-faint-foreground">
              {link}
            </span>
          </div>
        </div>
      </div>
    </Band>
  );
};
