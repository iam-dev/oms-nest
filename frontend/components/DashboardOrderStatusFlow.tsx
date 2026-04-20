import React, { useEffect, useState } from 'react';
import { fetchOrderStatusStats } from '@/services/api';
import { logger } from '@/utils/logger';

interface Status {
  key: string;
  label: string;
  count: number;
  color?: string;
}

interface DashboardOrderStatusFlowProps {
  onStatusClick?: (status: string) => void;
  onTotalOrders?: React.Dispatch<React.SetStateAction<number>>;
  selectedStatus?: string;
}

const STATUS_GROUPS = [
  // Kolom 1
  ['UNORDERED', 'ORDERED', 'APPROVED'],
  // Kolom 2
  ['IN_PRODUCTION_P1', 'IN_PRODUCTION_P2', 'IN_PRODUCTION_P3'],
  // Kolom 3
  ['SHIPPED_TO_STOCK_OWNER', 'SHIPPED_TO_CUSTOMER'],
  // Kolom 4
  ['INVENTORY', 'ON_HOLD', 'ON_TRIAL', 'COMPLETED_SALE'],
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const STATUS_LABELS: Record<string, string> = {
  UNORDERED: 'Unordered',
  ORDERED: 'Ordered/Changed',
  APPROVED: 'Approved',
  IN_PRODUCTION_P1: 'In Production P1',
  IN_PRODUCTION_P2: 'In Production P2',
  IN_PRODUCTION_P3: 'In Production P3',
  SHIPPED_TO_STOCK_OWNER: 'Shipped to Fitter',
  SHIPPED_TO_CUSTOMER: 'Shipped to Customer',
  INVENTORY: 'Inventory',
  ON_HOLD: 'On hold',
  ON_TRIAL: 'On trial',
  COMPLETED_SALE: 'Completed sale',
};

// Map the status keys to the actual database values for filtering
// These MUST match the exact names in the statuses table
const STATUS_FILTER_MAPPING: Record<string, string> = {
  UNORDERED: 'Unordered',
  ORDERED: 'Ordered',
  APPROVED: 'Approved',
  IN_PRODUCTION_P1: 'In Production P1',
  IN_PRODUCTION_P2: 'In Production P2',
  IN_PRODUCTION_P3: 'In Production P3',
  SHIPPED_TO_STOCK_OWNER: 'Shipped to Fitter',
  SHIPPED_TO_CUSTOMER: 'Shipped to Customer',
  INVENTORY: 'Inventory',
  ON_HOLD: 'On hold',
  ON_TRIAL: 'On trial',
  COMPLETED_SALE: 'Completed sale',
};

export default function DashboardOrderStatusFlow({ onStatusClick, onTotalOrders, selectedStatus }: DashboardOrderStatusFlowProps) {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchOrderStatusStats()
      .then(data => {
        logger.log('DashboardOrderStatusFlow: Received status stats:', data);

        // The backend now returns: { totalOrders, urgentOrders, overdueOrders, averageValue, statusCounts }
        const statusCountSum = Object.values(data.statusCounts || {}).reduce((sum: number, c) => sum + (Number(c) || 0), 0);
        const total = data.totalOrders || statusCountSum || 0;
        const statusCounts = data.statusCounts || {};
        const statusObj: Record<string, Status> = {};

        // Map the actual status counts from backend to our display format
        const statusMapping = {
          'unordered': { key: 'UNORDERED', label: 'Unordered' },
          'ordered_changed': { key: 'ORDERED', label: 'Ordered/Changed' },
          'approved': { key: 'APPROVED', label: 'Approved' },
          'in_production_p1': { key: 'IN_PRODUCTION_P1', label: 'In Production P1' },
          'in_production_p2': { key: 'IN_PRODUCTION_P2', label: 'In Production P2' },
          'in_production_p3': { key: 'IN_PRODUCTION_P3', label: 'In Production P3' },
          'shipped_to_fitter': { key: 'SHIPPED_TO_STOCK_OWNER', label: 'Shipped to Fitter' },
          'shipped_to_customer': { key: 'SHIPPED_TO_CUSTOMER', label: 'Shipped to Customer' },
          'inventory': { key: 'INVENTORY', label: 'Inventory' },
          'on_hold': { key: 'ON_HOLD', label: 'On hold' },
          'on_trial': { key: 'ON_TRIAL', label: 'On trial' },
          'completed_sale': { key: 'COMPLETED_SALE', label: 'Completed sale' }
        };

        // Build status object with actual counts
        Object.entries(statusMapping).forEach(([dbStatus, config]) => {
          const count = statusCounts[dbStatus] || 0;
          statusObj[config.key] = {
            key: config.key,
            label: config.label,
            count,
            color: '#7b2326'
          };
        });

        logger.log('DashboardOrderStatusFlow: Status counts from backend:', statusCounts);
        logger.log('DashboardOrderStatusFlow: Final status object:', statusObj);

        setStatuses(statusObj);
        setTotalOrders(total);
        onTotalOrders?.(total);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load order status stats');
        setLoading(false);
      });
  }, [onTotalOrders]);

  if (loading) return <div style={{ padding: 24 }}>Loading order status...</div>;
  if (error) return <div style={{ padding: 24, color: '#b00020' }}>{error}</div>;

  // 4 kolommen, aantallen klein rechtsboven, lijnen als achtergrond
  return (
    <div style={{
      background: '#f5f5f5',
      borderRadius: 12,
      padding: 32,
      marginBottom: 32,
      position: 'relative',
      minHeight: 270,
      overflow: 'visible',
    }}>
      <div style={{ display: 'flex', zIndex: 1, position: 'relative', height: 220 }}>
        {/* Status kolommen */}
        {STATUS_GROUPS.map((group, colIdx) => (
          <div key={colIdx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 24 }}>
            {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
            {group.map((statusKey, rowIdx) => {
              const status = statuses[statusKey];
              if (!status) return null;
              const filterValue = STATUS_FILTER_MAPPING[status.key] || status.key;
              const isActive = selectedStatus === filterValue;
              return (
                <div
                  key={statusKey}
                  onClick={() => {
                    logger.log('DashboardOrderStatusFlow: Clicking status:', status.key, 'with label:', status.label, 'mapped to filter:', filterValue);
                    // Toggle: if already selected, clear it; otherwise select it
                    onStatusClick?.(isActive ? '' : filterValue);
                  }}
                  style={{
                    background: isActive ? '#7b2326' : '#fff',
                    border: '2px solid #fff',
                    borderRadius: 6,
                    minWidth: 120,
                    minHeight: 38,
                    padding: '4px 14px 4px 12px',
                    fontWeight: 600,
                    color: isActive ? '#fff' : '#7b2326',
                    fontSize: 15,
                    boxShadow: '0 2px 6px rgba(123,35,38,0.07)',
                    cursor: onStatusClick ? 'pointer' : 'default',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    transition: 'background 0.15s, color 0.15s',
                    marginLeft: 0,
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = '#7b2326';
                      e.currentTarget.style.color = '#fff';
                      // Aantallen ook rood op hover
                      const count = e.currentTarget.querySelector('.schemecount');
                      if(count && count instanceof HTMLElement) {
                        count.style.background = '#7b2326';
                        count.style.color = '#fff';
                        count.style.borderColor = '#fff';
                      }
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = '#fff';
                      e.currentTarget.style.color = '#7b2326';
                      // Reset count kleur
                      const count = e.currentTarget.querySelector('.schemecount');
                      if(count && count instanceof HTMLElement) {
                        count.style.background = '#fff';
                        count.style.color = '#5B1C15';
                        count.style.borderColor = '#fff';
                      }
                    }
                  }}
                >
                  <span style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    background: '#bbb',
                    borderRadius: '50%',
                    marginRight: 80,
                    marginLeft: -36,
                    flexShrink: 0,
                    border: '1px solid #888',
                  }}></span>
                  <span>{status.label}</span>
                  <span className="schemecount" style={{
                    display: 'block',
                    position: 'absolute',
                    top: -12,
                    right: -13,
                    padding: '2px 4px',
                    margin: 0,
                    fontWeight: 'bold',
                    borderRadius: 15,
                    borderWidth: 2,
                    borderColor: '#fff',
                    borderStyle: 'solid',
                    backgroundColor: isActive ? '#7b2326' : '#fff',
                    color: isActive ? '#fff' : '#5B1C15',
                    fontSize: '10px',
                    lineHeight: 1,
                    minWidth: 22,
                    textAlign: 'center',
                  }}>{status.count}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
