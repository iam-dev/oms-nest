'use client';

import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreVertical, Trash2 } from 'lucide-react';
import type { CustomOrderView } from '@/services/customOrderViews';

interface GroupTabBarProps {
  views: CustomOrderView[];
  activeTab: CustomOrderView | null;
  onSelectTab: (view: CustomOrderView) => void;
  onCreateTab: (name: string) => Promise<CustomOrderView | null>;
  onDeleteTab: (viewId: number) => Promise<void>;
}

export function GroupTabBar({
  views,
  activeTab,
  onSelectTab,
  onCreateTab,
  onDeleteTab,
}: GroupTabBarProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const sortedViews = [...views].sort((a, b) => (a.tabOrder ?? 0) - (b.tabOrder ?? 0));

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const tab = await onCreateTab(newName.trim());
    if (tab) {
      setNewName('');
      setCreateOpen(false);
    }
  };

  if (sortedViews.length === 0) {
    return (
      <div className="flex items-center gap-2 border-b pb-2">
        <span className="text-sm text-muted-foreground">No tabs yet.</span>
        <Button variant="ghost" size="sm" onClick={() => { setNewName(''); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          Add Tab
        </Button>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Tab</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Tab name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newName.trim()}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 border-b">
      <Tabs
        value={activeTab ? String(activeTab.id) : undefined}
        onValueChange={(val) => {
          const view = sortedViews.find((v) => String(v.id) === val);
          if (view) onSelectTab(view);
        }}
        className="flex-1"
      >
        <TabsList className="h-auto bg-transparent p-0 gap-0">
          {sortedViews.map((view) => (
            <div key={view.id} className="flex items-center group">
              <TabsTrigger
                value={String(view.id)}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-4 py-2"
              >
                {view.name}
              </TabsTrigger>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  >
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={() => onDeleteTab(view.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Tab
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          <Button
            size="sm"
            className="shrink-0 ml-1 bg-primary text-white hover:bg-primary/90"
            onClick={() => { setNewName(''); setCreateOpen(true); }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Tab
          </Button>
        </TabsList>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Tab</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Tab name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
