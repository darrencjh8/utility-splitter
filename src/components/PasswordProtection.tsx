import React, { useState } from 'react';
import { Lock, Unlock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';

interface PasswordProtectionProps {
    onUnlock: () => void;
    isSetupMode?: boolean;
    onCancel?: () => void;
}

export const PasswordProtection: React.FC<PasswordProtectionProps> = ({ onUnlock, isSetupMode = false, onCancel }) => {
    const { setPassword } = useStore();
    const [password, setPasswordInput] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [groupName, setGroupName] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const validatePassword = (pwd: string) => {
        if (pwd.length < 15) return "Password must be at least 15 characters long";
        if (!/[0-9]/.test(pwd)) return "Password must contain at least one number";
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) return "Password must contain at least one special character";
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (isSetupMode) {
                // Setup Mode: Validate and set key
                const validationError = validatePassword(password);
                if (validationError) {
                    setError(validationError);
                    setIsLoading(false);
                    return;
                }
                if (password !== confirmPassword) {
                    setError("Passwords do not match");
                    setIsLoading(false);
                    return;
                }

                if (!groupName.trim()) {
                    setError("Group Name is required");
                    setIsLoading(false);
                    return;
                }

                // Save key and re-encrypt data
                await setPassword(password, groupName, true);
                onUnlock();
            } else {
                // Unlock Mode: Just set the password in memory/storage
                // The store will use this to try and decrypt data on next load or immediately

                // We can try to "verify" by calling setPassword. 
                // If it fails (throws), we show error.
                // However, setPassword in useStore currently reloads the page if locked.
                // So we just call it. If it's wrong, the page reload will result in 'ERROR' state in App.
                // But we want to avoid full reload if possible?
                // Actually, useStore's setPassword triggers a reload if isLocked is true.
                // So the user will see a reload, then the Error screen if wrong.
                // This is acceptable for now as per plan.

                await setPassword(password);
                onUnlock();
            }
        } catch (e) {
            setError("An error occurred");
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 transition-colors">
                <div className="bg-indigo-600 p-6 text-center">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                        {isSetupMode ? (
                            <ShieldCheck className="w-8 h-8 text-white" />
                        ) : (
                            <Lock className="w-8 h-8 text-white" />
                        )}
                    </div>
                    <h2 className="text-2xl font-bold text-white">
                        {isSetupMode ? "Encrypt Your Data" : "Unlock Data"}
                    </h2>
                    <p className="text-indigo-100 mt-2 text-sm">
                        {isSetupMode
                            ? "Set a strong password to encrypt your local data."
                            : "Enter your password to access your encrypted data."}
                    </p>
                </div>

                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-start gap-3 text-sm text-red-600 dark:text-red-400">
                                <AlertTriangle className="w-5 h-5 shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}

                        {isSetupMode && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Group Name (Tenant ID)
                                </label>
                                <input
                                    type="text"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Enter a unique group name"
                                    autoFocus
                                />
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    This will be used to identify your shared data.
                                </p>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                placeholder="Enter your secure password"
                                autoFocus={!isSetupMode}
                            />
                        </div>

                        {isSetupMode && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Confirm Password
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Re-enter your password"
                                />
                                <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                                    <p className={password.length >= 15 ? "text-emerald-600 dark:text-emerald-400" : ""}>• At least 15 characters</p>
                                    <p className={/[0-9]/.test(password) ? "text-emerald-600 dark:text-emerald-400" : ""}>• At least one number</p>
                                    <p className={/[!@#$%^&*(),.?":{}|<>]/.test(password) ? "text-emerald-600 dark:text-emerald-400" : ""}>• At least one special character</p>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || !password}
                            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    {isSetupMode ? <ShieldCheck className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                                    {isSetupMode ? "Encrypt Data" : "Unlock"}
                                </>
                            )}
                        </button>

                        {onCancel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="w-full py-3 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
};
