import { createContext, type ComponentType } from 'react';

export type CodeBlockActionsProps = {
  readonly content: string;
  readonly lang: string | null;
};

export type CodeBlockActions = ComponentType<CodeBlockActionsProps>;

export const CodeBlockActionsContext = createContext<CodeBlockActions | null>(null);
