'use client';

import React, { useState } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { CustomOrderViewGroup } from '@/services/customOrderViewGroups';

interface ViewGroupManagerProps {
  groups: CustomOrderViewGroup[];
  activeGroup: CustomOrderViewGroup | null;
  onSelectGroup: (group: CustomOrderViewGroup | null) => void;
  onCreateGroup: (name: string) => Promise<CustomOrderViewGroup | null>;
  onRenameGroup: (name: string) => Promise<void>;
  onDeleteGroup: (id: number) => Promise<void>;
}

export function ViewGroupManager({
  groups,
  activeGroup,
  onSelectGroup,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
}: ViewGroupManagerProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const group = await onCreateGroup(newName.trim());
    if (group) {
      setNewName('');
      setCreateOpen(false);
    }
  };

  const handleRename = async () => {
    if (!newName.trim()) return;
    await onRenameGroup(newName.trim());
    setNewName('');
    setRenameOpen(false);
  };

  const handleDelete = async () => {
    if (!activeGroup) return;
    await onDeleteGroup(activeGroup.id);
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={activeGroup ? String(activeGroup.id) : 'none'}
        onValueChange={(val) => {
          if (val === 'none') {
            onSelectGroup(null);
          } else {
            const group = groups.find((g) => g.id === Number(val));
            if (group) onSelectGroup(group);
          }
        }}
      >
        <SelectTrigger className="w-[200px] h-9">
          <SelectValue placeholder="Select group..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No Group</SelectItem>
          {groups.map((g) => (
            <SelectItem key={g.id} value={String(g.id)}>
              {g.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" onClick={() => { setNewName(''); setCreateOpen(true); }}>
        <Plus className="h-4 w-4 mr-1" />
        New Group
      </Button>

      {activeGroup && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setNewName(activeGroup.name); setRenameOpen(true); }}>
              <Pencil className="h-4 w-4 mr-2" />
              Rename Group
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Group
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Create Group Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Group name..."
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

      {/* Rename Group Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Group</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="New name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleRename} disabled={!newName.trim()}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
