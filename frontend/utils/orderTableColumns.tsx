import React from 'react';
import { TableHeaderFilter } from '../components/shared/TableHeaderFilter';
import { orderStatuses } from './orderConstants';
import { StatusBadge } from '../components/shared/StatusBadge';

export type HeaderFilters = Record<string, string>;
export type SetHeaderFilters = (key: string, value: string) => void;

export function getOrderTableColumns(
  headerFilters: HeaderFilters,
  setHeaderFilters: SetHeaderFilters,
  factories: Array<{label: string, value: string}> = [],
  dynamicSeatSizes: string[] = []
) {
  return [
    {
      key: 'id',
      title: (
        <TableHeaderFilter
          title="ID"
          value={headerFilters.id || ''}
          onFilter={value => setHeaderFilters('id', value)}
          type="text"
          entityType="order"
        />
      ),
      render: (_: any, row: any) => row?.id || '-',
    },
    {
      key: 'icons',
      title: '',
      render: (_: unknown, row?: Record<string, unknown>) => {
        if (!row) return null;
        const badges: React.ReactNode[] = [];
        if (row.sponsored) {
          badges.push(
            <span key="s" style={{ display: 'inline-block', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: '10px', lineHeight: '16px', width: '16px', textAlign: 'center', borderRadius: '3px', marginRight: '2px' }}>S</span>
          );
        }
        if (row.demo) {
          badges.push(
            <span key="d" style={{ display: 'inline-block', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: '10px', lineHeight: '16px', width: '16px', textAlign: 'center', borderRadius: '3px', marginRight: '2px' }}>D</span>
          );
        }
        if (row.repair || row.legacyRepair) {
          badges.push(
            <span key="r" style={{ display: 'inline-block', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: '10px', lineHeight: '16px', width: '16px', textAlign: 'center', borderRadius: '3px', marginRight: '2px' }} title="Repair">R</span>
          );
        }
        if (row.fitterStock || row.fitter_stock) {
          badges.push(
            <span key="st" style={{ display: 'inline-block', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: '10px', lineHeight: '16px', minWidth: '16px', textAlign: 'center', borderRadius: '3px', marginRight: '2px', padding: '0 2px' }} title="Stock">ST</span>
          );
        }
        const urgentValue = row.urgency ?? row.isUrgent ?? row.urgent;
        if (urgentValue === 1 || urgentValue === true || urgentValue === 'true' || urgentValue === 'Yes') {
          badges.push(
            <span key="u" style={{ display: 'inline-block', color: '#d97706', fontSize: '14px', lineHeight: '16px', marginRight: '2px' }} title="Urgent">{'\u26A1'}</span>
          );
        }
        if (badges.length === 0) return null;
        return <span style={{ display: 'flex', alignItems: 'center', gap: '1px', whiteSpace: 'nowrap' }}>{badges}</span>;
      },
    },
    {
      key: 'saddleSpecifications',
      title: (
        <TableHeaderFilter
          title="SADDLE"
          value={headerFilters.saddle || ''}
          onFilter={value => setHeaderFilters('saddle', value)}
          type="text"
          entityType="order"
        />
      ),
      render: (_: any, row: any) => {
        if (!row) return '-';
        // For enriched orders, use brand_name and model_name directly
        const brandName = row.brandName || row.brand_name;
        const modelName = row.modelName || row.model_name;
        if (brandName || modelName) {
          const parts = [];
          if (brandName) parts.push(brandName);
          if (modelName) parts.push(modelName);
          return parts.join(' - ') || '-';
        }
        // Fallback to saddleSpecifications
        if (row.saddleSpecifications) {
          const specs = row.saddleSpecifications;
          const parts = [];
          if (specs.brand) parts.push(specs.brand);
          if (specs.model) parts.push(specs.model);
          if (specs.leatherType) parts.push(specs.leatherType);
          if (specs.color) parts.push(specs.color);
          return parts.join(' ') || '-';
        }
        return row.reference || row.saddle || '-';
      },
    },
    {
      key: 'seatSize',
      title: (
        <TableHeaderFilter
          title="SEAT SIZE"
          value={headerFilters.seatSize || ''}
          onFilter={value => setHeaderFilters('seatSize', value)}
          type="enum"
          data={Array.from(new Set([...['15', '15.5', '16', '16.5', '17', '17.5', '18', '18.5', '19'], ...dynamicSeatSizes]))
            .sort((a, b) => parseFloat(a) - parseFloat(b))
            .map(size => ({ label: size, value: size }))
          }
          entityType="order"
        />
      ),
      render: (_: any, row: any) => {
        if (!row) return '-';
        let seatSizes: string[] = [];

        // Helper to normalize European comma to dot notation
        const normalize = (s: string) => String(s).replace(',', '.');

        // Helper to extract seat sizes from text (special_notes or comments)
        const extractFromText = (text: string): string[] => {
          if (!text) return [];
          const sizes: string[] = [];
          // Match patterns like "seat size 17.5", "size 18", "17,5 seat", etc.
          const patterns = [
            /seat\s*size[:\s]*(\d{1,2}[.,]?\d?)/gi,
            /size[:\s]*(\d{1,2}[.,]?\d?)/gi,
            /(\d{1,2}[.,]5?)\s*(?:seat|inch|")/gi,
          ];
          for (const pattern of patterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
              const size = match[1];
              const numericSize = parseFloat(size.replace(',', '.'));
              // Only include valid seat sizes (14-20 range)
              if (numericSize >= 14 && numericSize <= 20) {
                sizes.push(normalize(size));
              }
            }
          }
          return sizes;
        };

        // First check seat_sizes from backend (snake_case JSONB array)
        if (Array.isArray(row.seat_sizes) && row.seat_sizes.length > 0) {
          seatSizes = row.seat_sizes.map((s: any) => normalize(String(s)));
        }
        // Check saddleSpecifications.seatSize
        else if (row.saddleSpecifications?.seatSize) {
          if (Array.isArray(row.saddleSpecifications.seatSize)) {
            seatSizes = row.saddleSpecifications.seatSize.map((s: any) => normalize(String(s)));
          } else {
            seatSizes = [normalize(String(row.saddleSpecifications.seatSize))];
          }
        }
        // Fallback to seatSizes (camelCase)
        else if (Array.isArray(row.seatSizes) && row.seatSizes.length > 0) {
          seatSizes = row.seatSizes.map((s: any) => normalize(String(s)));
        } else if (row.seatSize) {
          if (Array.isArray(row.seatSize)) {
            seatSizes = row.seatSize.map((s: any) => normalize(String(s)));
          } else {
            seatSizes = [normalize(String(row.seatSize))];
          }
        }
        // Extract from special_notes or comments field
        else if (row.special_notes || row.comments) {
          seatSizes = extractFromText(row.special_notes || row.comments);
        }
        // Fallback to reference field
        else if (row.reference) {
          const match = row.reference.match(/(\d{2}(?:[.,]5)?)/g);
          if (match && match.length > 0) seatSizes = match.map(normalize);
        }

        seatSizes = Array.from(new Set(seatSizes));
        return seatSizes.length > 0 ? seatSizes.join(', ') : '-';
      },
    },
    {
      key: 'customer',
      title: (
        <TableHeaderFilter
          title="CUSTOMER"
          value={headerFilters.customer || ''}
          onFilter={value => setHeaderFilters('customer', value)}
          type="text"
          entityType="order"
        />
      ),
      render: (_: any, row: any) => {
        if (!row) return '-';
        // For enriched orders, use the direct customerName field first (camelCase or snake_case)
        const customerName = row.customerName || row.customer_name;
        if (customerName && typeof customerName === 'string' && customerName.trim()) {
          return customerName;
        }
        // Fallback to customer object or computed field
        if (row.customer) {
          if (typeof row.customer === 'object') {
            if (row.customer.name) return row.customer.name;
            if (row.customer['@id'] && row.name) return row.name;
            return JSON.stringify(row.customer);
          }
          return String(row.customer);
        }
        if (row.name) return row.name;
        return '-';
      },
    },
    {
      key: 'date',
      title: 'DATE',
      render: (_: any, row: any) => {
        // Backend sends created_at (snake_case) or createdAt (camelCase)
        const dateStr = row?.created_at || row?.createdAt || row?.orderTime || row?.date || '';
        if (!dateStr) return '-';
        try {
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return dateStr;
          return date.toISOString().split('T')[0];
        } catch {
          return dateStr;
        }
      },
    },
    {
      key: 'status',
      title: (
        <TableHeaderFilter
          title="STATUS"
          value={headerFilters.status || ''}
          onFilter={value => setHeaderFilters('status', value)}
          type="enum"
          data={orderStatuses.map(status => ({ label: status, value: status }))}
          entityType="order"
        />
      ),
      render: (_: any, row: any) => row?.status || row?.orderStatus || '-',
    },
    {
      key: 'urgent',
      title: (
        <TableHeaderFilter
          title="URGENT"
          value={headerFilters.urgent || ''}
          onFilter={value => setHeaderFilters('urgent', value)}
          type="urgent"
          entityType="order"
        />
      ),
      render: (val: any, row: any) => {
        // Backend uses urgency (0/1) or isUrgent (boolean)
        const urgentValue = row?.urgency ?? row?.isUrgent ?? val ?? row?.urgent;
        if (urgentValue === null || urgentValue === undefined || urgentValue === '') return 'No';
        if (urgentValue === 1 || urgentValue === true || urgentValue === 'true' || urgentValue === 'Yes') return 'Yes';
        if (urgentValue === 0 || urgentValue === false || urgentValue === 'false' || urgentValue === 'No') return 'No';
        return typeof urgentValue === 'boolean' ? (urgentValue ? 'Yes' : 'No') : String(urgentValue);
      },
    },
    {
      key: 'fitter',
      title: (
        <TableHeaderFilter
          title="FITTER"
          value={headerFilters.fitter || ''}
          onFilter={value => setHeaderFilters('fitter', value)}
          type="text"
          entityType="order"
        />
      ),
      render: (_: any, row: any) => {
        if (!row) return '-';
        // For enriched orders, use the direct fitterName field first (camelCase or snake_case)
        const fitterName = row.fitterName || row.fitter_name;
        if (fitterName && typeof fitterName === 'string' && fitterName.trim()) {
          return fitterName;
        }
        // Fallback to fitter object or computed field
        if (row.fitter) {
          if (typeof row.fitter === 'object') {
            if (row.fitter.name) return row.fitter.name;
            return JSON.stringify(row.fitter);
          }
          return String(row.fitter);
        }
        if (row.name) return row.name;
        return '-';
      },
    },
    {
      key: 'factory',
      title: (
        <TableHeaderFilter
          title="FACTORY"
          value={headerFilters.factory || ''}
          onFilter={value => setHeaderFilters('factory', value)}
          type="enum"
          data={factories}
          entityType="order"
        />
      ),
      render: (_: any, row: any) => {
        if (!row) return '-';
        // For enriched orders, use the direct factoryName field first (camelCase or snake_case)
        const factoryName = row.factoryName || row.factory_name;
        if (factoryName && typeof factoryName === 'string' && factoryName.trim()) {
          return factoryName;
        }
        // Fallback to supplierName for backwards compatibility
        if (row.supplierName && typeof row.supplierName === 'string' && row.supplierName.trim()) {
          return row.supplierName;
        }
        // Fallback to factory/supplier object or computed field
        if (row.factory) {
          if (typeof row.factory === 'object') {
            if (row.factory.name) return row.factory.name;
            return JSON.stringify(row.factory);
          }
          return String(row.factory);
        }
        if (row.supplier) {
          if (typeof row.supplier === 'object') {
            if (row.supplier.name) return row.supplier.name;
            return JSON.stringify(row.supplier);
          }
          return String(row.supplier);
        }
        return '-';
      },
    },
  ];
}
