import type { ComponentType } from 'react';
import { SendToLeadScene } from './SendToLeadScene';

export const U50_SEND_TO_LEAD_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-send-to-lead-one-dark': () => <SendToLeadScene theme="dark" state="one" />,
  'u50-send-to-lead-one-light': () => <SendToLeadScene theme="light" state="one" />,
  'u50-send-to-lead-pick-dark': () => <SendToLeadScene theme="dark" state="pick" />,
  'u50-send-to-lead-pick-light': () => <SendToLeadScene theme="light" state="pick" />,
  'u50-send-to-lead-none-dark': () => <SendToLeadScene theme="dark" state="none" />,
  'u50-send-to-lead-none-light': () => <SendToLeadScene theme="light" state="none" />,
  'u50-send-to-lead-sent-dark': () => <SendToLeadScene theme="dark" state="sent" />,
  'u50-send-to-lead-sent-light': () => <SendToLeadScene theme="light" state="sent" />,
  'u50-send-to-lead-stopped-dark': () => <SendToLeadScene theme="dark" state="stopped" />,
  'u50-send-to-lead-stopped-light': () => <SendToLeadScene theme="light" state="stopped" />,
};
