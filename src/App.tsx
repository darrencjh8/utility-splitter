import { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { HousemateManager } from './components/HousemateManager';
import { BillEntry } from './components/BillEntry';
import { HistoryPage } from './components/HistoryPage';
import { SyncStatus } from './components/SyncStatus';
import { PasswordProtection } from './components/PasswordProtection';
import { useStore } from './store/useStore';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const { isLoading, isLocked, isError, isSetupRequired } = useStore();

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading your data...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 transition-colors">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-8 text-center transition-colors">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Decryption Failed</h2>
          <p className="text-slate-600 dark:text-slate-300 mb-8">
            We couldn't decrypt your data. This usually happens if the wrong password was entered or the data is corrupted.
            <br /><br />
            Your data is safe and has <strong>NOT</strong> been overwritten.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                localStorage.removeItem('utility-splitter-password');
                window.location.reload();
              }}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            <button
              onClick={() => {
                if (confirm("WARNING: This will DELETE ALL your data. This action cannot be undone. Are you sure?")) {
                  localStorage.clear();
                  window.location.reload();
                }
              }}
              className="w-full bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 py-3 rounded-xl font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Reset All Data
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {isSetupRequired && (
        <PasswordProtection
          isSetupMode={true}
          onUnlock={() => {
            // Store handles reload/setup completion
          }}
        />
      )}

      {isLocked && (
        <PasswordProtection
          onUnlock={() => {
            // The store handles reload/unlock logic
          }}
        />
      )}

      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
        <SyncStatus />
        <Layout currentView={currentView} onNavigate={setCurrentView}>
          {renderView()}
        </Layout>
      </div>
    </>
  );
}

export default App;
