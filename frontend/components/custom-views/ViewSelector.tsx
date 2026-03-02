'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Pencil } from 'lucide-react';
import type { CustomOrderView } from '@/services/customOrderViews';

interface ViewSelectorProps {
  views: CustomOrderView[];
  activeView: CustomOrderView | null;
  onSelect: (view: CustomOrderView) => void;
  onCreate: (name: string) => void;
  onRename: (name: string) => void;
  onDelete: (id: number) => void;
}

export function ViewSelector({
  views,
  activeView,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: ViewSelectorProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [name, setName] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate(name.trim());
    setName('');
    setIsCreateOpen(false);
  };

  const handleRename = () => {
    if (!name.trim()) return;
    onRename(name.trim());
    setName('');
    setIsRenameOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={activeView?.id?.toString() || ''}
        onValueChange={(val) => {
          const view = views.find((v) => v.id.toString() === val);
          if (view) onSelect(view);
        }}
      >
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Select a view..." />
        </SelectTrigger>
        <SelectContent>
          {views.map((view) => (
            <SelectItem key={view.id} value={view.id.toString()}>
              {view.name} {view.isDefault ? '(default)' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />
        New
      </Button>

      {activeView && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setName(activeView.name);
              setIsRenameOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(activeView.id)}
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New View</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="View name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename View</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="View name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
