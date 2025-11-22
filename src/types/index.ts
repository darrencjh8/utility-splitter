// Force rebuild
export interface Housemate {
    id: string;
    name: string;
    avatar?: string;
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
    isDefault?: boolean;
}

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
