import React from 'react';
import { LayoutDashboard, Users, Receipt, Calendar, Moon, Sun } from 'lucide-react';

interface SidebarProps {
    currentView: string;
    onNavigate: (view: string) => void;
    isDarkMode: boolean;
    toggleDarkMode: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, isDarkMode, toggleDarkMode }) => {
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'bills', label: 'Bills', icon: Receipt },
        { id: 'history', label: 'History', icon: Calendar },
        { id: 'housemates', label: 'Housemates', icon: Users },
    ];

    return (
        <aside className="hidden md:block fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    FairShare
                </h1>
            </div>

            <nav className="p-4 space-y-1">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => {
                            onNavigate(item.id);
                        }}
                        className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium
                ${currentView === item.id
                                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200'}
              `}
                    >
                        <item.icon className={`w-5 h-5 ${currentView === item.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
                        {item.label}
                    </button>
                ))}
            </nav>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100 dark:border-slate-700">
                <button
                    onClick={toggleDarkMode}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200 transition-all font-medium mb-2"
                >
                    {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                </button>
                <div className="flex items-center gap-3 px-4 py-3 text-slate-400 dark:text-slate-500 text-sm">
                    <span>v1.0.0</span>
                </div>
            </div>
        </aside>
    );
};
