import { Activity } from '../components/mocks/Activity';
import { Beat } from './Beat';

export const WhatNeedsYou = () => (
  <Beat
    id="activity"
    leadIn="Questions from agents get lost in long threads"
    heading="See what each job is doing and what needs you"
    body="Every task sits in building, running, needs you or in review, and moves on its own as the work changes. When an agent asks something, the question waits as a card with suggested answers while the others keep going."
    links={[{ label: 'How switching works', anchor: 'switch-between-tasks' }]}
  >
    <Activity />
  </Beat>
);
