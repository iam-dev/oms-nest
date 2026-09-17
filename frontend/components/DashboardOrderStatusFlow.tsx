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
  /**
   * Bump to refetch the counts.  A status change moves an order between buckets,
   * so counts fetched once on mount would keep showing the pre-change totals
   * next to a table the host has already refreshed.
   */
  refreshKey?: number;
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
// These MUST match the exact names in the statuses table.  A card that covers
// several statuses lists them comma-separated; the enriched-orders endpoint
// splits on the comma and ORs the names.
const STATUS_FILTER_MAPPING: Record<string, string> = {
  UNORDERED: 'Unordered',
  ORDERED: 'Ordered,Changed',
  APPROVED: 'Approved',
  IN_PRODUCTION_P1: 'In Production P1',
  IN_PRODUCTION_P2: 'In Production P2',
  IN_PRODUCTION_P3: 'In Production P3',
  SHIPPED_TO_STOCK_OWNER: 'Shipped to Fitter',
  SHIPPED_TO_CUSTOMER: 'Shipped to Customer',
  INVENTORY: 'Inventory Aiken,Inventory UK,Inventory HOLLAND',
  ON_HOLD: 'On hold',
  ON_TRIAL: 'On trial',
  COMPLETED_SALE: 'Completed sale',
};

// Which /orders/stats statusCounts keys feed each card.  The backend already
// folds Ordered + Changed into ordered_changed, but reports inventory per
// location, so the Inventory card has to add its three keys up itself.
const STATUS_COUNT_KEYS: Record<string, string[]> = {
  UNORDERED: ['unordered'],
  ORDERED: ['ordered_changed'],
  APPROVED: ['approved'],
  IN_PRODUCTION_P1: ['in_production_p1'],
  IN_PRODUCTION_P2: ['in_production_p2'],
  IN_PRODUCTION_P3: ['in_production_p3'],
  SHIPPED_TO_STOCK_OWNER: ['shipped_to_fitter'],
  SHIPPED_TO_CUSTOMER: ['shipped_to_customer'],
  INVENTORY: ['inventory_aiken', 'inventory_uk', 'inventory_holland'],
  ON_HOLD: ['on_hold'],
  ON_TRIAL: ['on_trial'],
  COMPLETED_SALE: ['completed_sale'],
};

export default function DashboardOrderStatusFlow({ onStatusClick, onTotalOrders, selectedStatus, refreshKey = 0 }: DashboardOrderStatusFlowProps) {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // TODO(react-hooks): async fetch drives setLoading/setStatuses — standard data-loading effect, not a cascading-render bug
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchOrderStatusStats()
      .then(data => {
        logger.log('DashboardOrderStatusFlow: Received status stats:', data);

        // The backend now returns: { totalOrders, urgentOrders, overdueOrders, averageValue, statusCounts }
        const statusCountSum = Object.values(data.statusCounts || {}).reduce((sum: number, c) => sum + (Number(c) || 0), 0);
        const total = data.totalOrders || statusCountSum || 0;
        const statusCounts = data.statusCounts || {};
        const statusObj: Record<string, Status> = {};

        // Build status object with actual counts
        Object.entries(STATUS_COUNT_KEYS).forEach(([key, countKeys]) => {
          const count = countKeys.reduce((sum, k) => sum + (Number(statusCounts[k]) || 0), 0);
          statusObj[key] = {
            key,
            label: STATUS_LABELS[key],
            count,
            color: '#7b2326'
          };
        });

        logger.log('DashboardOrderStatusFlow: Status counts from backend:', statusCounts);
        logger.log('DashboardOrderStatusFlow: Final status object:', statusObj);

        setStatuses(statusObj);
        setTotalOrders(total);
        onTotalOrders?.(total);
        // Clear any error from an earlier attempt, now that refetches happen.
        setError('');
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load order status stats');
        setLoading(false);
      });
  }, [onTotalOrders, refreshKey]);

  // Only stand in for the cards before the first successful load.  On a refetch
  // the previous counts stay on screen instead of flashing back to a placeholder,
  // and a failed refetch leaves the last known counts rather than wiping them.
  const hasCounts = Object.keys(statuses).length > 0;
  if (loading && !hasCounts) return <div style={{ padding: 24 }}>Loading order status...</div>;
  if (error && !hasCounts) return <div style={{ padding: 24, color: '#b00020' }}>{error}</div>;

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
      {/* Each card is ~200px wide, so four side-by-side columns need ~950px.
          Below that (small laptops, or zoomed-in browsers) reflow to 2 then 1
          column instead of letting the columns overlap. Breakpoints are
          Tailwind's since media queries can't be expressed inline. */}
      <div
        data-testid="status-flow-grid"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-4 gap-y-8"
        style={{ zIndex: 1, position: 'relative', minHeight: 220 }}
      >
        {/* Status kolommen */}
        {STATUS_GROUPS.map((group, colIdx) => (
          <div key={colIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 24 }}>
            {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
            {group.map((statusKey, rowIdx) => {
              const status = statuses[statusKey];
              if (!status) return null;
              const filterValue = STATUS_FILTER_MAPPING[status.key] || status.key;
              const isActive = selectedStatus === filterValue;
              return (
                <div
                  key={statusKey}
                  data-status-card
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
                    whiteSpace: 'nowrap',
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
                    // Keeps the widest card ("Shipped to Customer") inside a
                    // quarter of the panel at the xl breakpoint.
                    marginRight: 48,
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
