import { Chapter } from '../components/Chapter';
import { Developers } from './Developers';
import { Leads } from './Leads';

export const Teams = () => (
  <Chapter id="teams" label="For teams">
    <Developers />
    <Leads />
  </Chapter>
);
