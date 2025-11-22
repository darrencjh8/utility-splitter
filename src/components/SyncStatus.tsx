import React, { useState } from 'react';
import { Lock, Download, Upload, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';
import { PasswordProtection } from './PasswordProtection';

export const SyncStatus: React.FC = () => {
    const {
        encryptionKey,
        exportData,
        importData
    } = useStore();

    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    const handleExport = async () => {
        try {
            const data = await exportData();
            // Use explicit charset and application/json
            const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.setAttribute('download', `utility-splitter-backup-${new Date().toISOString().slice(0, 10)}.json`);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setStatusMessage('Export successful');
            setTimeout(() => setStatusMessage(''), 3000);
        } catch (e) {
            console.error(e);
            setStatusMessage('Export failed');
        }
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const content = event.target?.result as string;
                const success = await importData(content);
                if (success) {
                    setStatusMessage('Import successful');
                } else {
                    setStatusMessage('Invalid backup file');
                }
            } catch (e) {
                setStatusMessage('Import failed');
            }
            setTimeout(() => setStatusMessage(''), 3000);
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    };

    return (
        <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-6 py-2 flex items-center justify-between text-sm transition-colors">
            <div className="flex items-center gap-4">
                {encryptionKey ? (
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="w-4 h-4" />
                        <span className="font-medium">Encrypted Storage Active</span>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowPasswordModal(true)}
                        className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
                    >
                        <Lock className="w-4 h-4" />
                        <span>Enable Encryption</span>
                    </button>
                )}

                {statusMessage && (
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium animate-in fade-in slide-in-from-left-2">
                        {statusMessage}
                    </span>
                )}
            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
                    title="Export Backup"
                >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export</span>
                </button>

                <label className="flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span className="hidden sm:inline">Import</span>
                    <input
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        className="hidden"
                    />
                </label>
            </div>

            {showPasswordModal && (
                <PasswordProtection
                    isSetupMode={true}
                    onUnlock={() => setShowPasswordModal(false)}
                    onCancel={() => setShowPasswordModal(false)}
                />
            )}
        </div>
    );
};
