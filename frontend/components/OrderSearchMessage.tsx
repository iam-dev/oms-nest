'use client';

import React from 'react';

interface OrderSearchMessageProps {
  searchMessage: string;
  isSearching: boolean;
}

export function OrderSearchMessage({ searchMessage, isSearching }: OrderSearchMessageProps) {
  if (!searchMessage) return null;

  const bgClass = isSearching
    ? 'bg-blue-50 text-blue-700'
    : searchMessage.includes('No orders found')
      ? 'bg-yellow-50 text-yellow-700'
      : searchMessage.includes('Error')
        ? 'bg-red-50 text-red-700'
        : 'bg-green-50 text-green-700';

  return (
    <div className={`p-2 rounded-md ${bgClass}`}>
      <p className="text-sm font-medium flex items-center">
        {isSearching ? (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : null}
        {searchMessage}
      </p>
    </div>
  );
}
