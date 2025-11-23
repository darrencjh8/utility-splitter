import { googleLogout } from '@react-oauth/google';



export interface GoogleUser {
    access_token: string;
    expires_in: number; // seconds
    token_type: string;
    scope: string;
    authuser: string;
    prompt: string;
}

export class GoogleSheetsService {
    private static accessToken: string | null = null;

    static setAccessToken(token: string) {
        this.accessToken = token;
        // Also save to sessionStorage for persistence across reloads
        sessionStorage.setItem('google_access_token', token);
    }

    static getAccessToken(): string | null {
        if (!this.accessToken) {
            this.accessToken = sessionStorage.getItem('google_access_token');
        }
        return this.accessToken;
    }

    static logout() {
        googleLogout();
        this.accessToken = null;
        sessionStorage.removeItem('google_access_token');
    }

    static async fetch(url: string, options: RequestInit = {}) {
        const token = this.getAccessToken();
        if (!token) throw new Error('No access token');

        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        const response = await fetch(url, { ...options, headers });

        if (response.status === 401) {
            // Token expired or invalid
            this.logout();
            throw new Error('Unauthorized');
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
            throw new Error(error.error?.message || 'API Error');
        }

        return response.json();
    }

    static async getSpreadsheet(spreadsheetId: string) {
        return this.fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`);
    }

    static async getValues(spreadsheetId: string, range: string) {
        return this.fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`);
    }

    static async batchGetValues(spreadsheetId: string, ranges: string[]) {
        const rangesParam = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
        return this.fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangesParam}`);
    }

    static async appendValues(spreadsheetId: string, range: string, values: any[][]) {
        return this.fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
            method: 'POST',
            body: JSON.stringify({
                values
            })
        });
    }

    static async updateValues(spreadsheetId: string, range: string, values: any[][]) {
        return this.fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
            method: 'PUT',
            body: JSON.stringify({
                values
            })
        });
    }

    static async clearValues(spreadsheetId: string, range: string) {
        return this.fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`, {
            method: 'POST'
        });
    }

    // Helper to create a new spreadsheet if needed
    static async createSpreadsheet(title: string) {
        return this.fetch('https://sheets.googleapis.com/v4/spreadsheets', {
            method: 'POST',
            body: JSON.stringify({
                properties: {
                    title
                },
                sheets: [
                    { properties: { title: 'Metadata' } },
                    { properties: { title: 'ManualBills' } }
                ]
            })
        });
    }

    static async listSpreadsheets() {
        // Requires https://www.googleapis.com/auth/drive.readonly scope
        const q = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
        return this.fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`);
    }
}
