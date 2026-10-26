import { Fragment } from 'react';
import { fileLinkMatches } from '../../../../../shared/utils/fileLinkMatches';

export type LogFileLink = {
  readonly path: string;
  readonly line: number | null;
  readonly column: number | null;
};

type Props = {
  readonly text: string;
  readonly onOpenFile: ((link: LogFileLink) => void) | null;
};

type Part = {
  readonly key: number;
  readonly text: string;
  readonly link: LogFileLink | null;
};

export const LinkedLogText = ({ text, onOpenFile }: Props) => {
  const matches = onOpenFile === null ? [] : fileLinkMatches({ text });
  if (onOpenFile === null || matches.length === 0) {
    return <>{text}</>;
  }
  const parts: Part[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.startIndex > cursor) {
      parts.push({ key: cursor, text: text.slice(cursor, match.startIndex), link: null });
    }
    parts.push({
      key: match.startIndex,
      text: text.slice(match.startIndex, match.endIndex),
      link: { path: match.path, line: match.line, column: match.column },
    });
    cursor = match.endIndex;
  }
  if (cursor < text.length) {
    parts.push({ key: cursor, text: text.slice(cursor), link: null });
  }
  return (
    <>
      {parts.map(({ key, text: partText, link }) =>
        link === null ? (
          <Fragment key={key}>{partText}</Fragment>
        ) : (
          <span
            key={key}
            role="link"
            tabIndex={0}
            className="cursor-pointer underline decoration-dotted underline-offset-2 hover:text-primary"
            aria-label={`Open ${partText}`}
            onClick={() => onOpenFile(link)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onOpenFile(link);
              }
            }}
          >
            {partText}
          </span>
        ),
      )}
    </>
  );
};
