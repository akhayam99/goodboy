import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button, Disclosure } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { openUrl } from '../../../../shared/lib/editor';
import { givenOf } from '../../checks/givenOf';
import { DrawerBox } from './DrawerBox';
import { Fact } from './Fact';

type Props = {
  readonly text: string;
};

export const GivenBox = ({ text }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const given = givenOf({ text });
  const isEmpty = given.pullRequest === null && given.head === null && given.checks.length === 0;
  return (
    <DrawerBox label="What it was given">
      {isEmpty ? (
        <p className="text-body text-muted-foreground">{text}</p>
      ) : (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2">
          {given.pullRequest === null ? null : (
            <Fact label="Pull request">{given.pullRequest}</Fact>
          )}
          {given.head === null ? null : (
            <Fact label="Head">
              <code className="text-code">{given.head.slice(0, 7)}</code>
            </Fact>
          )}
          {given.checks.flatMap((check, index) => [
            <Fact key={`${index}-name`} label="Check">
              {check.name}
            </Fact>,
            ...(check.conclusion === null
              ? []
              : [
                  <Fact key={`${index}-conclusion`} label="Conclusion">
                    {check.conclusion}
                  </Fact>,
                ]),
            ...(check.url === null
              ? []
              : [
                  <Fact key={`${index}-url`} label="Check run">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Open check run for ${check.name}`}
                      onClick={() => void openUrl(check.url ?? '')}
                    >
                      Open check run
                      <ExternalLink size={ICON_SIZE.row} aria-hidden />
                    </Button>
                  </Fact>,
                ]),
          ])}
        </dl>
      )}
      {given.paths.length === 0 ? null : (
        <Disclosure
          label={
            <span className="text-row text-foreground">
              {given.paths.length === 1 ? '1 file' : `${given.paths.length} files`}
            </span>
          }
          isOpen={isOpen}
          onToggle={() => setIsOpen((wasOpen) => !wasOpen)}
        >
          <ul aria-label="Paths" className="flex flex-col gap-1 py-1">
            {given.paths.map((path) => (
              <li key={path} className="min-w-0 break-all text-code text-muted-foreground">
                {path}
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </DrawerBox>
  );
};
