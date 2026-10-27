import { useContext, type ReactNode } from 'react';
import { CodeBlockActionsContext } from './codeBlockActions';

type Props = {
  readonly content: string;
  readonly lang: string | null;
  readonly isClosed: boolean;
  readonly children: ReactNode;
};

export const CodeBlockFrame = ({ content, lang, isClosed, children }: Props) => {
  const Actions = useContext(CodeBlockActionsContext);
  if (Actions === null || !isClosed) {
    return children;
  }
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div data-slot="code-block-actions" className="flex items-center justify-end gap-1">
        <Actions content={content} lang={lang} />
      </div>
      {children}
    </div>
  );
};
