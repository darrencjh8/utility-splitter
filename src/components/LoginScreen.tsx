import { useState, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { GoogleSheetsService } from '../services/GoogleSheetsService';
import { LogIn, FileSpreadsheet, Plus, AlertTriangle } from 'lucide-react';
import { PinEntry } from './PinEntry';

interface LoginScreenProps {
    onLoginSuccess: (token: string) => void;
    onSpreadsheetIdSubmit: (id: string) => void;
    initialToken?: string | null;
}

export const LoginScreen = ({ onLoginSuccess, onSpreadsheetIdSubmit, initialToken }: LoginScreenProps) => {
    const [token, setToken] = useState<string | null>(initialToken || null);
    const [sheetId, setSheetId] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [spreadsheets, setSpreadsheets] = useState<{ id: string, name: string }[]>([]);
    const [isLoadingSheets, setIsLoadingSheets] = useState(false);

    // New State for Hybrid Auth
    const [authStep, setAuthStep] = useState<'oauth' | 'sheet_select' | 'pin_setup' | 'pin_entry' | 'loading'>('loading');
    const [encryptedKey, setEncryptedKey] = useState<string | null>(null);
    const [serviceAccountKey, setServiceAccountKey] = useState<any | null>(null);

    // 1. Initial Check: Do we have an encrypted key?
    useEffect(() => {
        const storedKey = localStorage.getItem('service_account_key');
        const storedSheetId = localStorage.getItem('spreadsheet_id');

        if (storedKey && storedSheetId) {
            setEncryptedKey(storedKey);
            setSheetId(storedSheetId);
            setAuthStep('pin_entry');
        } else {
            setAuthStep('oauth');
        }
    }, []);

    const fetchSpreadsheets = async () => {
        setIsLoadingSheets(true);
        try {
            const res = await GoogleSheetsService.listSpreadsheets();
            if (res.files) {
                setSpreadsheets(res.files);
            }
        } catch (e: any) {
            console.error("Failed to list spreadsheets", e);
            if (e.message === 'Unauthorized' || e.message?.includes('insufficient permissions') || e.message?.includes('403')) {
                setError('Permission denied. Please sign out and sign in again to grant access.');
            }
        } finally {
            setIsLoadingSheets(false);
        }
    };

    const login = useGoogleLogin({
        onSuccess: (tokenResponse) => {
            setToken(tokenResponse.access_token);
            GoogleSheetsService.setAccessToken(tokenResponse.access_token);
            setAuthStep('sheet_select');
        },
        onError: () => setError('Login Failed'),
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly',
    });

    // Fetch sheets when token is available and we are in sheet selection mode
    useEffect(() => {
        if (token && authStep === 'sheet_select') {
            fetchSpreadsheets();
        }
    }, [token, authStep]);

    const handleSheetSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sheetId.trim()) return;

        const id = sheetId.trim();
        setSheetId(id);

        // Check for AppConfig
        setAuthStep('loading');
        try {
            const config = await GoogleSheetsService.checkAppConfig(id);
            if (config.status === 'ready' && config.key) {
                setServiceAccountKey(config.key);
                setAuthStep('pin_setup');
            } else {
                // Setup needed
                setError('⚠️ Setup Required. Please check the AppConfig sheet in your spreadsheet for instructions.');
                setAuthStep('sheet_select'); // Go back to allow retry
            }
        } catch (e) {
            setError('Failed to check configuration.');
            setAuthStep('sheet_select');
        }
    };

    const createNewSheet = async () => {
        setIsCreating(true);
        setError(null);
        try {
            const res = await GoogleSheetsService.createSpreadsheet('Utility Splitter Data');
            setSheetId(res.spreadsheetId);

            // After create, check config (it will be empty but created)
            const config = await GoogleSheetsService.checkAppConfig(res.spreadsheetId);
            if (config.status === 'setup_needed') {
                setError('⚠️ Setup Required. A new spreadsheet was created. Please check the AppConfig sheet for instructions.');
                setAuthStep('sheet_select');
            }
        } catch (e: any) {
            setError(e.message || 'Failed to create spreadsheet');
        } finally {
            setIsCreating(false);
        }
    };

    const handlePinSet = async (pin: string) => {
        if (!serviceAccountKey) return;
        setAuthStep('loading');
        try {
            const jwe = await GoogleSheetsService.encryptKey(serviceAccountKey, pin);
            localStorage.setItem('service_account_key', jwe);
            localStorage.setItem('spreadsheet_id', sheetId);

            // Login immediately
            await GoogleSheetsService.loginWithServiceAccount(serviceAccountKey);
            onSpreadsheetIdSubmit(sheetId);
            onLoginSuccess('service-account'); // Dummy token, service handles auth internally
        } catch (e: any) {
            console.error('Pin Set Error:', e);
            setError(`Failed to secure key: ${e.message || 'Unknown error'}`);
            setAuthStep('pin_setup');
        }
    };

    const handlePinUnlock = async (pin: string) => {
        if (!encryptedKey) return;
        setAuthStep('loading');
        try {
            const key = await GoogleSheetsService.decryptKey(encryptedKey, pin);
            await GoogleSheetsService.loginWithServiceAccount(key);
            onSpreadsheetIdSubmit(sheetId);
            onLoginSuccess('service-account');
        } catch (e) {
            setError('Incorrect PIN');
            setAuthStep('pin_entry');
        }
    };

    const handleSignOut = () => {
        GoogleSheetsService.logout();
        setToken(null);
        setSpreadsheets([]);
        setError(null);
        setAuthStep('oauth');
        setEncryptedKey(null);
    };

    const handleReset = () => {
        if (window.confirm('This will remove the stored key from this device. You will need to sign in with Google again. Continue?')) {
            handleSignOut();
        }
    };

    // --- RENDER ---

    if (authStep === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors">
                <div className="w-12 h-12 border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (authStep === 'pin_entry') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 transition-colors">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-8 transition-colors relative">
                    <PinEntry mode="enter" onSubmit={handlePinUnlock} error={error} />
                    <button onClick={handleReset} className="mt-6 text-xs text-slate-400 hover:text-red-500 w-full text-center transition-colors">
                        Forgot PIN or want to reset?
                    </button>
                </div>
            </div>
        );
    }

    if (authStep === 'pin_setup') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 transition-colors">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-8 transition-colors">
                    <PinEntry mode="set" onSubmit={handlePinSet} error={error} />
                </div>
            </div>
        );
    }

    if (authStep === 'sheet_select') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 transition-colors">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-8 text-center transition-colors">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FileSpreadsheet className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Connect Spreadsheet</h2>

                    {error && (
                        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-lg text-sm flex items-start gap-2 text-left">
                            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSheetSubmit} className="flex flex-col gap-4">
                        {isLoadingSheets ? (
                            <div className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 text-center">
                                Loading spreadsheets...
                            </div>
                        ) : spreadsheets.length > 0 ? (
                            <select
                                value={sheetId}
                                onChange={(e) => setSheetId(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors appearance-none"
                            >
                                <option value="">Select a spreadsheet...</option>
                                {spreadsheets.map(sheet => (
                                    <option key={sheet.id} value={sheet.id}>{sheet.name}</option>
                                ))}
                            </select>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <input
                                    type="text"
                                    value={sheetId}
                                    onChange={(e) => setSheetId(e.target.value)}
                                    placeholder="Spreadsheet ID"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                                />
                                <p className="text-xs text-slate-500 text-center">
                                    Could not list spreadsheets. Try entering ID manually.
                                </p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!sheetId.trim()}
                            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Connect
                        </button>
                    </form>

                    <div className="my-6 flex items-center gap-4">
                        <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                        <span className="text-slate-400 text-sm">OR</span>
                        <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={createNewSheet}
                            disabled={isCreating}
                            className="w-full bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 py-3 rounded-xl font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex items-center justify-center gap-2"
                        >
                            {isCreating ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <Plus className="w-4 h-4" />
                            )}
                            Create New Spreadsheet
                        </button>

                        <button
                            onClick={handleSignOut}
                            className="w-full text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 py-2 text-sm transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Default: OAuth Login
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 transition-colors">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-8 text-center transition-colors">
                <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <LogIn className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Welcome Back</h2>
                <p className="text-slate-600 dark:text-slate-300 mb-8">
                    Sign in with Google to access your utility bills.
                </p>

                {error && (
                    <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <button
                    onClick={() => login()}
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                    Sign in with Google
                </button>
            </div>
        </div>
    );
};
