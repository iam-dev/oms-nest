"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { User, UserRole } from '@/types/Role';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { getRoleDisplayName } from '@/utils/rolePermissions';
import { logger } from '@/utils/logger';

interface UserEditModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedUser: Partial<User>) => Promise<void>;
}

export function UserEditModal({ user, isOpen, onClose, onSave }: UserEditModalProps) {
  const [editedUser, setEditedUser] = useState<Partial<User>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Set initial user data
  useEffect(() => {
    if (user) {
      // Edit mode - populate with existing data
      setEditedUser({
        ...user,
        username: user.username || '',
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        role: user.role || UserRole.USER,
      });
    } else {
      // Create mode - set default values
      setEditedUser({
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        role: UserRole.USER,
        password: '',
      });
    }
    setError('');
  }, [user, isOpen]);

  // Handle form field changes
  const handleChange = (field: string, value: string) => {
    setEditedUser(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle role change
  const handleRoleChange = (value: string) => {
    setEditedUser(prev => ({
      ...prev,
      role: value as UserRole
    }));
  };

  // Handle save
  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      // Basic validation
      if (!editedUser.username?.trim()) {
        setError('Username is required');
        return;
      }

      if (!user && !editedUser.password?.trim()) {
        setError('Password is required for new users');
        return;
      }

      // Call the save handler
      await onSave(editedUser);

      // Close modal on success
      onClose();
    } catch (error) {
      logger.error('Error saving user:', error);
      setError(error instanceof Error ? error.message : 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setEditedUser({});
    setError('');
    onClose();
  };

  // Get available role options
  const roleOptions = [
    { value: UserRole.USER, label: getRoleDisplayName(UserRole.USER) },
    { value: UserRole.FITTER, label: getRoleDisplayName(UserRole.FITTER) },
    { value: UserRole.SUPPLIER, label: getRoleDisplayName(UserRole.SUPPLIER) },
    { value: UserRole.ADMIN, label: getRoleDisplayName(UserRole.ADMIN) },
    { value: UserRole.SUPERVISOR, label: getRoleDisplayName(UserRole.SUPERVISOR) },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {user ? 'Edit User' : 'Create User'}
          </DialogTitle>
          <DialogDescription>
            {user
              ? `Edit details for user ${user.username}`
              : 'Create a new user account'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Username *
            </label>
            <Input
              id="username"
              type="text"
              value={editedUser.username || ''}
              onChange={(e) => handleChange('username', e.target.value)}
              placeholder="Enter username"
              disabled={saving}
              className="mt-1"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={editedUser.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="Enter email"
              disabled={saving}
              className="mt-1"
            />
          </div>

          {/* First Name */}
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
              First Name
            </label>
            <Input
              id="firstName"
              type="text"
              value={editedUser.firstName || ''}
              onChange={(e) => handleChange('firstName', e.target.value)}
              placeholder="Enter first name"
              disabled={saving}
              className="mt-1"
            />
          </div>

          {/* Last Name */}
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
              Last Name
            </label>
            <Input
              id="lastName"
              type="text"
              value={editedUser.lastName || ''}
              onChange={(e) => handleChange('lastName', e.target.value)}
              placeholder="Enter last name"
              disabled={saving}
              className="mt-1"
            />
          </div>

          {/* Role */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700">
              Role *
            </label>
            <Select
              value={editedUser.role || UserRole.USER}
              onValueChange={handleRoleChange}
              disabled={saving}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              {user ? 'New Password' : 'Password'}{!user && ' *'}
            </label>
            <Input
              id="password"
              type="password"
              value={editedUser.password || ''}
              onChange={(e) => handleChange('password', e.target.value)}
              placeholder={user ? 'Leave blank to keep current password' : 'Enter password'}
              disabled={saving}
              className="mt-1"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-md">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#7b2326] hover:bg-[#8b2329] text-white"
          >
            {saving ? 'Saving...' : (user ? 'Update User' : 'Create User')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}