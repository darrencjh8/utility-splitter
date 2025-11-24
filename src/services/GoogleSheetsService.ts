import { googleLogout } from '@react-oauth/google';
import * as jose from 'jose';

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
    private static serviceAccountKey: any | null = null;
    private static tokenExpiration: number | null = null;

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
        this.serviceAccountKey = null;
        this.tokenExpiration = null;
        sessionStorage.removeItem('google_access_token');
        localStorage.removeItem('service_account_key'); // Clear encrypted key on logout
    }

    static async fetch(url: string, options: RequestInit = {}) {
        // Auto-refresh token if using Service Account
        if (this.serviceAccountKey && this.tokenExpiration && Date.now() > this.tokenExpiration - 60000) {
            await this.refreshServiceAccountToken();
        }

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
            // If we have a service account, try to refresh once
            if (this.serviceAccountKey) {
                try {
                    await this.refreshServiceAccountToken();
                    // Retry original request
                    const newToken = this.getAccessToken();
                    const newHeaders = {
                        ...options.headers,
                        'Authorization': `Bearer ${newToken}`,
                        'Content-Type': 'application/json',
                    };
                    return (await fetch(url, { ...options, headers: newHeaders })).json();
                } catch (e) {
                    this.logout();
                    throw new Error('Unauthorized');
                }
            } else {
                this.logout();
                throw new Error('Unauthorized');
            }
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
            throw new Error(error.error?.message || 'API Error');
        }

        return response.json();
    }

    // --- Service Account Logic ---

    static async loginWithServiceAccount(credentials: any) {
        this.serviceAccountKey = credentials;
        await this.refreshServiceAccountToken();
    }

    static async refreshServiceAccountToken() {
        if (!this.serviceAccountKey) throw new Error('No service account credentials');

        try {
            const alg = 'RS256';
            // Sanitize private key: ensure newlines are correctly formatted
            const rawKey = this.serviceAccountKey.private_key;
            const privateKeyString = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;

            const privateKey = await jose.importPKCS8(privateKeyString, alg);

            const jwt = await new jose.SignJWT({
                scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly'
            })
                .setProtectedHeader({ alg })
                .setIssuer(this.serviceAccountKey.client_email)
                .setSubject(this.serviceAccountKey.client_email)
                .setAudience('https://oauth2.googleapis.com/token')
                .setIssuedAt()
                .setExpirationTime('1h')
                .sign(privateKey);

            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    assertion: jwt
                })
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Failed to exchange JWT for token: ${response.status} ${errorBody}`);
            }

            const data = await response.json();
            this.setAccessToken(data.access_token);
            this.tokenExpiration = Date.now() + (data.expires_in * 1000);
        } catch (e) {
            console.error('Service Account Login Failed', e);
            throw e;
        }
    }

    // --- AppConfig & Setup Logic ---

    static async checkAppConfig(spreadsheetId: string): Promise<{ status: 'setup_needed' | 'ready', key?: any }> {
        try {
            // 1. Check if AppConfig sheet exists
            const spreadsheet = await this.getSpreadsheet(spreadsheetId);
            const configSheet = spreadsheet.sheets?.find((s: any) => s.properties.title === 'AppConfig');

            if (!configSheet) {
                // Create it
                await this.addSheet(spreadsheetId, 'AppConfig');
                // Write instructions
                await this.updateValues(spreadsheetId, 'AppConfig!A1', [['Paste your Service Account JSON in cell A2 (This cell)']]);
                return { status: 'setup_needed' };
            }

            // 2. Read A2
            const response = await this.getValues(spreadsheetId, 'AppConfig!A2');
            const values = response.values;

            if (!values || !values[0] || !values[0][0]) {
                return { status: 'setup_needed' };
            }

            const keyString = values[0][0];
            try {
                const key = JSON.parse(keyString);
                if (key.private_key && key.client_email) {
                    return { status: 'ready', key };
                }
            } catch (e) {
                console.warn('Invalid JSON in AppConfig');
            }

            return { status: 'setup_needed' };

        } catch (e) {
            console.error('Check AppConfig failed', e);
            return { status: 'setup_needed' };
        }
    }

    static async addSheet(spreadsheetId: string, title: string) {
        return this.fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
            method: 'POST',
            body: JSON.stringify({
                requests: [{
                    addSheet: {
                        properties: { title }
                    }
                }]
            })
        });
    }

    // --- Encryption Logic ---

    private static async deriveKey(pin: string): Promise<jose.JWK> {
        // Hash the PIN to get a consistent 32-byte (256-bit) key
        const encoder = new TextEncoder();
        const data = encoder.encode(pin);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);

        // Convert to Base64URL for JWK 'k' parameter
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashString = String.fromCharCode.apply(null, hashArray);
        const base64 = btoa(hashString);
        const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        return {
            k: base64url,
            alg: 'A256KW',
            kty: 'oct'
        };
    }

    static async encryptKey(key: any, pin: string): Promise<string> {
        const jwk = await this.deriveKey(pin);
        const secret = await jose.importJWK(jwk);

        const jwe = await new jose.CompactEncrypt(
            new TextEncoder().encode(JSON.stringify(key))
        )
            .setProtectedHeader({ alg: 'A256KW', enc: 'A256GCM' })
            .encrypt(secret);
        return jwe;
    }

    static async decryptKey(jwe: string, pin: string): Promise<any> {
        try {
            const jwk = await this.deriveKey(pin);
            const secret = await jose.importJWK(jwk);

            const { plaintext } = await jose.compactDecrypt(jwe, secret);
            return JSON.parse(new TextDecoder().decode(plaintext));
        } catch (e) {
            console.error('Decryption failed', e);
            throw new Error('Invalid PIN');
        }
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
                    { properties: { title: 'ManualBills' } },
                    { properties: { title: 'AppConfig' } } // Create AppConfig by default too
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
