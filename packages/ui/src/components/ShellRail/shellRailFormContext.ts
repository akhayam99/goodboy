import { createContext } from 'react';

export type ShellRailForm = 'wide' | 'narrow';

export const ShellRailFormContext = createContext<ShellRailForm>('wide');
