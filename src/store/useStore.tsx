import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import type { Housemate, BillType, BillCategory } from '../types';
import { GoogleSheetsService } from '../services/GoogleSheetsService';

const META_SHEET = 'Metadata';
const BILLS_SHEET = 'ManualBills';
const PAID_BILLS_SHEET = 'PaidBills';
const BILL_HISTORIES_SHEET = 'BillHistories';
const BILL_STATUS_SHEET = 'BillStatus';
const CACHE_KEY = 'white_quasar_data';
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface StoreMeta {
    housemates: Housemate[];
    billCategories: BillCategory[];
    balances: Record<string, number>;
    availableYears: string[];
}

interface StoreData {
    meta: StoreMeta;
    currentYear: string;
    currentBills: BillType[];
    monthStatus: Record<string, any>;
}

const initialMeta: StoreMeta = {
    housemates: [],
    billCategories: [
        { id: '1', name: 'Utilities', isDefault: true },
        { id: '2', name: 'Rent', isDefault: true },
        { id: '3', name: 'Internet', isDefault: true },
        { id: '4', name: 'Groceries', isDefault: true },
        { id: '5', name: 'Other', isDefault: true },
    ],
    balances: {},
    availableYears: [new Date().getFullYear().toString()],
};

const initialData: StoreData = {
    meta: initialMeta,
    currentYear: new Date().getFullYear().toString(),
    currentBills: [],
    monthStatus: {}
};

interface StoreContextType {
    isLoading: boolean;
    isSyncing: boolean;
    isError: boolean;
    errorType: 'API' | 'AUTH' | null;
    spreadsheetId: string | null;
    accessToken: string | null;
    housemates: Housemate[];
    bills: BillType[];
    billCategories: BillCategory[];
    balances: Record<string, number>;
    availableYears: string[];
    currentYear: string;
    monthStatus: Record<string, any>;
    setSheetId: (id: string) => void;
    handleLoginSuccess: (token: string) => void;
    addBill: (bill: BillType) => Promise<void>;
    addHousemate: (housemate: Housemate) => void;
    syncData: () => Promise<void>;
    loadYear: (year: string) => Promise<void>;
    removeHousemate: (id: string) => void;
    updateHousemate: (id: string, name: string) => void;
    deleteBill: (id: string) => void;
    updateBill: (bill: BillType) => void;
    addBillCategory: (category: BillCategory) => void;
    deleteBillCategory: (id: string) => void;
    updateBillCategory: (id: string, name: string) => void;
    exportData: () => Promise<string>;
    importData: (json: string) => Promise<boolean>;
    isDarkMode: boolean;
    toggleDarkMode: () => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isError, setIsError] = useState(false);
    const [errorType, setErrorType] = useState<'API' | 'AUTH' | null>(null);
    const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => localStorage.getItem('spreadsheet_id'));
    const [accessToken, setAccessToken] = useState<string | null>(() => sessionStorage.getItem('google_access_token'));

    const [data, setData] = useState<StoreData>(() => {
        const cached = localStorage.getItem(CACHE_KEY);
        return cached ? JSON.parse(cached) : initialData;
    });

    // Helper to parse bills from ManualBills sheet
    const parseManualBills = (rows: any[][]): BillType[] => {
        if (!rows || rows.length < 2) return [];

        const headers = rows[0];
        const housemateNames = headers.slice(2); // Columns 2+ are housemates
        const bills: BillType[] = [];

        rows.slice(1).forEach((row, rowIndex) => {
            try {
                const month = row[0];
                const vendor = row[1];

                housemateNames.forEach((name: string, colIndex: number) => {
                    const amountStr = row[colIndex + 2];
                    if (!amountStr) return;

                    const amount = Number(amountStr);
                    if (!isNaN(amount) && amount > 0) {
                        bills.push({
                            id: `manual-${rowIndex}-${colIndex}-${Date.now()}`,
                            title: vendor,
                            amount: amount,
                            payerId: name,
                            date: month,
                            splitMethod: 'equal',
                            splits: [],
                            createdAt: new Date().toISOString(),
                            billingMonth: month,
                            categoryId: '5', // Default to 'Other'
                            type: 'bill'
                        });
                    }
                });
            } catch (e) {
                console.error('Failed to parse manual bill row', row, e);
            }
        });

        return bills;
    };

    // Helper to parse bills from BillHistories sheet
    const parseHistoryBills = (rows: any[][]): BillType[] => {
        if (!rows || rows.length === 0) return [];
        return rows.map((row, index): BillType | null => {
            try {
                const amount = Number(row[4]);
                if (isNaN(amount)) {
                    console.warn(`Row ${index} skipped: Invalid amount`, row);
                    return null;
                }

                return {
                    id: row[7] || `hist-${Math.random()}`,
                    title: row[3],
                    amount: amount,
                    payerId: 'SYSTEM',
                    date: row[0],
                    splitMethod: 'equal',
                    splits: [],
                    createdAt: row[0],
                    billingMonth: row[1],
                    categoryId: row[2],
                    type: 'bill' as const
                };
            } catch (e) {
                console.error('Failed to parse history bill row', row, e);
                return null;
            }
        }).filter((b): b is BillType => b !== null);
    };

    const formatBill = (bill: BillType): any[] => {
        return [
            bill.id,
            bill.title,
            bill.amount,
            bill.payerId,
            bill.date,
            bill.splitMethod,
            JSON.stringify(bill.splits),
            bill.createdAt,
            bill.billingMonth,
            bill.categoryId,
            bill.type || 'bill'
        ];
    };

    const syncData = useCallback(async () => {
        if (!accessToken || !spreadsheetId) return;

        setIsSyncing(true);
        try {
            const spreadsheet = await GoogleSheetsService.getSpreadsheet(spreadsheetId);
            const existingSheets = new Set(spreadsheet.sheets?.map((s: any) => s.properties.title) || []);

            const rangesToFetch: string[] = [];
            if (existingSheets.has(META_SHEET)) rangesToFetch.push(`${META_SHEET}!A:B`);
            if (existingSheets.has(BILLS_SHEET)) rangesToFetch.push(`${BILLS_SHEET}!A:K`);
            if (existingSheets.has(PAID_BILLS_SHEET)) rangesToFetch.push(`${PAID_BILLS_SHEET}!A:F`);
            if (existingSheets.has(BILL_HISTORIES_SHEET)) rangesToFetch.push(`${BILL_HISTORIES_SHEET}!A:H`);
            if (existingSheets.has(BILL_STATUS_SHEET)) rangesToFetch.push(`${BILL_STATUS_SHEET}!A:D`);

            if (rangesToFetch.length === 0) {
                setIsSyncing(false);
                return;
            }

            const response = await GoogleSheetsService.batchGetValues(spreadsheetId, rangesToFetch);
            const valueRanges = response.valueRanges || [];

            const getValuesForSheet = (sheetName: string) => {
                const range = valueRanges.find((r: any) => r.range.startsWith(`'${sheetName}'`) || r.range.startsWith(sheetName));
                return range ? range.values : [];
            };

            // 1. Parse Metadata
            const metaRows = getValuesForSheet(META_SHEET) || [];
            const meta: StoreMeta = { ...initialMeta };
            metaRows.forEach((row: string[]) => {
                try {
                    if (row[0] === 'housemates') meta.housemates = JSON.parse(row[1]);
                    if (row[0] === 'billCategories') meta.billCategories = JSON.parse(row[1]);
                    if (row[0] === 'balances') meta.balances = JSON.parse(row[1]);
                    if (row[0] === 'availableYears') meta.availableYears = JSON.parse(row[1]);
                } catch (e) { console.error('Error parsing meta', e); }
            });

            // Filter out SYSTEM from categories
            meta.billCategories = meta.billCategories.filter(c => c.name !== 'SYSTEM');

            // 2. Parse PaidBills
            const paidBillsRows = getValuesForSheet(PAID_BILLS_SHEET) || [];
            const paidHousemates = new Set<string>();
            paidBillsRows.forEach((row: string[], index: number) => {
                if (index === 0) return;
                if (row[2]) paidHousemates.add(row[2]);
            });

            const existingNames = new Set(meta.housemates.map(h => h.name));
            paidHousemates.forEach(name => {
                if (!existingNames.has(name)) {
                    meta.housemates.push({ id: name, name, avatar: '' });
                    existingNames.add(name);
                }
            });

            // 3. Parse BillHistories
            const historyRows = getValuesForSheet(BILL_HISTORIES_SHEET) || [];
            const historyBills = parseHistoryBills(historyRows);

            const historyCategories = new Set<string>();
            historyBills.forEach(b => historyCategories.add(b.categoryId));

            const existingCategories = new Set(meta.billCategories.map(c => c.name));
            historyCategories.forEach(catName => {
                if (catName !== 'SYSTEM' && !existingCategories.has(catName)) {
                    meta.billCategories.push({ id: catName, name: catName });
                    existingCategories.add(catName);
                }
            });

            // 4. Parse ManualBills
            const manualRows = getValuesForSheet(BILLS_SHEET) || [];
            const manualBills = parseManualBills(manualRows);

            if (manualRows.length > 0) {
                const manualHeaders = manualRows[0];
                const manualNames = manualHeaders.slice(2);
                manualNames.forEach((name: string) => {
                    if (name && !existingNames.has(name)) {
                        meta.housemates.push({ id: name, name, avatar: '' });
                        existingNames.add(name);
                    }
                });
            }

            // 5. Parse BillStatus
            const statusRows = getValuesForSheet(BILL_STATUS_SHEET) || [];
            const monthStatus: Record<string, any> = {};
            statusRows.forEach((row: string[], index: number) => {
                if (index === 0) return;
                monthStatus[row[0]] = {
                    status: row[1],
                    received: JSON.parse(row[2] || '[]'),
                    pending: JSON.parse(row[3] || '[]')
                };
            });

            const allBills = [...historyBills, ...manualBills];

            const getYearFromMonth = (raw: string): string => {
                if (!raw) return '';
                try {
                    const date = new Date(raw);
                    if (!isNaN(date.getTime())) return date.getFullYear().toString();
                    const parts = raw.split(' ');
                    if (parts.length === 2 && !isNaN(Number(parts[1]))) return parts[1];
                } catch (e) { }
                return '';
            };

            const yearsSet = new Set<string>();
            allBills.forEach(b => {
                const y = getYearFromMonth(b.billingMonth);
                if (y) yearsSet.add(y);
            });
            const availableYears = Array.from(yearsSet).sort().reverse();

            const currentYear = new Date().getFullYear().toString();
            let activeYear = currentYear;
            if (availableYears.length > 0 && !availableYears.includes(activeYear)) {
                activeYear = availableYears[0];
            }

            const currentBills = allBills.filter(b => getYearFromMonth(b.billingMonth) === activeYear);
            meta.availableYears = availableYears.length > 0 ? availableYears : [currentYear];

            const newData = {
                meta,
                currentYear: activeYear,
                currentBills,
                monthStatus
            };

            setData(newData);
            localStorage.setItem(CACHE_KEY, JSON.stringify(newData));
            setIsError(false);
        } catch (e: any) {
            console.error("Sync failed", e);
            setIsError(true);
            setErrorType('API');
            if (e.message === 'Unauthorized') {
                setErrorType('AUTH');
                setAccessToken(null);
            }
        } finally {
            setIsSyncing(false);
            setIsLoading(false);
        }
    }, [accessToken, spreadsheetId]);

    // Initial load and periodic sync
    useEffect(() => {
        if (accessToken && spreadsheetId) {
            // If we have cached data, we're not "loading" in the blocking sense
            if (data.meta.housemates.length > 0) {
                setIsLoading(false);
            }

            syncData(); // Initial sync

            const interval = setInterval(syncData, SYNC_INTERVAL);
            return () => clearInterval(interval);
        } else {
            setIsLoading(false);
        }
    }, [accessToken, spreadsheetId, syncData]);

    const saveMeta = async (newMeta: StoreMeta) => {
        if (!spreadsheetId) return;
        const rows = [
            ['housemates', JSON.stringify(newMeta.housemates)],
            ['billCategories', JSON.stringify(newMeta.billCategories)],
            ['balances', JSON.stringify(newMeta.balances)],
            ['availableYears', JSON.stringify(newMeta.availableYears)]
        ];
        await GoogleSheetsService.updateValues(spreadsheetId, `${META_SHEET}!A:B`, rows);
    };

    const addBill = async (bill: BillType) => {
        if (!spreadsheetId) return;

        setData(prev => {
            const newBalances = { ...prev.meta.balances };
            if (newBalances[bill.payerId] === undefined) newBalances[bill.payerId] = 0;
            newBalances[bill.payerId] += bill.amount;
            bill.splits.forEach(split => {
                if (newBalances[split.housemateId] === undefined) newBalances[split.housemateId] = 0;
                newBalances[split.housemateId] -= split.amount;
            });

            const billYear = new Date(bill.date).getFullYear().toString();
            const newAvailableYears = prev.meta.availableYears.includes(billYear)
                ? prev.meta.availableYears
                : [...prev.meta.availableYears, billYear].sort();

            const newMeta = { ...prev.meta, balances: newBalances, availableYears: newAvailableYears };
            const newBills = [bill, ...prev.currentBills];
            const newData = { ...prev, meta: newMeta, currentBills: newBills };

            localStorage.setItem(CACHE_KEY, JSON.stringify(newData));
            return newData;
        });

        saveMeta(data.meta); // Note: using state here might be stale, but optimistic update handles UI
        GoogleSheetsService.appendValues(spreadsheetId, BILLS_SHEET, [formatBill(bill)]);
    };

    const setSheetId = (id: string) => {
        setSpreadsheetId(id);
        localStorage.setItem('spreadsheet_id', id);
    };

    const handleLoginSuccess = (token: string) => {
        setAccessToken(token);
    };

    const addHousemate = (housemate: Housemate) => {
        setData(prev => {
            const newState = {
                ...prev,
                meta: {
                    ...prev.meta,
                    housemates: [...prev.meta.housemates, housemate],
                    balances: { ...prev.meta.balances, [housemate.id]: 0 }
                }
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(newState));
            saveMeta(newState.meta);
            return newState;
        });
    };

    const value: StoreContextType = {
        isLoading,
        isSyncing,
        isError,
        errorType,
        spreadsheetId,
        accessToken,
        housemates: data.meta.housemates,
        bills: data.currentBills,
        billCategories: data.meta.billCategories,
        balances: data.meta.balances,
        availableYears: data.meta.availableYears,
        currentYear: data.currentYear,
        monthStatus: data.monthStatus,
        setSheetId,
        handleLoginSuccess,
        addBill,
        addHousemate,
        syncData,
        loadYear: async () => { },
        removeHousemate: () => { },
        updateHousemate: () => { },
        deleteBill: () => { },
        updateBill: () => { },
        addBillCategory: () => { },
        deleteBillCategory: () => { },
        updateBillCategory: () => { },
        exportData: async () => "",
        importData: async () => false,
        isDarkMode: false,
        toggleDarkMode: () => { },
    };

    return (
        <StoreContext.Provider value={value} >
            {children}
        </StoreContext.Provider>
    );
};

export const useStore = () => {
    const context = useContext(StoreContext);
    if (!context) {
        throw new Error('useStore must be used within a StoreProvider');
    }
    return context;
};
