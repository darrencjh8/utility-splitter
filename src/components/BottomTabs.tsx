import React from 'react';
import { LayoutDashboard, Users, Receipt, Calendar } from 'lucide-react';

interface BottomTabsProps {
    currentView: string;
    onNavigate: (view: string) => void;
}

export const BottomTabs: React.FC<BottomTabsProps> = ({ currentView, onNavigate }) => {
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'bills', label: 'Bills', icon: Receipt },
        { id: 'history', label: 'History', icon: Calendar },
        { id: 'housemates', label: 'Housemates', icon: Users },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 z-50 pb-safe">
            <nav className="flex justify-around items-center h-16">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className={`
                flex flex-col items-center justify-center w-full h-full space-y-1
                ${currentView === item.id
                                ? 'text-indigo-600 dark:text-indigo-400'
                                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}
              `}
                    >
                        <item.icon className="w-6 h-6" />
                        <span className="text-xs font-medium">{item.label}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
};
