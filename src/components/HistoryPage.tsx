import React, { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, ChevronDown, ChevronUp, Trash2, Edit2 } from 'lucide-react';
import type { BillType } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { EditBillModal } from './EditBillModal';

export const HistoryPage: React.FC = () => {
    const { billHistories, housemates, billCategories, availableYears, currentYear, loadYear, deleteBill, updateBill } = useStore();
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedMonths, setExpandedMonths] = useState<string[]>([]);
    const [editBill, setEditBill] = useState<BillType | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const itemsPerPage = 5;

    const groupedBills = useMemo(() => {
        const groups: Record<string, BillType[]> = {};
        billHistories.forEach(bill => {
            // Fallback for existing bills without billingMonth
            const month = bill.billingMonth || bill.date.substring(0, 7);
            if (!groups[month]) {
                groups[month] = [];
            }
            groups[month].push(bill);
        });
        return groups;
    }, [billHistories]);

    const sortedMonths = useMemo(() => {
        return Object.keys(groupedBills).sort((a, b) => b.localeCompare(a)); // Descending order (newest first)
    }, [groupedBills]);

    const totalPages = Math.ceil(sortedMonths.length / itemsPerPage);
    const currentMonths = sortedMonths.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const toggleMonth = (month: string) => {
        setExpandedMonths(prev =>
            prev.includes(month)
                ? prev.filter(m => m !== month)
                : [...prev, month]
        );
    };

    const getCategoryName = (id: string) => billCategories.find(c => c.id === id)?.name || 'Other';

    const getMonthTotal = (month: string) => {
        return groupedBills[month]
            .filter(b => b.type !== 'settlement')
            .reduce((sum, bill) => sum + bill.amount, 0);
    };

    const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        loadYear(e.target.value);
        setCurrentPage(1);
    };

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDeleteId(id);
    };

    const handleConfirmDelete = () => {
        if (deleteId) {
            deleteBill(deleteId);
            setDeleteId(null);
        }
    };

    const handleEditClick = (e: React.MouseEvent, bill: BillType) => {
        e.stopPropagation();
        setEditBill(bill);
    };

    const handleSaveEdit = (updatedBill: BillType) => {
        updateBill(updatedBill);
        setEditBill(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Calendar className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    Billing History
                </h2>

                {availableYears.length > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500 dark:text-slate-400">Year:</span>
                        <select
                            value={currentYear}
                            onChange={handleYearChange}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                            {availableYears.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {sortedMonths.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 text-center transition-colors">
                    <p className="text-slate-500 dark:text-slate-400">No billing history available for {currentYear}.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {currentMonths.map(month => (
                        <div key={month} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden transition-colors">
                            <div
                                onClick={() => toggleMonth(month)}
                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="bg-indigo-100 dark:bg-indigo-900/50 p-2 rounded-lg">
                                        <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-800 dark:text-white">
                                            {(() => {
                                                // Check if month is in "MMMM yyyy" format already (like "October 2023")
                                                if (month.match(/^[A-Za-z]+ \d{4}$/)) {
                                                    return month;
                                                }
                                                // Otherwise try to parse as ISO format "yyyy-MM"
                                                try {
                                                    return format(parseISO(`${month}-01`), 'MMMM yyyy');
                                                } catch (e) {
                                                    return month; // Fallback to original string
                                                }
                                            })()}
                                        </h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            {groupedBills[month].length} bill{groupedBills[month].length !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Total</p>
                                        <p className="font-bold text-slate-800 dark:text-white">${getMonthTotal(month).toFixed(2)}</p>
                                    </div>
                                    {expandedMonths.includes(month) ? (
                                        <ChevronUp className="w-5 h-5 text-slate-400" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-slate-400" />
                                    )}
                                </div>
                            </div>

                            {expandedMonths.includes(month) && (
                                <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                                    {/* Monthly Breakdown */}
                                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-indigo-50/30 dark:bg-indigo-900/10">
                                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Monthly Breakdown</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {housemates.map(h => {
                                                const monthlyTotal = groupedBills[month].reduce((sum, bill) => {
                                                    if (bill.type === 'settlement') return sum;
                                                    const split = bill.splits.find(s => s.housemateId === h.id);
                                                    return sum + (split ? split.amount : 0);
                                                }, 0);

                                                if (monthlyTotal === 0) return null;

                                                return (
                                                    <div key={h.id} className="flex items-center justify-between bg-white dark:bg-slate-700 p-2 rounded-lg border border-slate-100 dark:border-slate-600">
                                                        <span className="text-sm text-slate-600 dark:text-slate-300">{h.name}</span>
                                                        <span className="text-sm font-bold text-slate-800 dark:text-white">${monthlyTotal.toFixed(2)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {groupedBills[month].map(bill => (
                                        <div key={bill.id} className={`p-4 border-b border-slate-100 dark:border-slate-700 last:border-0 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 group transition-colors ${bill.type === 'settlement' ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-slate-800 dark:text-white">{bill.title}</p>
                                                    {bill.type === 'settlement' && (
                                                        <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 rounded-full uppercase tracking-wide">
                                                            Settlement
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {(() => {
                                                        try {
                                                            // Try to parse as ISO date
                                                            const date = parseISO(bill.date);
                                                            if (!isNaN(date.getTime())) {
                                                                return format(date, 'MMM d');
                                                            }
                                                        } catch (e) {
                                                            // Ignore parse errors
                                                        }
                                                        // Try parsing as regular date string
                                                        try {
                                                            const date = new Date(bill.date);
                                                            if (!isNaN(date.getTime())) {
                                                                return format(date, 'MMM d');
                                                            }
                                                        } catch (e) {
                                                            // Ignore
                                                        }
                                                        // Fallback to just showing the raw date if billingMonth exists
                                                        return bill.billingMonth || bill.date.substring(0, 10);
                                                    })()} • {getCategoryName(bill.categoryId)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className={`font-semibold ${bill.type === 'settlement' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-white'}`}>
                                                        ${bill.amount.toFixed(2)}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{bill.splitMethod} Split</p>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => handleEditClick(e, bill)}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                                                        title="Edit Bill"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteClick(e, bill.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                        title="Delete Bill"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    </button>
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    </button>
                </div>
            )}

            <ConfirmDialog
                isOpen={!!deleteId}
                title="Delete Bill"
                message="Are you sure you want to delete this bill? This action cannot be undone and will affect balances."
                confirmLabel="Delete"
                isDestructive
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeleteId(null)}
            />

            {editBill && (
                <EditBillModal
                    isOpen={!!editBill}
                    bill={editBill}
                    onClose={() => setEditBill(null)}
                    onSave={handleSaveEdit}
                />
            )}
        </div>
    );
};
