"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { EntityTable } from '@/components/shared/EntityTable';
import { useTableFilters, usePagination } from '@/hooks';
import { getUserTableColumnsFiltered } from '@/utils/userTableColumns';
import { PageHeader } from '@/components/shared/PageHeader';
import { User } from '@/types/Role';
import { fetchUsers, deleteUser, createUser, updateUser } from '@/services/users';
import { useUserRole } from '@/hooks/useUserRole';
import { hasScreenPermission } from '@/utils/rolePermissions';
import { UserDetailModal } from '@/components/shared/UserDetailModal';
import { UserEditModal } from '@/components/shared/UserEditModal';
import { logger } from '@/utils/logger';

export default function Users() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  const { role } = useUserRole();
  
  // Use our hooks for filters and pagination
  const { filters, updateFilter } = useTableFilters<Record<string, string>>({});
  const { pagination, setTotalItems } = usePagination(30, 1);
  
  // Use efficient server-side pagination with real-time data management
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [totalUsers, setTotalUsers] = React.useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [hasNext, setHasNext] = React.useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [hasPrevious, setHasPrevious] = React.useState(false);

  // Custom refetch function using efficient backend API
  const refetch = React.useCallback(async (forceFresh = true) => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchUsers({
        page: pagination.currentPage,
        limit: pagination.itemsPerPage,
        orderBy: 'username',
        order: 'asc',
        searchTerm: searchTerm,
        filters: filters,
        forceRefresh: forceFresh
      });

      setUsers(result['hydra:member'] || []);
      setTotalUsers(result['hydra:totalItems'] || 0);
      setHasNext(result.hasNext || false);
      setHasPrevious(result.hasPrevious || false);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
      setUsers([]);
      setTotalUsers(0);
    } finally {
      setLoading(false);
    }
  }, [pagination.currentPage, pagination.itemsPerPage, searchTerm, filters]);


  // Optimistic update functions
  // Optimistic update functions for server-side pagination
  const updateEntityOptimistically = React.useCallback((updatedUser: Partial<User> & { id: string }) => {
    setUsers(currentUsers =>
      currentUsers.map(user =>
        user.id === updatedUser.id ? { ...user, ...updatedUser } : user
      )
    );
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const addEntityOptimistically = React.useCallback((newUser: User) => {
    // For new users, increment total count and refetch to get updated data
    setTotalUsers(prev => prev + 1);
    refetch(true);
  }, [refetch]);

  const removeEntityOptimistically = React.useCallback((userId: string) => {
    setUsers(currentUsers => currentUsers.filter(user => user.id !== userId));
    setTotalUsers(prev => prev - 1);
  }, []);

  // Initial data fetch - trigger refetch when dependencies change
  React.useEffect(() => {
    // TODO(react-hooks): refetch() is async — setState calls happen after the awaited fetch, not synchronously in the effect body.
    refetch(); // eslint-disable-line react-hooks/set-state-in-effect -- async; setState runs after await
  }, [refetch]);

  // Debounced search and filter effect
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Reset to first page when search/filters change
      if (pagination.currentPage !== 1) {
        pagination.onPageChange(1);
      } else {
        // If already on page 1, just refetch
        refetch();
      }
    }, 300); // 300ms debounce for search

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filters]);

  // Update pagination total when data changes
  useEffect(() => {
    setTotalItems(totalUsers);
  }, [totalUsers, setTotalItems]);
  
  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    updateFilter(key, value);
  };
  
  // Handle view user details
  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setShowDetailModal(true);
  };

  // Handle edit user
  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  // Handle delete user
  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setIsDeleteOpen(true);
  };
  
  // Confirm delete user
  const confirmDeleteUser = async () => {
    if (!selectedUser) return;

    // Apply optimistic removal immediately
    removeEntityOptimistically(String(selectedUser.id));

    try {
      await deleteUser(String(selectedUser.id));
      setIsDeleteOpen(false);
      setSelectedUser(null);

      // Show success message
      logger.log(`User "${selectedUser.username}" deleted successfully`);

    } catch (error) {
      logger.error('Failed to delete user:', error);

      // Revert optimistic removal on error by refetching
      refetch(true);

      // Show error notification
      logger.error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // Handle create new user
  const handleCreateUser = () => {
    setSelectedUser(null);
    setShowCreateModal(true);
  };

  // Handle save user (for edit modal)
  const handleSaveUser = async (updatedUser: Partial<User>) => {
    if (!selectedUser) return;

    // Apply optimistic update immediately
    const optimisticData = {
      ...selectedUser,
      ...updatedUser,
      id: String(selectedUser.id)
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateEntityOptimistically(optimisticData as any);

    try {
      const result = await updateUser(String(selectedUser.id), updatedUser);

      // Update with actual response data if available
      if (result && result.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updateEntityOptimistically(result as any);
      }

      // Close modal on success
      setShowEditModal(false);
      setSelectedUser(null);

      // Show success toast
      logger.log(`User "${updatedUser.username || selectedUser.username}" updated successfully`);

    } catch (error) {
      logger.error('Error updating user:', error);

      // Show error toast
      logger.error(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Revert optimistic update on error by refetching
      refetch(true);

      throw error; // Re-throw to show error in modal
    }
  };

  // Handle create user (for create modal)
  const handleCreateUserSave = async (newUser: Partial<User>) => {
    try {
      const result = await createUser({
        username: newUser.username!,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role!,
        password: String(newUser.password ?? ''),
      });

      // Add to list optimistically if we have a result
      if (result && result.id) {
        addEntityOptimistically(result);
      }

      // Close modal on success
      setShowCreateModal(false);
      setSelectedUser(null);

      // Show success toast
      logger.log(`User "${newUser.username}" created successfully`);

    } catch (error) {
      logger.error('Error creating user:', error);

      // Revert any optimistic changes by refetching
      refetch(true);

      // Show error toast
      logger.error(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);

      throw error; // Re-throw to show error in modal
    }
  };

  // Handle close modals
  const handleCloseModals = () => {
    setShowDetailModal(false);
    setShowEditModal(false);
    setShowCreateModal(false);
    setSelectedUser(null);
  };

  // Handle edit from detail modal
  const handleEditFromDetail = () => {
    setShowDetailModal(false);
    setShowEditModal(true);
  };

  // Check permissions
  const canEdit = hasScreenPermission(role, 'USER_EDIT');
  const canDelete = hasScreenPermission(role, 'USER_DELETE');
  const canCreate = hasScreenPermission(role, 'USER_CREATE');

  // Get table columns with filters (EntityTable handles actions separately)
  const columns = getUserTableColumnsFiltered(filters, updateFilter);

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Users"
        description={`Manage and track all users${totalUsers > 0 ? ` (${totalUsers} users)` : ''}`}
        actions={
          canCreate ? (
            <Button onClick={handleCreateUser} className="bg-[#7b2326] hover:bg-[#8b2329] text-white">
              <Plus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          ) : undefined
        }
      />

      <EntityTable
          entities={users}
          columns={columns}
          loading={loading}
          error={error}
          searchTerm={searchTerm}
          onSearch={setSearchTerm}
          headerFilters={filters}
          onFilterChange={handleFilterChange}
          pagination={pagination}
          entityType="user"
          onView={handleViewUser}
          onEdit={canEdit ? handleEditUser : undefined}
          onDelete={canDelete ? handleDeleteUser : undefined}
          searchPlaceholder="Search by username, email, first name, or last name..."
        />

      {/* User Detail Modal */}
      <UserDetailModal
        user={selectedUser}
        isOpen={showDetailModal}
        onClose={handleCloseModals}
        onEdit={canEdit ? handleEditFromDetail : undefined}
      />

      {/* User Edit Modal */}
      <UserEditModal
        user={selectedUser}
        isOpen={showEditModal}
        onClose={handleCloseModals}
        onSave={handleSaveUser}
      />

      {/* User Create Modal */}
      <UserEditModal
        user={null}
        isOpen={showCreateModal}
        onClose={handleCloseModals}
        onSave={handleCreateUserSave}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Delete User</h3>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete user &quot;{selectedUser.username}&quot;? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDeleteOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteUser}
              >
                Delete User
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}