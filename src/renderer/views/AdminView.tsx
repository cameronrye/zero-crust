/**
 * AdminView - Transactions window for monitoring POS activity
 *
 * Displays transaction history with real-time updates.
 * Receives updates via the same broadcast mechanism as other windows.
 * Wrapped in SectionErrorBoundary for graceful error handling.
 */

import { useState, useEffect } from 'react';
import type { TransactionRecord } from '@shared/ipc-types';
import { formatCurrency } from '@shared/currency';
import { SectionErrorBoundary } from '../components';
import { DRAG_REGION_STYLE } from '../utils/platform';

export default function AdminView() {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Fetch initial data
    const fetchInitialData = async () => {
      try {
        console.log('[AdminView] Fetching initial data...');
        const transactionsData = await window.electronAPI.getTransactions();
        console.log('[AdminView] Received data:', {
          transactionsCount: transactionsData?.length,
          transactionsData: transactionsData?.slice(0, 2), // Log first 2 transactions
        });
        if (isMounted) {
          setTransactions(transactionsData);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Failed to fetch admin data:', error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void fetchInitialData();

    // Subscribe to push-based updates (no polling needed)
    const unsubscribeTransactions = window.electronAPI.onTransactionsUpdate((newTransactions) => {
      console.log('[AdminView] Received transactions update:', {
        count: newTransactions?.length,
        sample: newTransactions?.slice(0, 2),
      });
      if (isMounted) {
        setTransactions(newTransactions);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeTransactions();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading transactions...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-900 text-gray-100 font-sans flex flex-col overflow-hidden">
      {/* Draggable title bar area for window movement */}
      <div
        className="h-10 bg-slate-900 flex items-center justify-center shrink-0"
        style={DRAG_REGION_STYLE}
      >
        <span className="text-amber-400/60 text-sm font-medium select-none">
          Transactions ({transactions.length})
        </span>
      </div>

      {/* Transactions Table */}
      <div className="flex-1 overflow-auto p-6">
        <SectionErrorBoundary sectionName="Transactions Table">
          <TransactionsTable transactions={transactions} />
        </SectionErrorBoundary>
      </div>
    </div>
  );
}

// Helper Components
interface TransactionsTableProps {
  transactions: TransactionRecord[];
}

function TransactionsTable({ transactions }: TransactionsTableProps) {
  // Sort by timestamp descending (newest first)
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const handleRowClick = (transactionId: string) => {
    window.electronAPI.showReceipt(transactionId).catch((error) => {
      console.error('Failed to show receipt:', error);
    });
  };

  if (sortedTransactions.length === 0) {
    return (
      <div className="text-center text-gray-400 py-12">
        No transactions yet. Complete a sale to see it here.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-slate-800 text-gray-400 text-sm">
          <tr>
            <th className="px-4 py-3 font-medium">Transaction ID</th>
            <th className="px-4 py-3 font-medium">Time</th>
            <th className="px-4 py-3 font-medium">Items</th>
            <th className="px-4 py-3 font-medium text-right">Total</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {sortedTransactions.map((txn) => (
            <tr
              key={txn.id}
              className="hover:bg-slate-800/50 cursor-pointer"
              onClick={() => handleRowClick(txn.id)}
            >
              <td className="px-4 py-3 font-mono text-sm">{txn.id}</td>
              <td className="px-4 py-3 text-sm text-gray-400">
                {new Date(txn.timestamp).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-sm">
                {txn.items.reduce((sum, item) => sum + item.quantity, 0)} items
              </td>
              <td className="px-4 py-3 text-right font-medium">
                {formatCurrency(txn.totalInCents)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={txn.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface StatusBadgeProps {
  status: TransactionRecord['status'];
}

function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    completed: 'bg-emerald-500/20 text-emerald-400',
    pending: 'bg-amber-500/20 text-amber-400',
    voided: 'bg-red-500/20 text-red-400',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
