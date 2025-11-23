import React from 'react';
import { Cloud, CloudOff, ExternalLink, RefreshCw } from 'lucide-react';
import { useStore } from '../store/useStore';

export const SyncStatus: React.FC = () => {
    const {
        spreadsheetId,
        accessToken,
        isError,
        isSyncing,
        syncData
    } = useStore();

    if (!accessToken || !spreadsheetId) return null;

    const openSheet = () => {
        window.open(`https://docs.google.com/spreadsheets/d/${spreadsheetId}`, '_blank');
    };

    const handleSync = () => {
        syncData();
    };

    return (
        <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-6 py-2 flex items-center justify-between text-sm transition-colors">
            <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 ${isError ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {isError ? <CloudOff className="w-4 h-4" /> : <Cloud className="w-4 h-4" />}
                    <span className="font-medium">
                        {isError ? 'Connection Error' : isSyncing ? 'Syncing...' : 'Synced with Google Sheets'}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Sync Now"
                >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{isSyncing ? 'Syncing' : 'Sync'}</span>
                </button>
                <button
                    onClick={openSheet}
                    className="flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
                    title="Open in Google Sheets"
                >
                    <ExternalLink className="w-4 h-4" />
                    <span className="hidden sm:inline">Open Sheet</span>
                </button>
            </div>
        </div>
    );
};
