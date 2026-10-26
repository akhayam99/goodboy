import type { ILinkProvider } from '@xterm/xterm';
import { fileLinkMatches } from '../../utils/fileLinkMatches';

export type TerminalFileLink = {
  readonly path: string;
  readonly line: number | null;
  readonly column: number | null;
};

type LineAtParams = {
  readonly index: number;
};

type Params = {
  readonly lineAt: (params: LineAtParams) => string | undefined;
  readonly onOpen: (link: TerminalFileLink) => void;
};

type Provide = ILinkProvider['provideLinks'];

class FileLinkProvider implements ILinkProvider {
  private readonly lineAt: Params['lineAt'];
  private readonly onOpen: Params['onOpen'];

  constructor({ lineAt, onOpen }: Params) {
    this.lineAt = lineAt;
    this.onOpen = onOpen;
  }

  provideLinks: Provide = (bufferLineNumber, callback) => {
    const text = this.lineAt({ index: bufferLineNumber - 1 }) ?? '';
    const matches = fileLinkMatches({ text });
    if (matches.length === 0) {
      callback(undefined);
      return;
    }
    callback(
      matches.map((match) => ({
        text: text.slice(match.startIndex, match.endIndex),
        range: {
          start: { x: match.startIndex + 1, y: bufferLineNumber },
          end: { x: match.endIndex, y: bufferLineNumber },
        },
        activate: ({ metaKey: hasMeta, ctrlKey: hasCtrl }: MouseEvent) => {
          if (!hasMeta && !hasCtrl) {
            return;
          }
          this.onOpen({ path: match.path, line: match.line, column: match.column });
        },
      })),
    );
  };
}

export const createFileLinkProvider = ({ lineAt, onOpen }: Params): ILinkProvider =>
  new FileLinkProvider({ lineAt, onOpen });
