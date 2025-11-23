// Force rebuild
export interface Housemate {
    id: string;
    name: string;
    avatar?: string;
    email?: string;
    rowIndex?: number;
}

export type SplitMethod = 'equal' | 'percentage' | 'shares' | 'exact';

export interface Split {
    housemateId: string;
    amount: number; // Calculated amount
    share?: number; // Percentage or share count (if applicable)
}

export interface BillCategory {
    id: string;
    name: string;
}

// Fixed categories for ManualBills
export const MANUAL_BILL_CATEGORIES = [
    { id: 'household-item', name: 'Household Item' },
    { id: 'aircon-service', name: 'Aircon Service' },
    { id: 'moving-cost', name: 'Moving Cost' },
    { id: 'others', name: 'Others' }
] as const;

export interface BillType {
    id: string;
    title: string;
    amount: number;
    payerId: string;
    date: string;
    splitMethod: SplitMethod;
    splits: Split[];
    createdAt: string;
    billingMonth: string; // Format: YYYY-MM
    categoryId: string;
    type?: 'bill' | 'settlement';
}
