/**
 * TransactionHistory - Transaction history table for the web demo
 */

import { useState, useEffect } from 'react';
import type { TransactionRecord } from '../shared/types';
import { formatCurrency } from '../shared/currency';
import { useElectronAPI } from '../context/WebAPIContext';

type LoadingState = 'loading' | 'loaded' | 'error';

export function TransactionHistory() {
  const api = useElectronAPI();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    // Set up subscription first to avoid missing updates
    unsubscribe = api.onTransactionsUpdate((newTxns) => {
      if (mounted) {
        setTransactions(newTxns ?? []);
        setLoadingState('loaded');
        setErrorMessage(null);
      }
    });

    // Then fetch initial data
    api.getTransactions().then((txns) => {
      if (mounted) {
        setTransactions(txns);
        setLoadingState('loaded');
        setErrorMessage(null);
      }
    }).catch((err) => {
      if (mounted) {
        setTransactions([]);
        setLoadingState('error');
        setErrorMessage('Failed to load transactions. Please try again.');
        console.error('Failed to fetch transactions:', err);
      }
    });

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [api]);

  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const statusStyles = {
    completed: 'bg-emerald-500/20 text-emerald-400',
    pending: 'bg-amber-500/20 text-amber-400',
    voided: 'bg-red-500/20 text-red-400',
  };

  const renderContent = () => {
    if (loadingState === 'loading') {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-2" />
          <span className="text-gray-400">Loading transactions...</span>
        </div>
      );
    }

    if (loadingState === 'error') {
      return (
        <div className="text-center py-12">
          <div className="text-rose-400 mb-2">{errorMessage}</div>
          <p className="text-gray-500 text-sm">Transactions will appear when available.</p>
        </div>
      );
    }

    if (sortedTransactions.length === 0) {
      return (
        <div className="text-center text-gray-500 py-12">
          No transactions yet. Complete a sale to see it here.
        </div>
      );
    }

    return (
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-800 text-gray-400 sticky top-0">
          <tr>
            <th className="px-4 py-3 font-medium">ID</th>
            <th className="px-4 py-3 font-medium">Time</th>
            <th className="px-4 py-3 font-medium">Items</th>
            <th className="px-4 py-3 font-medium text-right">Total</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {sortedTransactions.map((txn) => (
            <tr key={txn.id} className="hover:bg-slate-800/50">
              <td className="px-4 py-3 font-mono text-xs">{txn.id.slice(0, 12)}...</td>
              <td className="px-4 py-3 text-gray-400">
                {new Date(txn.timestamp).toLocaleTimeString()}
              </td>
              <td className="px-4 py-3">
                {txn.items.reduce((sum, item) => sum + item.quantity, 0)} items
              </td>
              <td className="px-4 py-3 text-right font-medium">
                {formatCurrency(txn.totalInCents)}
              </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${statusStyles[txn.status]}`}>
                  {txn.status.charAt(0).toUpperCase() + txn.status.slice(1)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 text-gray-100">
      <div className="p-4 border-b border-slate-700 shrink-0">
        <h3 className="font-semibold">Transaction History</h3>
        <p className="text-gray-400 text-sm mt-1">{transactions.length} transaction(s)</p>
      </div>

      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
}

