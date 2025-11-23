import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Wallet, TrendingUp, DollarSign } from 'lucide-react';

export const Dashboard: React.FC = () => {
    const { housemates, bills, billCategories, currentYear, balances: globalBalances } = useStore();

    const summary = useMemo(() => {
        // We only calculate expenses and payable for the CURRENT VIEW (current year)
        const totalPayable: Record<string, number> = {};
        let totalExpenses = 0;
        let totalExpensesExcludingRent = 0;

        housemates.forEach(h => {
            totalPayable[h.id] = 0;
        });

        const rentCategoryIds = billCategories
            .filter(c => c.name.toLowerCase() === 'rent')
            .map(c => c.id);

        bills.forEach(bill => {
            if (bill.type !== 'settlement') {
                totalExpenses += bill.amount;

                // Check if bill is Rent (by category ID, category name, or title)
                const isRent = rentCategoryIds.includes(bill.categoryId) ||
                    bill.categoryId.toLowerCase() === 'rent' ||
                    bill.title.toLowerCase() === 'rent';

                if (!isRent) {
                    totalExpensesExcludingRent += bill.amount;
                }
            }

            bill.splits.forEach(split => {
                if (bill.type !== 'settlement') {
                    if (totalPayable[split.housemateId] !== undefined) {
                        totalPayable[split.housemateId] += split.amount;
                    }
                }
            });
        });

        return { totalExpenses, totalExpensesExcludingRent, totalPayable };
    }, [housemates, bills, billCategories]);

    const categoryStats = useMemo(() => {
        const stats: Record<string, { total: number; count: number }> = {};

        billCategories.forEach(cat => {
            stats[cat.id] = { total: 0, count: 0 };
        });
        stats['5'] = { total: 0, count: 0 };

        bills.forEach(bill => {
            if (bill.type === 'settlement') return;
            const catId = bill.categoryId || '5';
            if (!stats[catId]) stats[catId] = { total: 0, count: 0 };

            stats[catId].total += bill.amount;
            stats[catId].count += 1;
        });

        return stats;
    }, [bills, billCategories]);

    const categoryBreakdown = useMemo(() => {
        const breakdown: Record<string, Record<string, number>> = {};

        housemates.forEach(h => {
            breakdown[h.id] = {};
            billCategories.forEach(cat => {
                breakdown[h.id][cat.id] = 0;
            });
        });

        bills.forEach(bill => {
            if (bill.type === 'settlement') return;
            if (breakdown[bill.payerId]) {
                const catId = bill.categoryId || '5';
                breakdown[bill.payerId][catId] = (breakdown[bill.payerId][catId] || 0) + bill.amount;
            }
        });

        return breakdown;
    }, [housemates, bills, billCategories]);

    const getHousemateName = (id: string) => housemates.find(h => h.id === id)?.name || 'Unknown';

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
                    <div className="flex items-center gap-3 mb-2 opacity-80">
                        <Wallet className="w-5 h-5" />
                        <span className="text-sm font-medium">{currentYear} Total</span>
                    </div>
                    <div className="text-2xl font-bold">${summary.totalExpenses.toFixed(2)}</div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
                    <div className="flex items-center gap-3 mb-2 text-slate-500 dark:text-slate-400">
                        <Wallet className="w-5 h-5" />
                        <span className="text-sm font-medium">Excl. Rent</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white">${summary.totalExpensesExcludingRent.toFixed(2)}</div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
                    <div className="flex items-center gap-3 mb-2 text-slate-500 dark:text-slate-400">
                        <TrendingUp className="w-5 h-5" />
                        <span className="text-sm font-medium">{currentYear} Bills</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white">{bills.filter(b => b.type !== 'settlement').length}</div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
                    <div className="flex items-center gap-3 mb-2 text-slate-500 dark:text-slate-400">
                        <DollarSign className="w-5 h-5" />
                        <span className="text-sm font-medium">Avg. per Bill</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white">
                        ${bills.filter(b => b.type !== 'settlement').length > 0 ? (summary.totalExpenses / bills.filter(b => b.type !== 'settlement').length).toFixed(2) : '0.00'}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Net Balances */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Net Balances (Global)</h3>
                    <div className="space-y-3">
                        {housemates.map(h => {
                            const balance = globalBalances[h.id] || 0;
                            const payable = summary.totalPayable[h.id] || 0;
                            return (
                                <div key={h.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl transition-colors">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-slate-700 dark:text-slate-200">{h.name}</span>
                                        <span className={`font-bold ${balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                            {balance >= 0 ? '+' : ''}{balance.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                        <span>{currentYear} Share:</span>
                                        <span>${payable.toFixed(2)}</span>
                                    </div>
                                </div>
                            );
                        })}
                        {housemates.length === 0 && <p className="text-slate-400 italic">No housemates yet.</p>}
                    </div>
                </div>

                {/* Recent Bills */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Recent Bills</h3>
                    <div className="space-y-3">
                        {bills.length === 0 ? (
                            <p className="text-slate-400 italic">No bills recorded yet.</p>
                        ) : (
                            bills.slice(0, 5).map(bill => (
                                <div key={bill.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700 transition-colors">
                                    <div>
                                        <div className="font-semibold text-slate-800 dark:text-white">{bill.title}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                            Paid by {getHousemateName(bill.payerId)} • {new Date(bill.date).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-slate-900 dark:text-white">${bill.amount.toFixed(2)}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">{bill.splitMethod} Split</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Category Breakdown */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">{currentYear} Expenses by Category</h3>

                {/* Category Averages */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {billCategories.map(cat => {
                        const stat = categoryStats[cat.id];
                        if (!stat || stat.count === 0) return null;
                        const avg = stat.total / stat.count;
                        return (
                            <div key={cat.id} className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800 transition-colors">
                                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-1">{cat.name} Avg.</p>
                                <p className="font-bold text-indigo-900 dark:text-indigo-200">${avg.toFixed(2)}</p>
                                <p className="text-[10px] text-indigo-400 dark:text-indigo-500">{stat.count} bill{stat.count !== 1 ? 's' : ''}</p>
                            </div>
                        );
                    })}
                </div>

                <div className="space-y-4">
                    {housemates.map(h => {
                        const housemateTotal = Object.values(categoryBreakdown[h.id] || {}).reduce((sum, amt) => sum + amt, 0);
                        if (housemateTotal === 0) return null;

                        return (
                            <div key={h.id} className="border border-slate-100 dark:border-slate-700 rounded-xl p-4 transition-colors">
                                <div className="font-semibold text-slate-800 dark:text-white mb-3 flex items-center justify-between">
                                    <span>{h.name}</span>
                                    <span className="text-sm text-slate-500 dark:text-slate-400">Total: ${housemateTotal.toFixed(2)}</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {billCategories.map(cat => {
                                        const amount = categoryBreakdown[h.id]?.[cat.id] || 0;
                                        if (amount === 0) return null;
                                        return (
                                            <div key={cat.id} className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg transition-colors">
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{cat.name}</p>
                                                <p className="font-semibold text-slate-800 dark:text-slate-200">${amount.toFixed(2)}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                    {housemates.every(h => Object.values(categoryBreakdown[h.id] || {}).reduce((sum, amt) => sum + amt, 0) === 0) && (
                        <p className="text-slate-400 italic text-center py-4">No expenses recorded yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
};
