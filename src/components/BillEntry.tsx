import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { DollarSign, Calendar, Receipt, Users, PieChart, Hash, Tag } from 'lucide-react';
import { useStore } from '../store/useStore';
import { BillCategoryManager } from './BillCategoryManager';
import type { SplitMethod, Split } from '../types';

export const BillEntry: React.FC = () => {
    const { housemates, addBill, billCategories, bills } = useStore();

    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [payerId, setPayerId] = useState('');
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');
    const [splits, setSplits] = useState<Split[]>([]);
    const [categoryId, setCategoryId] = useState('');
    const [showCategoryManager, setShowCategoryManager] = useState(false);

    // Initialize splits when housemates change
    useEffect(() => {
        if (housemates.length > 0) {
            // Only reset if we don't have existing splits or if the housemates count changed significantly
            // But for now, let's keep the original logic but be careful not to overwrite if we are just switching methods
            if (splits.length === 0) {
                setSplits(housemates.map(h => ({ housemateId: h.id, amount: 0, share: splitMethod === 'equal' ? 1 : 0 })));
            }
            if (!payerId) setPayerId(housemates[0].id);
        }
        if (billCategories.length > 0 && !categoryId) {
            setCategoryId(billCategories[0].id);
        }
    }, [housemates, billCategories, categoryId, payerId, splitMethod, splits.length]);

    // Auto-fill splits from previous bill of same category
    useEffect(() => {
        if (!categoryId || !splitMethod || splitMethod === 'equal') return;

        // Find the most recent bill with this category and split method
        const lastBill = bills
            .filter(b => b.categoryId === categoryId && b.splitMethod === splitMethod)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

        if (lastBill) {
            // Map the saved splits to the current housemates
            // We need to be careful if housemates have changed since the last bill
            const newSplits = housemates.map(h => {
                const savedSplit = lastBill.splits.find(s => s.housemateId === h.id);
                return {
                    housemateId: h.id,
                    amount: 0, // Will be recalculated
                    share: savedSplit ? savedSplit.share : 0
                };
            });
            setSplits(newSplits);
        }
    }, [categoryId, splitMethod, housemates, bills]);

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !amount || !payerId || !categoryId) return;

        addBill({
            id: uuidv4(),
            title,
            amount: parseFloat(amount),
            payerId,
            date,
            splitMethod,
            splits,
            createdAt: new Date().toISOString(),
            billingMonth: date.substring(0, 7), // YYYY-MM
            categoryId,
        });

        // Reset form
        setTitle('');
        setAmount('');
        // Keep payer, date, and category for convenience
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
                <Receipt className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Add New Bill
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Bill Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. March Electricity"
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-slate-400 dark:placeholder-slate-500"
                            required
                        />
                    </div>
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                                <select
                                    value={categoryId}
                                    onChange={(e) => setCategoryId(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                >
                                    {billCategories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCategoryManager(true)}
                                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-400 text-sm"
                                title="Manage categories"
                            >
                                ⚙️
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Paid By</label>
                        <select
                            value={payerId}
                            onChange={(e) => setPayerId(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        >
                            {housemates.map(h => (
                                <option key={h.id} value={h.id}>{h.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all [color-scheme:light] dark:[color-scheme:dark]"
                                required
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Split Method</label>
                    <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl w-fit transition-colors">
                        {(['equal', 'percentage', 'shares'] as SplitMethod[]).map((method) => (
                            <button
                                key={method}
                                type="button"
                                onClick={() => setSplitMethod(method)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${splitMethod === method
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

            {showCategoryManager && (
                <BillCategoryManager onClose={() => setShowCategoryManager(false)} />
            )}
        </div>
    );
};
