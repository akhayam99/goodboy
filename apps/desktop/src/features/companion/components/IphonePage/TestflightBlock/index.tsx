import { useEffect, useState } from 'react';
import { Band, CopyButton, Notice } from '@goodboy/ui';
import { bridgeLinkQr } from '../../../bridge';
import { NumberedSteps } from '../NumberedSteps';

const STEPS = [
  'Scan this code with your iPhone camera.',
  "Install TestFlight if you don't have it yet.",
  'Open Goodboy in TestFlight and install it.',
  'Open Goodboy, then pair it with this Mac.',
] as const;

const QR_FAILED = "Couldn't make the code. Copy the link instead.";

type Props = {
  readonly link: string;
};

export const TestflightBlock = ({ link }: Props) => {
  const [svg, setSvg] = useState<string | null>(null);
  const [isQrFailed, setIsQrFailed] = useState(false);

  useEffect(() => {
    if (link === '') {
      return;
    }
    let isCurrent = true;
    setIsQrFailed(false);
    bridgeLinkQr({ link })
      .then((next) => {
        if (isCurrent) {
          setSvg(next);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setSvg(null);
          setIsQrFailed(true);
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
      <div className="flex flex-wrap items-start gap-6">
        {svg === null ? null : (
          <div
            data-testflight-qr=""
            className="size-33 shrink-0 rounded-lg border border-border-soft bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
        <div className="flex min-w-0 max-w-[22rem] flex-1 flex-col gap-3">
          <p className="text-meta text-muted-foreground">
            Decide what needs you from your pocket while this Mac keeps working. The iPhone talks to
            this Mac only.
          </p>
          {isQrFailed ? <Notice tone="danger" placement="inline" title={QR_FAILED} /> : null}
          <NumberedSteps steps={STEPS} className="text-ui text-foreground" />
          <div className="flex items-center gap-3">
            <CopyButton value={link} label="Copy link">
              Copy link
            </CopyButton>
            <span className="min-w-0 truncate text-meta text-faint-foreground">{link}</span>
          </div>
        </div>
      </div>
    </Band>
  );
};
