import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { HousemateManager } from './components/HousemateManager';
import { BillEntry } from './components/BillEntry';
import { HistoryPage } from './components/HistoryPage';
import { SyncStatus } from './components/SyncStatus';
import { LoginScreen } from './components/LoginScreen';
import { useStore } from './store/useStore';
import { AlertTriangle, RefreshCw } from 'lucide-react';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const {
    isLoading,
    isError,
    errorType,
    accessToken,
    spreadsheetId,
    setSheetId,
    handleLoginSuccess
  } = useStore();

  // Auto-retry logic for connection errors
  useEffect(() => {
    if (isError) {
      const hasRetried = sessionStorage.getItem('retry_attempted');
      if (!hasRetried) {
        sessionStorage.setItem('retry_attempted', 'true');
        window.location.reload();
      }
    } else if (accessToken && spreadsheetId && !isLoading) {
      // Successful session, clear the retry flag
      sessionStorage.removeItem('retry_attempted');
    }
  }, [isError, accessToken, spreadsheetId, isLoading]);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'housemates':
        return <HousemateManager />;
      case 'bills':
        return <BillEntry />;
      case 'history':
        return <HistoryPage />;
      default:
        return <Dashboard />;
    }
  };

  // 1. Auth Check
  if (!accessToken) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        onSpreadsheetIdSubmit={setSheetId}
      />
    );
  }

  // 2. Sheet Check
  if (!spreadsheetId) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        onSpreadsheetIdSubmit={setSheetId}
        initialToken={accessToken}
      />
    );
  }

  // 3. Loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading your data from Google Sheets...</p>
        </div>
      </div>
    );
  }

  // 4. Error
  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 transition-colors">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-8 text-center transition-colors">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            {errorType === 'AUTH' ? 'Authentication Failed' : 'Connection Error'}
          </h2>
          <p className="text-slate-600 dark:text-slate-300 mb-8">
            {errorType === 'AUTH'
              ? 'Your session has expired. Please sign in again.'
              : 'We couldn\'t connect to Google Sheets. Please check your internet connection.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {errorType === 'AUTH' ? 'Sign In Again' : 'Retry Connection'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <SyncStatus />
      <Layout currentView={currentView} onNavigate={setCurrentView}>
        {renderView()}
      </Layout>
    </div>
  );
}

export default App;
