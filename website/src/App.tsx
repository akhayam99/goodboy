import { Analytics } from '@vercel/analytics/react';
import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { Providers } from './sections/Providers';
import { Sessions } from './sections/Sessions';
import { Switch } from './sections/Switch';
import { Find } from './sections/Find';
import { Workspace } from './sections/Workspace';
import { Developers } from './sections/Developers';
import { Leads } from './sections/Leads';
import { Workflows } from './sections/Workflows';
import { Inbox } from './sections/Inbox';
import { Review } from './sections/Review';
import { Artifacts } from './sections/Artifacts';
import { Context } from './sections/Context';
import { Routing } from './sections/Routing';
import { Storage } from './sections/Storage';
import { Chat } from './sections/Chat';
import { Features } from './sections/Features';
import { Tools } from './sections/Tools';
import { Faq } from './sections/Faq';
import { Install } from './sections/Install';
import { Support } from './sections/Support';
import { Closer } from './sections/Closer';
import { Footer } from './sections/Footer';

export const App = () => (
  <>
    <Nav />
    <main id="main">
      <Hero />
      <Providers />
      <Sessions />
      <Switch />
      <Find />
      <Workspace />
      <Developers />
      <Leads />
      <Workflows />
      <Inbox />
      <Review />
      <Artifacts />
      <Context />
      <Routing />
      <Storage />
      <Chat />
      <Features />
      <Tools />
      <Faq />
      <Install />
      <Support />
      <Closer />
    </main>
    <Footer />
    <Analytics />
  </>
);
