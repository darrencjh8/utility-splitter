import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { Housemate, BillType, BillCategory } from '../types';
import { MANUAL_BILL_CATEGORIES } from '../types';
import { GoogleSheetsService } from '../services/GoogleSheetsService';

const BILLS_SHEET = 'ManualBills';
const PAID_BILLS_SHEET = 'PaidBills';
const BILL_HISTORIES_SHEET = 'BillHistories';
const BILL_STATUS_SHEET = 'BillStatus';
const HOUSEMATES_SHEET = 'Housemates';

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
    billCategories: [...MANUAL_BILL_CATEGORIES],
    balances: {},
    availableYears: [new Date().getFullYear().toString()],
};

interface StoreContextType {
    isLoading: boolean;
    isError: boolean;
    errorType: 'API' | 'AUTH' | null;
    spreadsheetId: string | null;
    accessToken: string | null;
    housemates: Housemate[];
    billHistories: BillType[];
    billCategories: BillCategory[];
    balances: Record<string, number>;
    availableYears: string[];
    currentYear: string;
    monthStatus: Record<string, any>;
    setSheetId: (id: string) => void;
    handleLoginSuccess: (token: string) => void;
    addBill: (bill: BillType) => Promise<void>;
    addManualBill: (month: string, vendor: string, amounts: number[]) => Promise<void>;
    addHousemate: (housemate: Housemate) => void;
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
    isSyncing: boolean;
    syncData: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | null>(null);

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [errorType, setErrorType] = useState<'API' | 'AUTH' | null>(null);
    const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => localStorage.getItem('spreadsheet_id'));
    const [accessToken, setAccessToken] = useState<string | null>(() => sessionStorage.getItem('google_access_token'));
    const [isSyncing, setIsSyncing] = useState(false);

    const isLoaded = useRef(false);

    const [data, setData] = useState<StoreData>(() => {
        const saved = localStorage.getItem('store_data');
        return saved ? JSON.parse(saved) : {
            meta: initialMeta,
            currentYear: new Date().getFullYear().toString(),
            currentBills: [],
            monthStatus: {}
        };
    });

    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem('dark_mode');
        if (saved) return JSON.parse(saved);
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
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
                            payerId: name, // Assuming header name matches housemate ID/Name
                            date: month, // Use month string as date for now, or parse it
                            splitMethod: 'equal',
                            splits: [],
                            createdAt: new Date().toISOString(),
                            billingMonth: month,
                            categoryId: vendor, // Use vendor name as category
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
        // Row: [Timestamp, Month, Category, Description, Amount, ?, Status, ID]
        return rows.map((row, index): BillType | null => {
            try {
                // Skip header if present (check if Amount is number)
                const amount = Number(row[4]);
                if (isNaN(amount)) {
                    console.warn(`Row ${index} skipped: Invalid amount`, row);
                    return null;
                }

                return {
                    id: row[7],
                    title: row[2],
                    amount: amount,
                    payerId: 'SYSTEM', // Default payer for system bills
                    date: row[0],
                    splitMethod: 'equal', // Default
                    splits: [], // Default
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

    // Helper to format bill to sheet row
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

    const loadData = useCallback(async (sheetId: string, silent: boolean = false) => {
        if (!GoogleSheetsService.getAccessToken()) return;

        if (!silent) setIsLoading(true);
        try {
            // 0. Fetch Spreadsheet Metadata to see which sheets exist
            const spreadsheet = await GoogleSheetsService.getSpreadsheet(sheetId);
            const existingSheets = new Set(spreadsheet.sheets?.map((s: any) => s.properties.title) || []);

            // Define ranges based on existence (no longer loading Metadata sheet)
            const rangesToFetch: string[] = [];
            if (existingSheets.has(BILLS_SHEET)) rangesToFetch.push(`${BILLS_SHEET}!A:K`);
            if (existingSheets.has(PAID_BILLS_SHEET)) rangesToFetch.push(`${PAID_BILLS_SHEET}!A:F`);
            if (existingSheets.has(BILL_HISTORIES_SHEET)) rangesToFetch.push(`${BILL_HISTORIES_SHEET}!A:H`);
            if (existingSheets.has(BILL_STATUS_SHEET)) rangesToFetch.push(`${BILL_STATUS_SHEET}!A:D`);
            if (existingSheets.has(HOUSEMATES_SHEET)) rangesToFetch.push(`${HOUSEMATES_SHEET}!A:A`);

            if (rangesToFetch.length === 0) {
                setIsLoading(false);
                return;
            }

            const response = await GoogleSheetsService.batchGetValues(sheetId, rangesToFetch);
            const valueRanges = response.valueRanges || [];

            // Helper to find values for a specific sheet
            const getValuesForSheet = (sheetName: string) => {
                const range = valueRanges.find((r: any) => r.range.startsWith(`'${sheetName}'`) || r.range.startsWith(sheetName));
                return range ? range.values : [];
            };

            // 1. Parse Housemates from Housemates Sheet
            const splitRows = getValuesForSheet(HOUSEMATES_SHEET) || [];
            const housemates: Housemate[] = [];
            // Row 0 is header: Name
            // Data starts at Row 1 (index 1) -> Sheet Row 2
            splitRows.forEach((row: string[], index: number) => {
                if (index === 0) return; // Skip header
                if (row[0]) {
                    housemates.push({
                        id: row[0], // Name as ID for now
                        name: row[0],
                        email: '',
                        avatar: '',
                        rowIndex: index + 1 // 1-based index for sheet (Row 1 is header, so index 1 is Row 2)
                    });
                }
            });

            // Initialize meta with housemates and fixed categories
            const meta: StoreMeta = {
                housemates,
                billCategories: [...MANUAL_BILL_CATEGORIES],
                balances: {},
                availableYears: []
            };

            // 2. Parse PaidBills to augment Housemates (Legacy check, maybe not needed if BillSplits is source of truth)
            const paidBillsRows = getValuesForSheet(PAID_BILLS_SHEET) || [];
            const paidHousemates = new Set<string>();
            paidBillsRows.forEach((row: string[], index: number) => {
                if (index === 0) return; // Skip header
                if (row[2]) paidHousemates.add(row[2]);
            });

            // Merge with existing housemates (Only if not in BillSplits - maybe warn or add?)
            // For now, let's assume BillSplits is authoritative. If PaidBills has someone not in BillSplits, they are "legacy" or "removed".
            // We won't auto-add them to BillSplits to avoid clutter, but maybe we should show them?
            // Let's stick to BillSplits as the source.
            const existingNames = new Set(meta.housemates.map(h => h.name));

            // 3. Parse BillHistories to augment Categories and Bills
            const historyRows = getValuesForSheet(BILL_HISTORIES_SHEET) || [];
            const historyBills = parseHistoryBills(historyRows);

            // Extract categories from history
            const historyCategories = new Set<string>();
            historyBills.forEach(b => historyCategories.add(b.categoryId));

            const existingCategories = new Set(meta.billCategories.map(c => c.name));
            historyCategories.forEach(catName => {
                if (!existingCategories.has(catName)) {
                    meta.billCategories.push({ id: catName, name: catName });
                    existingCategories.add(catName);
                }
            });

            // 4. Parse ManualBills
            const manualRows = getValuesForSheet(BILLS_SHEET) || [];
            const manualBills = parseManualBills(manualRows);

            // Extract housemates from ManualBills headers
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
                // Row: [Date, Status, Received, Pending]
                monthStatus[row[0]] = {
                    status: row[1],
                    received: JSON.parse(row[2] || '[]'),
                    pending: JSON.parse(row[3] || '[]')
                };
            });

            // Combine Bills
            const allBills = [...historyBills, ...manualBills];

            // Helper to extract year from billingMonth (handles "October 2023", "11/1/2022", etc.)
            const getYearFromMonth = (raw: string): string => {
                if (!raw) return '';
                try {
                    const date = new Date(raw);
                    if (!isNaN(date.getTime())) {
                        return date.getFullYear().toString();
                    }
                    // Fallback for "Month Year" if Date parsing fails (though Date usually handles it)
                    const parts = raw.split(' ');
                    if (parts.length === 2 && !isNaN(Number(parts[1]))) {
                        return parts[1];
                    }
                } catch (e) {
                    console.warn('Failed to parse year from month:', raw);
                }
                return '';
            };

            // Extract available years from all bills
            const yearsSet = new Set<string>();
            allBills.forEach(b => {
                const y = getYearFromMonth(b.billingMonth);
                if (y) yearsSet.add(y);
            });
            const availableYears = Array.from(yearsSet).sort().reverse(); // Newest first

            // Filter for current year
            const currentYear = new Date().getFullYear().toString();
            // If currentYear is not in availableYears, default to the latest available year
            let activeYear = currentYear;
            if (availableYears.length > 0 && !availableYears.includes(activeYear)) {
                activeYear = availableYears[0];
            }

            const currentBills = allBills.filter(b => getYearFromMonth(b.billingMonth) === activeYear);

            // Update meta with available years
            meta.availableYears = availableYears.length > 0 ? availableYears : [new Date().getFullYear().toString()];

            setData({
                meta,
                currentYear: activeYear,
                currentBills,
                monthStatus
            });

            isLoaded.current = true;
            setIsError(false);
        } catch (e: any) {
            console.error("Load failed", e);
            setIsError(true);
            setErrorType('API');
            if (e.message === 'Unauthorized') {
                setErrorType('AUTH');
                setAccessToken(null);
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    const syncData = useCallback(async () => {
        if (!spreadsheetId || !accessToken) return;
        setIsSyncing(true);
        try {
            await loadData(spreadsheetId, true);
        } finally {
            setIsSyncing(false);
        }
    }, [spreadsheetId, accessToken, loadData]);

    useEffect(() => {
        if (accessToken && spreadsheetId) {
            // OPTIMIZATION: Check if we already have data in local storage
            const hasLocalData = data.currentBills.length > 0 || data.meta.housemates.length > 0;

            if (!hasLocalData) {
                // Only fetch if local storage is empty
                loadData(spreadsheetId);
            } else {
                // If we have data, just stop loading
                setIsLoading(false);
            }
        } else {
            setIsLoading(false);
        }
    }, [accessToken, spreadsheetId, loadData]); // data is intentionally omitted to avoid loops, logic depends on initial state

    // Persistence Effect
    useEffect(() => {
        localStorage.setItem('store_data', JSON.stringify(data));
    }, [data]);

    // Dark Mode Effect
    useEffect(() => {
        localStorage.setItem('dark_mode', JSON.stringify(isDarkMode));
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);

    // Periodic Sync Effect
    useEffect(() => {
        const interval = setInterval(() => {
            if (spreadsheetId && accessToken && !isSyncing) {
                console.log('Auto-syncing...');
                syncData();
            }
        }, 60000 * 10); // 10 minutes
        return () => clearInterval(interval);
    }, [spreadsheetId, accessToken, isSyncing, syncData]);

    // Meta is now only stored in localStorage, no longer synced to sheets
    // Removed saveMeta function as we don't write to Metadata sheet anymore

    const addBill = async (bill: BillType) => {
        if (!spreadsheetId) return;

        setData(prev => {
            // Optimistic update
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
            // No longer saving meta to sheets
            // saveMeta(newMeta);

            return {
                ...prev,
                meta: newMeta,
                currentBills: [...prev.currentBills, bill]
            };
        });

        // Write bill to sheet
        await GoogleSheetsService.appendValues(spreadsheetId, BILLS_SHEET, [formatBill(bill)]);
    };

    const addManualBill = async (month: string, vendor: string, amounts: number[]) => {
        if (!spreadsheetId) return;

        // Create row: [Month, Vendor, ...amounts for each housemate]
        const row = [month, vendor, ...amounts.map(a => a.toString())];

        // Append to ManualBills sheet
        await GoogleSheetsService.appendValues(spreadsheetId, BILLS_SHEET, [row]);

        // Refresh data to get updated bills
        await loadData(spreadsheetId);
    };

    const setSheetId = (id: string) => {
        setSpreadsheetId(id);
        localStorage.setItem('spreadsheet_id', id);
    };

    const handleLoginSuccess = (token: string) => {
        setAccessToken(token);
    };

    const addHousemate = async (housemate: Housemate) => {
        if (!spreadsheetId) return;

        // Append to Housemates
        // Columns: Name
        const row = [housemate.name];
        await GoogleSheetsService.appendValues(spreadsheetId, HOUSEMATES_SHEET, [row]);

        // Refresh data to get the new row index and ensure consistency
        await loadData(spreadsheetId);
    };

    const updateHousemate = async (id: string, name: string) => {
        if (!spreadsheetId) return;
        const housemate = data.meta.housemates.find(h => h.id === id);
        if (!housemate || !housemate.rowIndex) return;

        // Update Housemates at specific row
        // Range: Housemates!A{rowIndex}:A{rowIndex}
        // Note: rowIndex is 1-based.
        const range = `${HOUSEMATES_SHEET}!A${housemate.rowIndex}:A${housemate.rowIndex}`; // Update Name only for now
        await GoogleSheetsService.updateValues(spreadsheetId, range, [[name]]);

        await loadData(spreadsheetId);
    };

    const removeHousemate = async (id: string) => {
        if (!spreadsheetId) return;
        const housemate = data.meta.housemates.find(h => h.id === id);
        if (!housemate || !housemate.rowIndex) return;

        // Clear the row in Housemates
        // Range: Housemates!A{rowIndex}:Z{rowIndex}
        const range = `${HOUSEMATES_SHEET}!A${housemate.rowIndex}:Z${housemate.rowIndex}`;
        await GoogleSheetsService.clearValues(spreadsheetId, range);

        await loadData(spreadsheetId);
    };

    const value: StoreContextType = {
        isLoading,
        isError,
        errorType,
        spreadsheetId,
        accessToken,
        housemates: data.meta.housemates,
        billHistories: data.currentBills,
        billCategories: data.meta.billCategories,
        balances: data.meta.balances,
        availableYears: data.meta.availableYears,
        currentYear: data.currentYear,
        monthStatus: data.monthStatus,
        setSheetId,
        handleLoginSuccess,
        addBill,
        addManualBill,
        addHousemate,
        // Expose other actions as no-ops or implement them
        loadYear: async (_year: string) => { },
        removeHousemate,
        updateHousemate,
        deleteBill: (_id: string) => { },
        updateBill: (_bill: BillType) => { },
        addBillCategory: (_category: BillCategory) => { },
        deleteBillCategory: (_id: string) => { },
        updateBillCategory: (_id: string, _name: string) => { },
        exportData: async () => "",
        importData: async (_json: string) => false,
        isDarkMode,
        toggleDarkMode: () => setIsDarkMode((prev: boolean) => !prev),
        isSyncing,
        syncData,
    };

    return (
        <StoreContext.Provider value={value}>
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
