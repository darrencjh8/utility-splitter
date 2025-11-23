import { test, expect } from '@playwright/test';

test('smoke test', async ({ page }) => {
    // 1. Load the application
    await page.goto('/');

    // 2. Initial Setup (Password/Tenant ID)
    // Check if we are in setup mode (Group Name input exists)
    const groupNameInput = page.getByPlaceholder('Enter a unique group name');

    // If group name input is visible, we are in setup mode
    if (await groupNameInput.isVisible()) {
        await groupNameInput.fill('test-tenant-id');
        await page.getByPlaceholder('Enter your secure password').fill('Password123!@#');
        await page.getByPlaceholder('Re-enter your password').fill('Password123!@#');
        await page.getByRole('button', { name: 'Encrypt Data' }).click();
    } else {
        // If not in setup mode, we might be locked or already logged in
        // Try to unlock if locked
        const unlockButton = page.getByRole('button', { name: 'Unlock' });
        if (await unlockButton.isVisible()) {
            await page.getByPlaceholder('Enter your secure password').fill('Password123!@#');
            await unlockButton.click();
        }
    }

    // 3. Verify dashboard loads
    await expect(page.getByText('Current Balance')).toBeVisible({ timeout: 10000 });

    // 4. Add a sample bill
    // Navigate to Bills
    await page.getByRole('button', { name: 'Bills' }).click();

    // Fill bill form
    await page.getByPlaceholder('e.g. March Electricity').fill('Test Bill');
    await page.getByPlaceholder('0.00').fill('100');

    // Check if we need to add housemates
    await page.getByRole('button', { name: 'Housemates' }).click();

    // Add Alice if not exists
    await page.getByPlaceholder('Enter name').fill('Alice');
    await page.getByRole('button', { name: 'Add' }).click();

    await page.getByPlaceholder('Enter name').fill('Bob');
    await page.getByRole('button', { name: 'Add' }).click();

    // Go back to Bills
    await page.getByRole('button', { name: 'Bills' }).click();

    await page.getByPlaceholder('e.g. March Electricity').fill('Test Electricity');
    await page.getByPlaceholder('0.00').fill('50');

    // Select Payer (Alice)
    await page.locator('label:has-text("Paid By") + select').selectOption({ label: 'Alice' });

    // Click Record Bill
    await page.getByRole('button', { name: 'Record Bill' }).click();

    // 5. Verify bill appears in the list
    await expect(page.getByText('Test Electricity')).toBeVisible();
    await expect(page.getByText('$50.00')).toBeVisible();
});
