import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, User } from 'lucide-react';
import { useStore } from '../store/useStore';

export const HousemateManager: React.FC = () => {
    const { housemates, addHousemate, removeHousemate } = useStore();
    const [newName, setNewName] = useState('');

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        addHousemate({
            id: uuidv4(),
            name: newName.trim(),
        });
        setNewName('');
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Housemates
            </h2>

            <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 mb-6">
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Enter name..."
                    className="w-full sm:flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-slate-400 dark:placeholder-slate-500"
                />
                <button
                    type="submit"
                    disabled={!newName.trim()}
                    className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Add
                </button>
            </form>

            <div className="space-y-3">
                {housemates.length === 0 ? (
                    <p className="text-slate-400 text-center py-4 italic">No housemates added yet.</p>
                ) : (
                    housemates.map((housemate) => (
                        <div
                            key={housemate.id}
                            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl group hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-semibold text-sm">
                                    {housemate.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-slate-700 dark:text-slate-200">{housemate.name}</span>
                            </div>
                            <button
                                onClick={() => removeHousemate(housemate.id)}
                                className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                                title="Remove housemate"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
