import React, { useState, useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';

interface PinEntryProps {
    mode: 'set' | 'enter';
    onSubmit: (pin: string) => void;
    error?: string | null;
    isLoading?: boolean;
}

export const PinEntry: React.FC<PinEntryProps> = ({ mode, onSubmit, error, isLoading }) => {
    const [pin, setPin] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pin.length >= 6) {
            onSubmit(pin);
        }
    };

    return (
        <div className="flex flex-col items-center w-full max-w-xs mx-auto">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-6">
                <Lock className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {mode === 'set' ? 'Set a PIN' : 'Enter PIN'}
            </h2>

            <p className="text-slate-600 dark:text-slate-300 mb-8 text-center text-sm">
                {mode === 'set'
                    ? 'Create a PIN (min 6 digits) to secure your login.'
                    : 'Enter your PIN to unlock your session.'}
            </p>

            {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm w-full text-center">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="w-full space-y-4">
                <div className="relative">
                    <input
                        ref={inputRef}
                        type="password"
                        value={pin}
                        onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setPin(val);
                        }}
                        placeholder="Enter 6+ digits"
                        className="w-full px-4 py-3 text-center text-2xl tracking-widest rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                        maxLength={12}
                        disabled={isLoading}
                    />
                </div>

                <button
                    type="submit"
                    disabled={pin.length < 6 || isLoading}
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                    {isLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        mode === 'set' ? 'Save PIN' : 'Unlock'
                    )}
                </button>
            </form>
        </div>
    );
};
