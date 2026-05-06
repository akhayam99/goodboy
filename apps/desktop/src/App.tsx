import { useState } from 'react';
import {
  AppShell,
  Button,
  Collapsible,
  Dialog,
  Input,
  KbdPill,
  ScrollArea,
  Textarea,
} from '@kay-am/ui';

export function App() {
  const [collapsed, setCollapsed] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <AppShell
      header={
        <div className="flex w-full items-center justify-between">
          <span className="font-semibold tracking-tight">kAY.am</span>
          <span className="text-xs text-muted-foreground">
            press <KbdPill>⌘K</KbdPill> to focus
          </span>
        </div>
      }
      leftSidebar={
        <ScrollArea className="h-full p-2">
          <div className="text-xs uppercase text-muted-foreground">Workspaces</div>
          <ul className="mt-2 space-y-1">
            <li className="rounded-md px-2 py-1 text-sm hover:bg-muted">demo</li>
            <li className="rounded-md px-2 py-1 text-sm hover:bg-muted">api-gateway</li>
            <li className="rounded-md px-2 py-1 text-sm hover:bg-muted">design-system</li>
          </ul>
        </ScrollArea>
      }
      main={
        <div className="flex h-full flex-col gap-4 p-6">
          <h1 className="text-lg font-medium tracking-tight">design system smoke test</h1>
          <div className="flex flex-wrap gap-2">
            <Button>primary</Button>
            <Button variant="secondary">secondary</Button>
            <Button variant="ghost">ghost</Button>
            <Button variant="danger">danger</Button>
            <Button size="sm">small</Button>
          </div>
          <Input placeholder="type something" />
          <Textarea placeholder="multiline input" />
          <Collapsible
            open={collapsed}
            onOpenChange={setCollapsed}
            trigger={<span>collapsible section</span>}
          >
            <p className="text-sm text-muted-foreground">hidden content revealed when expanded.</p>
          </Collapsible>
          <div>
            <Button onClick={() => setDialogOpen(true)}>open dialog</Button>
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="hello">
              <p className="text-sm text-muted-foreground">
                native html dialog with backdrop and esc-to-close.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  cancel
                </Button>
                <Button onClick={() => setDialogOpen(false)}>ok</Button>
              </div>
            </Dialog>
          </div>
        </div>
      }
      rightSidebar={
        <ScrollArea className="h-full p-2">
          <div className="text-xs uppercase text-muted-foreground">Context</div>
          <p className="mt-2 text-sm text-muted-foreground">slots will live here.</p>
        </ScrollArea>
      }
    />
  );
}
