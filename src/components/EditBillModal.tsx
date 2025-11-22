import React, { useState, useEffect } from 'react';
import { DollarSign, Calendar, Receipt, Users, PieChart, Hash, Tag, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { BillType, SplitMethod, Split } from '../types';

interface EditBillModalProps {
    bill: BillType;
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedBill: BillType) => void;
}

export const EditBillModal: React.FC<EditBillModalProps> = ({ bill, isOpen, onClose, onSave }) => {
    const { housemates, billCategories } = useStore();

    const [title, setTitle] = useState(bill.title);
    const [amount, setAmount] = useState(bill.amount.toString());
    const [payerId, setPayerId] = useState(bill.payerId);
    const [date, setDate] = useState(bill.date.substring(0, 10));
    const [splitMethod, setSplitMethod] = useState<SplitMethod>(bill.splitMethod);
    const [splits, setSplits] = useState<Split[]>(bill.splits);
    const [categoryId, setCategoryId] = useState(bill.categoryId || '5');

    // Initialize splits if housemates changed (simplified logic for edit)
    // We generally want to keep existing splits unless the user changes the method

    // Recalculate amounts when total amount or shares change
    useEffect(() => {
        const totalAmount = parseFloat(amount) || 0;
        if (totalAmount === 0) return;

        // Only recalculate if the method matches the current splits structure or if we are forcing a recalc
        // For edit, we trust the user's manual changes unless they switch methods or change total

        if (splitMethod === 'equal') {
            // Check if we need to re-distribute (e.g. amount changed)
            // For equal, it's always total / count
            const splitAmount = totalAmount / housemates.length;
            // We must map to ALL housemates for equal split
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

        onSave({
            ...bill,
            title,
            amount: parseFloat(amount),
            payerId,
            date,
            splitMethod,
            splits,
            categoryId,
            // Keep original ID and createdAt
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200 transition-colors">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                            <Receipt className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            Edit Bill
                        </h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Bill Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
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
                                <div className="relative">
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
                                    {splitMethod === 'percentage' ? 'Enter percentage per person (must total 100%)' : 'Enter shares per person'}
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
                                                className="w-24 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                                placeholder="0"
                                            />
                                            <span className="text-sm text-slate-500 dark:text-slate-400">
                                                {splitMethod === 'percentage' ? '%' : 'shares'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-lg shadow-indigo-500/20"
                            >
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
