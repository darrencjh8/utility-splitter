import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Sidebar } from './Sidebar';
import { BottomTabs } from './BottomTabs';

interface LayoutProps {
    children: React.ReactNode;
    currentView: string;
    onNavigate: (view: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate }) => {
    const { isDarkMode, toggleDarkMode } = useStore();

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex transition-colors duration-200">
            {/* Sidebar (Desktop Only) */}
            <Sidebar
                currentView={currentView}
                onNavigate={onNavigate}
                isDarkMode={isDarkMode}
                toggleDarkMode={toggleDarkMode}
            />

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden pb-20 md:pb-0 md:pl-64">
                {/* Mobile Header */}
                <header className="md:hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between sticky top-0 z-30">
                    <h1 className="text-xl font-bold text-slate-800 dark:text-white">FairShare</h1>
                    <button
                        onClick={toggleDarkMode}
                        className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-5xl mx-auto">
                        {children}
                    </div>
                </div>
            </main>

            {/* Mobile Bottom Navigation */}
            <BottomTabs currentView={currentView} onNavigate={onNavigate} />
        </div>
    );
};
