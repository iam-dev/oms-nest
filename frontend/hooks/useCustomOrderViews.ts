'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CustomOrderView,
  ColumnConfig,
  ColumnGroupConfig,
  getCustomOrderViews,
  getDefaultCustomOrderView,
  createCustomOrderView,
  updateCustomOrderView,
  deleteCustomOrderView,
} from '@/services/customOrderViews';
import {
  CustomOrderViewGroup,
  getCustomOrderViewGroups,
  createCustomOrderViewGroup,
  updateCustomOrderViewGroup,
  deleteCustomOrderViewGroup,
} from '@/services/customOrderViewGroups';
import {
  CellOverride,
  getCellOverrides,
  upsertCellOverride,
  deleteCellOverrideByOrderAndColumn,
} from '@/services/customOrderCellOverrides';
import { getBatchSaddleSpecs } from '@/services/batchSaddleSpecs';
import { getDefaultColumnConfig, SaddleSpec } from '@/utils/customViewColumns';
import { useToast } from '@/hooks/use-toast';

export function useCustomOrderViews() {
  const { toast } = useToast();
  const [views, setViews] = useState<CustomOrderView[]>([]);
  const [activeView, setActiveView] = useState<CustomOrderView | null>(null);
  const [overrides, setOverrides] = useState<CellOverride[]>([]);
  const [loading, setLoading] = useState(true);

  // Group + Tab state
  const [groups, setGroups] = useState<CustomOrderViewGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<CustomOrderViewGroup | null>(null);
  const [activeTab, setActiveTab] = useState<CustomOrderView | null>(null);

  // Saddle specs state
  const [saddleSpecsMap, setSaddleSpecsMap] = useState<Record<number, SaddleSpec[]>>({});

  // Load all views (standalone, non-grouped)
  const loadViews = useCallback(async () => {
    try {
      const allViews = await getCustomOrderViews();
      setViews(allViews);
      return allViews;
    } catch {
      toast({ title: 'Error', description: 'Failed to load views', variant: 'destructive' });
      return [];
    }
  }, [toast]);

  // Load all groups with nested views
  const loadGroups = useCallback(async () => {
    try {
      const allGroups = await getCustomOrderViewGroups();
      setGroups(allGroups);
      return allGroups;
    } catch {
      toast({ title: 'Error', description: 'Failed to load view groups', variant: 'destructive' });
      return [];
    }
  }, [toast]);

  // Load overrides for given order IDs
  const loadOverrides = useCallback(async (orderIds?: number[]) => {
    try {
      const data = await getCellOverrides(orderIds);
      setOverrides(data);
    } catch {
      // Silently fail — overrides are optional
    }
  }, []);

  // Load saddle specs for given order IDs
  const loadSaddleSpecs = useCallback(async (orderIds: number[]) => {
    if (orderIds.length === 0) {
      setSaddleSpecsMap({});
      return;
    }
    try {
      const specsMap = await getBatchSaddleSpecs(orderIds);
      setSaddleSpecsMap(specsMap);
    } catch {
      // Silently fail — saddle specs enhance the view but aren't required
    }
  }, []);

  // Merge saddle specs into order rows
  const mergeSpecsIntoOrders = useCallback(
    (orders: Record<string, unknown>[]): Record<string, unknown>[] => {
      return orders.map((order) => {
        const orderId = Number(order.id || order.orderId);
        const specs = saddleSpecsMap[orderId];
        if (specs) {
          return { ...order, _saddleSpecs: specs };
        }
        return order;
      });
    },
    [saddleSpecsMap],
  );

  // Initialize: load views, groups, and set active to default
  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      try {
        const [allViews, defaultView, allGroups] = await Promise.all([
          getCustomOrderViews().catch(() => [] as CustomOrderView[]),
          getDefaultCustomOrderView().catch(() => null),
          getCustomOrderViewGroups().catch(() => [] as CustomOrderViewGroup[]),
        ]);
        if (cancelled) return;
        setViews(allViews);
        setGroups(allGroups);

        // If there are groups, select first group and first tab
        if (allGroups.length > 0) {
          const firstGroup = allGroups[0];
          setActiveGroup(firstGroup);
          if (firstGroup.views.length > 0) {
            const firstTab = firstGroup.views[0];
            setActiveTab(firstTab);
            setActiveView(firstTab);
          }
        } else if (defaultView) {
          setActiveView(defaultView);
        } else if (allViews.length > 0) {
          setActiveView(allViews[0]);
        }
      } catch {
        // Will show empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  // Sync activeView when activeTab changes
  useEffect(() => {
    if (activeTab) {
      setActiveView(activeTab);
    }
  }, [activeTab]);

  // Get visible columns sorted by order
  const visibleColumns: ColumnConfig[] = activeView
    ? [...activeView.columns].filter((c) => c.visible).sort((a, b) => a.order - b.order)
    : [];

  // ── Group Operations ──

  const handleCreateGroup = useCallback(async (name: string) => {
    try {
      const newGroup = await createCustomOrderViewGroup({ name });
      const groupWithViews: CustomOrderViewGroup = { ...newGroup, views: newGroup.views || [] };
      setGroups((prev) => [...prev, groupWithViews]);
      setActiveGroup(groupWithViews);
      setActiveTab(null);
      toast({ title: 'Group created', description: `"${name}" has been created` });
      return groupWithViews;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create group';
      toast({ title: 'Error', description: message, variant: 'destructive' });
      return null;
    }
  }, [toast]);

  const handleRenameGroup = useCallback(async (name: string) => {
    if (!activeGroup) return;
    try {
      await updateCustomOrderViewGroup(activeGroup.id, { name });
      setGroups((prev) =>
        prev.map((g) => (g.id === activeGroup.id ? { ...g, name } : g)),
      );
      setActiveGroup((prev) => (prev ? { ...prev, name } : prev));
      toast({ title: 'Group renamed' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to rename group';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  }, [activeGroup, toast]);

  const handleDeleteGroup = useCallback(async (id: number) => {
    try {
      await deleteCustomOrderViewGroup(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
      if (activeGroup?.id === id) {
        setActiveGroup(null);
        setActiveTab(null);
        setActiveView(null);
      }
      toast({ title: 'Group deleted' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete group';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  }, [activeGroup, toast]);

  // ── Tab Operations (views within a group) ──

  const handleCreateTab = useCallback(async (groupId: number, name: string) => {
    try {
      const group = groups.find((g) => g.id === groupId);
      const tabOrder = group ? group.views.length : 0;
      const columns = getDefaultColumnConfig();
      const newView = await createCustomOrderView({ name, columns, groupId, tabOrder });
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId ? { ...g, views: [...g.views, newView] } : g,
        ),
      );
      if (activeGroup?.id === groupId) {
        setActiveGroup((prev) =>
          prev ? { ...prev, views: [...prev.views, newView] } : prev,
        );
      }
      setActiveTab(newView);
      toast({ title: 'Tab created', description: `"${name}" has been added` });
      return newView;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create tab';
      toast({ title: 'Error', description: message, variant: 'destructive' });
      return null;
    }
  }, [groups, activeGroup, toast]);

  const handleDeleteTab = useCallback(async (viewId: number) => {
    try {
      await deleteCustomOrderView(viewId);
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          views: g.views.filter((v) => v.id !== viewId),
        })),
      );
      if (activeGroup) {
        setActiveGroup((prev) =>
          prev ? { ...prev, views: prev.views.filter((v) => v.id !== viewId) } : prev,
        );
      }
      if (activeTab?.id === viewId) {
        const groupViews = activeGroup?.views.filter((v) => v.id !== viewId) || [];
        setActiveTab(groupViews.length > 0 ? groupViews[0] : null);
      }
      setViews((prev) => prev.filter((v) => v.id !== viewId));
      toast({ title: 'Tab deleted' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete tab';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  }, [activeGroup, activeTab, toast]);

  const handleReorderTabs = useCallback(async (viewId: number, newTabOrder: number) => {
    try {
      await updateCustomOrderView(viewId, { tabOrder: newTabOrder });
      // Refresh groups to get updated order
      await loadGroups();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reorder tabs';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  }, [loadGroups, toast]);

  // ── Standalone View Operations (backward compatible) ──

  const handleCreateView = useCallback(async (name: string, isDefault?: boolean) => {
    try {
      const columns = getDefaultColumnConfig();
      const newView = await createCustomOrderView({ name, columns, isDefault });
      setViews((prev) => [...prev, newView]);
      setActiveView(newView);
      toast({ title: 'View created', description: `"${name}" has been created` });
      return newView;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create view';
      toast({ title: 'Error', description: message, variant: 'destructive' });
      return null;
    }
  }, [toast]);

  const handleUpdateColumns = useCallback(async (columns: ColumnConfig[]) => {
    if (!activeView) return;
    try {
      const updated = await updateCustomOrderView(activeView.id, { columns });
      setActiveView(updated);
      setViews((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      // Also update in groups if part of a group
      if (updated.groupId) {
        setGroups((prev) =>
          prev.map((g) => ({
            ...g,
            views: g.views.map((v) => (v.id === updated.id ? updated : v)),
          })),
        );
        if (activeGroup && activeTab?.id === updated.id) {
          setActiveTab(updated);
          setActiveGroup((prev) =>
            prev ? { ...prev, views: prev.views.map((v) => (v.id === updated.id ? updated : v)) } : prev,
          );
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update columns';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  }, [activeView, activeGroup, activeTab, toast]);

  const handleUpdateColumnGroups = useCallback(async (columnGroups: ColumnGroupConfig[], columns?: ColumnConfig[]) => {
    if (!activeView) return;
    try {
      const payload: { columnGroups: ColumnGroupConfig[]; columns?: ColumnConfig[] } = { columnGroups };
      if (columns) payload.columns = columns;
      const updated = await updateCustomOrderView(activeView.id, payload);
      setActiveView(updated);
      setViews((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      if (updated.groupId) {
        setGroups((prev) =>
          prev.map((g) => ({
            ...g,
            views: g.views.map((v) => (v.id === updated.id ? updated : v)),
          })),
        );
        if (activeGroup && activeTab?.id === updated.id) {
          setActiveTab(updated);
          setActiveGroup((prev) =>
            prev ? { ...prev, views: prev.views.map((v) => (v.id === updated.id ? updated : v)) } : prev,
          );
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update column groups';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  }, [activeView, activeGroup, activeTab, toast]);

  const handleRenameView = useCallback(async (name: string) => {
    if (!activeView) return;
    try {
      const updated = await updateCustomOrderView(activeView.id, { name });
      setActiveView(updated);
      setViews((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      if (updated.groupId) {
        setGroups((prev) =>
          prev.map((g) => ({
            ...g,
            views: g.views.map((v) => (v.id === updated.id ? updated : v)),
          })),
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to rename view';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  }, [activeView, toast]);

  const handleDeleteView = useCallback(async (id: number) => {
    try {
      await deleteCustomOrderView(id);
      setViews((prev) => prev.filter((v) => v.id !== id));
      if (activeView?.id === id) {
        setActiveView(null);
      }
      toast({ title: 'View deleted' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete view';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  }, [activeView, toast]);

  // ── Override Operations ──

  const handleSetOverride = useCallback(async (orderId: number, columnKey: string, value: string) => {
    try {
      const result = await upsertCellOverride({ orderId, columnKey, overrideValue: value });
      setOverrides((prev) => {
        const idx = prev.findIndex((o) => o.orderId === orderId && o.columnKey === columnKey);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = result;
          return next;
        }
        return [...prev, result];
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to set override';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  }, [toast]);

  const handleRemoveOverride = useCallback(async (orderId: number, columnKey: string) => {
    try {
      await deleteCellOverrideByOrderAndColumn(orderId, columnKey);
      setOverrides((prev) => prev.filter((o) => !(o.orderId === orderId && o.columnKey === columnKey)));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to remove override';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  }, [toast]);

  const getOverrideValue = useCallback((orderId: number, columnKey: string): string | undefined => {
    const match = overrides.find((o) => o.orderId === orderId && o.columnKey === columnKey);
    return match?.overrideValue;
  }, [overrides]);

  return {
    // Standalone views (backward compatible)
    views,
    activeView,
    setActiveView,
    visibleColumns,
    overrides,
    loading,
    loadViews,
    loadOverrides,
    handleCreateView,
    handleUpdateColumns,
    handleUpdateColumnGroups,
    handleRenameView,
    handleDeleteView,
    handleSetOverride,
    handleRemoveOverride,
    getOverrideValue,
    // Groups & Tabs
    groups,
    activeGroup,
    setActiveGroup,
    activeTab,
    setActiveTab,
    loadGroups,
    handleCreateGroup,
    handleRenameGroup,
    handleDeleteGroup,
    handleCreateTab,
    handleDeleteTab,
    handleReorderTabs,
    // Saddle specs
    saddleSpecsMap,
    loadSaddleSpecs,
    mergeSpecsIntoOrders,
  };
}
