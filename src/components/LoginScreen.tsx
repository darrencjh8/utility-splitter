import { useState, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { GoogleSheetsService } from '../services/GoogleSheetsService';
import { LogIn, FileSpreadsheet, Plus } from 'lucide-react';

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
            } else {
                // Fallback to manual entry without showing error unless it's critical
            }
        } finally {
            setIsLoadingSheets(false);
        }
    };

    const login = useGoogleLogin({
        onSuccess: (tokenResponse) => {
            console.log(tokenResponse);
            setToken(tokenResponse.access_token);
            GoogleSheetsService.setAccessToken(tokenResponse.access_token);
            onLoginSuccess(tokenResponse.access_token);
        },
        onError: () => setError('Login Failed'),
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly',
    });

    // Fetch sheets when token is available
    useEffect(() => {
        if (token) {
            fetchSpreadsheets();
        }
    }, [token]);

    const handleSheetSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (sheetId.trim()) {
            onSpreadsheetIdSubmit(sheetId.trim());
        }
    };

    const createNewSheet = async () => {
        setIsCreating(true);
        setError(null);
        try {
            const res = await GoogleSheetsService.createSpreadsheet('Utility Splitter Data');
            setSheetId(res.spreadsheetId);
            onSpreadsheetIdSubmit(res.spreadsheetId);
        } catch (e: any) {
            setError(e.message || 'Failed to create spreadsheet');
        } finally {
            setIsCreating(false);
        }
    };

    const handleSignOut = () => {
        GoogleSheetsService.logout();
        setToken(null);
        setSpreadsheets([]);
        setError(null);
    };

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 transition-colors">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-8 text-center transition-colors">
                    <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <LogIn className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Welcome Back</h2>
                    <p className="text-slate-600 dark:text-slate-300 mb-8">
                        Sign in with Google to access your utility bills and split them with your housemates.
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
                        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 bg-white rounded-full" />
                        Sign in with Google
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 transition-colors">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-8 text-center transition-colors">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileSpreadsheet className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Connect Spreadsheet</h2>
                <p className="text-slate-600 dark:text-slate-300 mb-8">
                    Select an existing Google Sheet or create a new one to store your data.
                </p>

                {error && (
                    <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                        {error}
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
                                Could not list spreadsheets. Try entering ID manually or <button type="button" onClick={handleSignOut} className="text-indigo-600 hover:underline">sign out</button> and sign in again.
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
};
