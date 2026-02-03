import { test, expect } from '@playwright/test';

test.describe('Página de Conversas', () => {
  test('carrega layout básico e controles', async ({ page }) => {
    await page.goto('/conversations');
    await expect(page.getByText('Conversas')).toBeVisible();
    await expect(page.getByPlaceholder('Buscar por número')).toBeVisible();
    await expect(page.getByText('Ordenação:')).toBeVisible();
    await expect(page.getByRole('button', { name: 'A–Z' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Recentes' })).toBeVisible();
    await expect(page.getByText('Itens/página:')).toBeVisible();
  });

  test('altera ordenação e mantém página', async ({ page }) => {
    await page.goto('/conversations');
    await page.getByRole('button', { name: 'Recentes' }).click();
    await expect(page.getByRole('button', { name: 'Recentes' })).toHaveClass(/bg-primary\/10/);
  });

  test('marca filtro apenas texto', async ({ page }) => {
    await page.goto('/conversations');
    const checkbox = page.getByLabel('Apenas mensagens com texto');
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });
});
