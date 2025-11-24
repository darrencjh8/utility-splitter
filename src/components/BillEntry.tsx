import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { DollarSign, Calendar, Users, PieChart, Hash, Tag } from 'lucide-react';
import { useStore } from '../store/useStore';
import { MANUAL_BILL_CATEGORIES } from '../types';
import type { SplitMethod, Split } from '../types';

export const BillEntry: React.FC = () => {
    const { housemates, addManualBill } = useStore();

    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM'));
    const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');
    const [splits, setSplits] = useState<Split[]>([]);
    const [categoryId, setCategoryId] = useState('');

    // Initialize splits when housemates change
    useEffect(() => {
        if (housemates.length > 0) {
            if (splits.length === 0) {
                setSplits(housemates.map(h => ({ housemateId: h.id, amount: 0, share: splitMethod === 'equal' ? 1 : 0 })));
            }
        }
        if (MANUAL_BILL_CATEGORIES.length > 0 && !categoryId) {
            setCategoryId(MANUAL_BILL_CATEGORIES[0].id);
        }
    }, [housemates, categoryId, splitMethod, splits.length]);

    // Recalculate amounts when total amount or shares change
    useEffect(() => {
        const totalAmount = parseFloat(amount) || 0;
        if (totalAmount === 0) return;

        if (splitMethod === 'equal') {
            const splitAmount = totalAmount / housemates.length;
            setSplits(housemates.map(h => ({ housemateId: h.id, amount: splitAmount, share: 1 })));
        } else if (splitMethod === 'percentage') {
            setSplits(prev => prev.map(s => ({
                ...s,
                amount: (totalAmount * (s.share || 0)) / 100
            })));
        } else if (splitMethod === 'shares') {
            const totalShares = splits.reduce((sum, s) => sum + (s.share || 0), 0);
            if (totalShares > 0) {
                setSplits(prev => prev.map(s => ({
                    ...s,
                    amount: (totalAmount * (s.share || 0)) / totalShares
                })));
            }
        }
    }, [amount, housemates, splitMethod, splits.map(s => s.share).join(',')]);

    const handleShareChange = (id: string, value: number) => {
        setSplits(prev => prev.map(s => s.housemateId === id ? { ...s, share: value } : s));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !categoryId) return;

        // Get the vendor name from the selected category
        const vendor = MANUAL_BILL_CATEGORIES.find(c => c.id === categoryId)?.name || 'Other';

        // Create array of amounts in the order of housemates
        const amounts = housemates.map(h => {
            const split = splits.find(s => s.housemateId === h.id);
            return split ? split.amount : 0;
        });

        await addManualBill(date, vendor, amounts);

        // Reset form
        setAmount('');
        // Keep date and category for convenience
    };

    if (housemates.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 text-center transition-colors">
                <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400">Add housemates first to start recording bills.</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                <Tag className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Add New Bill
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amount</label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-slate-400 dark:placeholder-slate-500"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category (Vendor)</label>
                        <div className="relative">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                            <select
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            >
                                {MANUAL_BILL_CATEGORIES.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Month</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                        <input
                            type="month"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all [color-scheme:light] dark:[color-scheme:dark]"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Split Calculator</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl w-full sm:w-fit transition-colors">
                        {(['equal', 'percentage', 'shares'] as SplitMethod[]).map((method) => (
                            <button
                                key={method}
                                type="button"
                                onClick={() => setSplitMethod(method)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${splitMethod === method
                                    ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-300 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                            >
                                {method === 'equal' && <Users className="w-4 h-4" />}
                                {method === 'percentage' && <PieChart className="w-4 h-4" />}
                                {method === 'shares' && <Hash className="w-4 h-4" />}
                                {method.charAt(0).toUpperCase() + method.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {splitMethod !== 'equal' && (
                    <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl space-y-3 transition-colors">
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                            {splitMethod === 'percentage' ? 'Enter percentage per person (must total 100%)' : 'Enter shares per person (e.g. days stayed)'}
                        </p>
                        {splits.map((split) => {
                            const housemate = housemates.find(h => h.id === split.housemateId);
                            if (!housemate) return null;
                            return (
                                <div key={split.housemateId} className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 w-24 truncate">{housemate.name}</span>
                                    <input
                                        type="number"
                                        value={split.share || ''}
                                        onChange={(e) => handleShareChange(split.housemateId, parseFloat(e.target.value) || 0)}
                                        className="w-24 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500"
                                        placeholder="0"
                                    />
                                    <span className="text-sm text-slate-400 dark:text-slate-500">
                                        {splitMethod === 'percentage' ? '%' : 'shares'}
                                    </span>
                                    <span className="ml-auto text-sm font-medium text-slate-900 dark:text-white">
                                        ${split.amount.toFixed(2)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}

                <button
                    type="submit"
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20 active:scale-[0.99]"
                >
                    Record Bill
                </button>
            </form>
        </div>
    );
};
