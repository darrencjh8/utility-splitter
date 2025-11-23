import { useState } from 'react';
import { useStore } from '../store/useStore';
import { v4 as uuidv4 } from 'uuid';

interface BillCategoryManagerProps {
    onClose: () => void;
}

export const BillCategoryManager = ({ onClose }: BillCategoryManagerProps) => {
    const { billCategories, addBillCategory, deleteBillCategory } = useStore();
    const [newCategoryName, setNewCategoryName] = useState('');

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (newCategoryName.trim()) {
            addBillCategory({
                id: uuidv4(),
                name: newCategoryName.trim(),
            });
            setNewCategoryName('');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md transition-colors">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Manage Categories</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200">
                        ✕
                    </button>
                </div>

                <form onSubmit={handleAdd} className="mb-6 flex gap-2">
                    <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="New category name"
                        className="flex-1 p-2 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                        type="submit"
                        disabled={!newCategoryName.trim()}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-slate-600 transition-colors"
                    >
                        Add
                    </button>
                </form>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {billCategories.map(category => (
                        <div key={category.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-slate-700 rounded transition-colors">
                            <span className="text-slate-700 dark:text-slate-200">{category.name}</span>
                            {
                                <button
                                    onClick={() => deleteBillCategory(category.id)}
                                    className="text-red-500 hover:text-red-700 dark:hover:text-red-400 text-sm"
                                >
                                    Delete
                                </button>
                            }
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
