
export class CryptoService {
    private static readonly ALGORITHM = 'AES-GCM';
    private static readonly KDF_ALGORITHM = 'PBKDF2';
    private static readonly HASH = 'SHA-256';
    private static readonly SALT_LENGTH = 16;
    private static readonly IV_LENGTH = 12;
    private static readonly ITERATIONS = 100000;

    /**
     * Encrypts a string using a password.
     * Returns a JSON string containing the encrypted data, salt, and IV.
     */
    static async encrypt(data: string, password: string): Promise<string> {
        const encoder = new TextEncoder();
        const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
        const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

        const key = await this.deriveKey(password, salt, ['encrypt']);
        const encodedData = encoder.encode(data);

        const encryptedContent = await crypto.subtle.encrypt(
            {
                name: this.ALGORITHM,
                iv: iv
            },
            key,
            encodedData
        );

        // Convert buffers to base64 for storage
        return JSON.stringify({
            data: this.arrayBufferToBase64(encryptedContent),
            salt: this.arrayBufferToBase64(salt),
            iv: this.arrayBufferToBase64(iv)
        });
    }

    /**
     * Decrypts a string using a password.
     * Expects the input format to match the output of encrypt().
     */
    static async decrypt(encryptedPackage: string | any, password: string): Promise<string> {
        try {
            const pkg = typeof encryptedPackage === 'string' ? JSON.parse(encryptedPackage) : encryptedPackage;
            const salt = this.base64ToArrayBuffer(pkg.salt);
            const iv = this.base64ToArrayBuffer(pkg.iv);
            const encryptedData = this.base64ToArrayBuffer(pkg.data);

            const key = await this.deriveKey(password, new Uint8Array(salt), ['decrypt']);

            const decryptedContent = await crypto.subtle.decrypt(
                {
                    name: this.ALGORITHM,
                    iv: new Uint8Array(iv)
                },
                key,
                encryptedData
            );

            const decoder = new TextDecoder();
            return decoder.decode(decryptedContent);
        } catch (error) {
            console.error('Decryption failed:', error);
            throw new Error('Invalid password or corrupted data');
        }
    }

    private static async deriveKey(password: string, salt: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: this.KDF_ALGORITHM },
            false,
            ['deriveBits', 'deriveKey']
        );

        return crypto.subtle.deriveKey(
            {
                name: this.KDF_ALGORITHM,
                salt: salt as any,
                iterations: this.ITERATIONS,
                hash: this.HASH
            },
            keyMaterial,
            { name: this.ALGORITHM, length: 256 },
            false,
            usage
        );
    }

    private static arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
        let binary = '';
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    private static base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binary_string = window.atob(base64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer as ArrayBuffer;
    }
}
