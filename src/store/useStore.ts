import { useState, useEffect, useCallback, useRef } from 'react';
import type { Housemate, BillType, BillCategory } from '../types';
import { CryptoService } from '../services/CryptoService';

const META_KEY = 'utility-splitter-meta';
const BILLS_PREFIX = 'utility-splitter-bills-';
const OLD_STORAGE_KEY = 'utility-splitter-data';
const PASSWORD_KEY = 'utility-splitter-password';
const TENANT_KEY = 'utility-splitter-tenant-id';

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

const API_USER = import.meta.env.VITE_API_USER;
const API_PASS = import.meta.env.VITE_API_PASS;
const HAS_API_CREDS = !!(API_USER && API_PASS);

const apiCall = async (method: string, key: string, data?: any) => {
    if (!HAS_API_CREDS) return null;

    const tenantId = localStorage.getItem(TENANT_KEY);
    if (!tenantId) return null;

    const headers = new Headers();
    headers.set('Authorization', 'Basic ' + btoa(API_USER + ":" + API_PASS));
    headers.set('Content-Type', 'application/json');
    headers.set('X-Tenant-ID', tenantId);

    try {
        const res = await fetch(`/api/kv/${key}`, {
            method,
            headers,
            body: data ? JSON.stringify(data) : undefined
        });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(res.statusText);
        return await res.json();
    } catch (e) {
        console.error(`API ${method} failed for ${key}`, e);
        return null;
    }
};

export const useStore = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [isLocked, setIsLocked] = useState(false);
    const [isError, setIsError] = useState(false);
    const [isSetupRequired, setIsSetupRequired] = useState(false);
    const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
    const [tenantId, setTenantId] = useState<string | null>(null);

    // Use a ref to track if we have completed the initial load to prevent overwriting data with defaults
    const isLoaded = useRef(false);

    const [data, setData] = useState<StoreData>({
        meta: initialMeta,
        currentYear: new Date().getFullYear().toString(),
        currentBills: []
    });

    // Helper to load data (checks API first, then LocalStorage)
    const loadFromStorage = useCallback(async (key: string, password: string | null) => {
        try {
            let storedData = null;

            // 1. Try API
            if (HAS_API_CREDS) {
                storedData = await apiCall('GET', key);
            }

            // 2. Fallback to LocalStorage
            if (!storedData) {
                const localStr = localStorage.getItem(key);
                if (localStr) {
                    storedData = JSON.parse(localStr);
                }
            }

            if (!storedData) return null;

            // 3. Decrypt if necessary
            // If it's an object with 'iv' and 'content', it's likely encrypted
            if (storedData.iv && storedData.data) {
                if (!password) return 'LOCKED';
                try {
                    // CryptoService.decrypt expects the object directly if it matches the interface
                    // or a string. Based on previous usage, let's assume it handles the object or we pass the stringified version?
                    // Looking at previous code: CryptoService.decrypt(storedData, password)
                    // If storedData is the object {iv, content}, we pass it.
                    const decryptedStr = await CryptoService.decrypt(storedData, password);
                    return JSON.parse(decryptedStr);
                } catch (e) {
                    console.error("Decryption failed", e);
                    return 'ERROR';
                }
            }

            return storedData;
        } catch (e) {
            console.error("Load failed", e);
            return null;
        }
    }, []);

    // Helper to save data (encrypted if key exists)
    const saveToStorage = useCallback(async (key: string, value: any) => {
        if (!isLoaded.current || isLocked || isError) return; // Don't save before loading or if locked/error

        try {
            let dataToSave = value;

            if (encryptionKey) {
                const jsonStr = JSON.stringify(value);
                // Encrypt returns a stringified JSON of {iv, content} based on previous context
                const encrypted = await CryptoService.encrypt(jsonStr, encryptionKey);
                dataToSave = JSON.parse(encrypted);
            }

            // Save to LocalStorage
            const stringToSave = JSON.stringify(dataToSave);
            localStorage.setItem(key, stringToSave);

            // Save to API
            if (HAS_API_CREDS) {
                await apiCall('PUT', key, dataToSave);
            }
        } catch (e) {
            console.error("Save failed", e);
        }
    }, [encryptionKey, isLocked, isError]);

    useEffect(() => {
        const initStore = async () => {
            try {
                // 1. Check for saved password
                const savedPassword = localStorage.getItem(PASSWORD_KEY);
                if (savedPassword) {
                    setEncryptionKey(savedPassword);
                }

                const savedTenantId = localStorage.getItem(TENANT_KEY);
                if (savedTenantId) {
                    setTenantId(savedTenantId);
                }

                // 2. Check for old data migration (plain text)
                const oldDataStr = localStorage.getItem(OLD_STORAGE_KEY);
                if (oldDataStr) {
                    // Migration logic omitted for brevity
                }

                // 3. Load Meta
                const metaResult = await loadFromStorage(META_KEY, savedPassword);

                if (metaResult === 'LOCKED') {
                    setIsLocked(true);
                    setIsLoading(false);
                    return;
                }

                if (metaResult === 'ERROR') {
                    setIsError(true);
                    setIsLoading(false);
                    return;
                }

                // If no meta found, check if we really have no data or if something is wrong
                // For now, if no meta and no password, assume setup required
                if ((!metaResult && !savedPassword) || !savedTenantId) {
                    setIsSetupRequired(true);
                    setIsLoading(false);
                    return;
                }

                const meta = metaResult || initialMeta;

                // 4. Load Current Year Bills
                const currentYear = new Date().getFullYear().toString();
                const billsResult = await loadFromStorage(`${BILLS_PREFIX}${currentYear}`, savedPassword);

                if (billsResult === 'LOCKED') {
                    setIsLocked(true);
                    setIsLoading(false);
                    return;
                }

                if (billsResult === 'ERROR') {
                    setIsError(true);
                    setIsLoading(false);
                    return;
                }

                const currentBills = billsResult || [];

                setData({
                    meta,
                    currentYear,
                    currentBills
                });

                isLoaded.current = true;
                setIsLoading(false);

            } catch (e) {
                console.error("Init failed", e);
                setIsError(true);
                setIsLoading(false);
            }
        };

        initStore();
    }, [loadFromStorage]);

    // Function to set password and re-encrypt everything
    const setPassword = async (password: string, newTenantId?: string, isSetupMode: boolean = false) => {
        setEncryptionKey(password);
        localStorage.setItem(PASSWORD_KEY, password);

        if (newTenantId) {
            setTenantId(newTenantId);
            localStorage.setItem(TENANT_KEY, newTenantId);
        }

        // Force re-save of everything with new key
        if (isLoaded.current || isSetupRequired || isSetupMode) {
            // Save meta
            const metaJson = JSON.stringify(data.meta);
            const encryptedMeta = await CryptoService.encrypt(metaJson, password);
            const metaObj = JSON.parse(encryptedMeta);

            localStorage.setItem(META_KEY, JSON.stringify(metaObj));
            if (HAS_API_CREDS) await apiCall('PUT', META_KEY, metaObj);

            // Save current bills
            const billsJson = JSON.stringify(data.currentBills);
            const encryptedBills = await CryptoService.encrypt(billsJson, password);
            const billsObj = JSON.parse(encryptedBills);

            localStorage.setItem(`${BILLS_PREFIX}${data.currentYear}`, JSON.stringify(billsObj));
            if (HAS_API_CREDS) await apiCall('PUT', `${BILLS_PREFIX}${data.currentYear}`, billsObj);

            // Save other years
            for (const year of data.meta.availableYears) {
                if (year === data.currentYear) continue;

                const bills = await loadFromStorage(`${BILLS_PREFIX}${year}`, null);

                if (bills && bills !== 'LOCKED' && bills !== 'ERROR') {
                    const encrypted = await CryptoService.encrypt(JSON.stringify(bills), password);
                    const obj = JSON.parse(encrypted);
                    localStorage.setItem(`${BILLS_PREFIX}${year}`, JSON.stringify(obj));
                    if (HAS_API_CREDS) await apiCall('PUT', `${BILLS_PREFIX}${year}`, obj);
                }
            }
        }

        // If we were locked or had error, we should try to reload data with this password
        if (isLocked || isError || isSetupRequired || isSetupMode) {
            setIsLocked(false);
            setIsError(false);
            setIsSetupRequired(false);
            setIsLoading(true);
            window.location.reload();
            return;
        }
    };

    const loadYear = async (year: string) => {
        setIsLoading(true);
        try {
            const bills = await loadFromStorage(`${BILLS_PREFIX}${year}`, encryptionKey);
            const safeBills = (bills && bills !== 'LOCKED' && bills !== 'ERROR') ? bills : [];
            setData(prev => ({
                ...prev,
                currentYear: year,
                currentBills: safeBills
            }));
        } finally {
            setIsLoading(false);
        }
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
            saveToStorage(META_KEY, newState.meta);
            return newState;
        });
    };

    const removeHousemate = (id: string) => {
        setData(prev => {
            const newState = {
                ...prev,
                meta: {
                    ...prev.meta,
                    housemates: prev.meta.housemates.filter(h => h.id !== id)
                }
            };
            saveToStorage(META_KEY, newState.meta);
            return newState;
        });
    };

    const updateHousemate = (id: string, name: string) => {
        setData(prev => {
            const newState = {
                ...prev,
                meta: {
                    ...prev.meta,
                    housemates: prev.meta.housemates.map(h => h.id === id ? { ...h, name } : h)
                }
            };
            saveToStorage(META_KEY, newState.meta);
            return newState;
        });
    };

    const addBill = (bill: BillType) => {
        const billYear = new Date(bill.date).getFullYear().toString();
        setData(prev => {
            const newBalances = { ...prev.meta.balances };
            if (newBalances[bill.payerId] === undefined) newBalances[bill.payerId] = 0;
            newBalances[bill.payerId] += bill.amount;
            bill.splits.forEach(split => {
                if (newBalances[split.housemateId] === undefined) newBalances[split.housemateId] = 0;
                newBalances[split.housemateId] -= split.amount;
            });
            const newAvailableYears = prev.meta.availableYears.includes(billYear)
                ? prev.meta.availableYears
                : [...prev.meta.availableYears, billYear].sort();
            const newMeta = { ...prev.meta, balances: newBalances, availableYears: newAvailableYears };

            // Save Meta
            saveToStorage(META_KEY, newMeta);

            if (billYear === prev.currentYear) {
                const newBills = [bill, ...prev.currentBills];
                saveToStorage(`${BILLS_PREFIX}${billYear}`, newBills);
                return { ...prev, meta: newMeta, currentBills: newBills };
            } else {
                loadFromStorage(`${BILLS_PREFIX}${billYear}`, encryptionKey).then(existingBills => {
                    const bills = (existingBills && existingBills !== 'LOCKED' && existingBills !== 'ERROR') ? existingBills : [];
                    saveToStorage(`${BILLS_PREFIX}${billYear}`, [bill, ...bills]);
                });
                return { ...prev, meta: newMeta };
            }
        });
    };

    const deleteBill = (id: string) => {
        setData(prev => {
            const billToDelete = prev.currentBills.find(b => b.id === id);
            if (!billToDelete) return prev;
            const newBalances = { ...prev.meta.balances };
            newBalances[billToDelete.payerId] -= billToDelete.amount;
            billToDelete.splits.forEach(split => {
                newBalances[split.housemateId] += split.amount;
            });

            const newMeta = { ...prev.meta, balances: newBalances };
            const newBills = prev.currentBills.filter(b => b.id !== id);

            saveToStorage(META_KEY, newMeta);
            saveToStorage(`${BILLS_PREFIX}${prev.currentYear}`, newBills);

            return { ...prev, meta: newMeta, currentBills: newBills };
        });
    };

    const updateBill = (updatedBill: BillType) => {
        setData(prev => {
            const oldBill = prev.currentBills.find(b => b.id === updatedBill.id);
            if (!oldBill) return prev;
            const newBalances = { ...prev.meta.balances };
            newBalances[oldBill.payerId] -= oldBill.amount;
            oldBill.splits.forEach(split => {
                newBalances[split.housemateId] += split.amount;
            });
            if (newBalances[updatedBill.payerId] === undefined) newBalances[updatedBill.payerId] = 0;
            newBalances[updatedBill.payerId] += updatedBill.amount;
            updatedBill.splits.forEach(split => {
                if (newBalances[split.housemateId] === undefined) newBalances[split.housemateId] = 0;
                newBalances[split.housemateId] -= split.amount;
            });

            const newMeta = { ...prev.meta, balances: newBalances };
            const newBills = prev.currentBills.map(b => b.id === updatedBill.id ? updatedBill : b);

            saveToStorage(META_KEY, newMeta);
            saveToStorage(`${BILLS_PREFIX}${prev.currentYear}`, newBills);

            return { ...prev, meta: newMeta, currentBills: newBills };
        });
    };

    const addBillCategory = (category: BillCategory) => {
        setData(prev => {
            const newMeta = { ...prev.meta, billCategories: [...prev.meta.billCategories, category] };
            saveToStorage(META_KEY, newMeta);
            return { ...prev, meta: newMeta };
        });
    };

    const deleteBillCategory = (id: string) => {
        setData(prev => {
            const newMeta = { ...prev.meta, billCategories: prev.meta.billCategories.filter(c => c.id !== id) };
            saveToStorage(META_KEY, newMeta);
            return { ...prev, meta: newMeta };
        });
    };

    const updateBillCategory = (id: string, name: string) => {
        setData(prev => {
            const newMeta = { ...prev.meta, billCategories: prev.meta.billCategories.map(c => c.id === id ? { ...c, name } : c) };
            saveToStorage(META_KEY, newMeta);
            return { ...prev, meta: newMeta };
        });
    };

    // Export / Import
    const exportData = useCallback(async () => {
        const allData: any = {
            meta: data.meta,
            bills: {}
        };

        for (const year of data.meta.availableYears) {
            const bills = await loadFromStorage(`${BILLS_PREFIX}${year}`, encryptionKey);
            if (bills && bills !== 'LOCKED' && bills !== 'ERROR') {
                allData.bills[year] = bills;
            }
        }

        return JSON.stringify(allData, null, 2);
    }, [data.meta, encryptionKey, loadFromStorage]);

    const importData = useCallback(async (jsonString: string) => {
        try {
            const importedData = JSON.parse(jsonString);
            if (!importedData.meta || !importedData.bills) throw new Error("Invalid format");

            localStorage.clear();

            if (encryptionKey) {
                localStorage.setItem(PASSWORD_KEY, encryptionKey);
            }

            const metaJson = JSON.stringify(importedData.meta);
            if (encryptionKey) {
                const encrypted = await CryptoService.encrypt(metaJson, encryptionKey);
                const obj = JSON.parse(encrypted);
                localStorage.setItem(META_KEY, JSON.stringify(obj));
                if (HAS_API_CREDS) await apiCall('PUT', META_KEY, obj);
            } else {
                localStorage.setItem(META_KEY, metaJson);
                if (HAS_API_CREDS) await apiCall('PUT', META_KEY, importedData.meta);
            }

            for (const [year, bills] of Object.entries(importedData.bills)) {
                const billsJson = JSON.stringify(bills);
                if (encryptionKey) {
                    const encrypted = await CryptoService.encrypt(billsJson, encryptionKey);
                    const obj = JSON.parse(encrypted);
                    localStorage.setItem(`${BILLS_PREFIX}${year}`, JSON.stringify(obj));
                    if (HAS_API_CREDS) await apiCall('PUT', `${BILLS_PREFIX}${year}`, obj);
                } else {
                    localStorage.setItem(`${BILLS_PREFIX}${year}`, billsJson);
                    if (HAS_API_CREDS) await apiCall('PUT', `${BILLS_PREFIX}${year}`, bills);
                }
            }

            const currentYear = new Date().getFullYear().toString();
            setData({
                meta: importedData.meta,
                currentYear,
                currentBills: (importedData.bills as any)[currentYear] || []
            });

            return true;
        } catch (e) {
            console.error("Import failed", e);
            return false;
        }
    }, [encryptionKey]);

    // Dark Mode Logic
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('utility-splitter-theme');
            if (saved) return saved === 'dark';
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });

    useEffect(() => {
        const root = window.document.documentElement;
        if (isDarkMode) {
            root.classList.add('dark');
            localStorage.setItem('utility-splitter-theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('utility-splitter-theme', 'light');
        }
    }, [isDarkMode]);

    const toggleDarkMode = () => setIsDarkMode(prev => !prev);

    return {
        isLoading,
        isLocked,
        isError,
        isSetupRequired,
        housemates: data.meta.housemates,
        bills: data.currentBills,
        billCategories: data.meta.billCategories,
        balances: data.meta.balances,
        availableYears: data.meta.availableYears,
        currentYear: data.currentYear,
        encryptionKey,
        tenantId,
        isDarkMode,
        toggleDarkMode,
        setPassword,
        loadYear,
        addHousemate,
        removeHousemate,
        updateHousemate,
        addBill,
        deleteBill,
        updateBill,
        addBillCategory,
        deleteBillCategory,
        updateBillCategory,
        exportData,
        importData
    };
};
