import type { ComponentType } from 'react';
import { P11ChatScene } from './P11ChatScene';

export const U36_P11_CHAT_SCENES: Readonly<Record<string, ComponentType>> = {
  'auto-chat-done-real': () => <P11ChatScene theme="dark" state="done" />,
  'u36-p11-done-dark': () => <P11ChatScene theme="dark" state="done" />,
  'u36-p11-done-light': () => <P11ChatScene theme="light" state="done" />,
  'u36-p11-failed-dark': () => <P11ChatScene theme="dark" state="failed" />,
  'u36-p11-failed-light': () => <P11ChatScene theme="light" state="failed" />,
  'u36-p11-working-dark': () => <P11ChatScene theme="dark" state="working" />,
  'u36-p11-working-light': () => <P11ChatScene theme="light" state="working" />,
};
