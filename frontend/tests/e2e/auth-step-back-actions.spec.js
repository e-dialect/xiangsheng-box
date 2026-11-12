import { expect, test } from '@playwright/test';
import { stableScreenshot } from './helpers/stableScreenshot';
import {
  horizontalOverflow,
  installVisualFixture,
  observeRuntime,
  openVisualRoute,
} from './helpers/visualReviewFixture';

const viewports = [
  { width: 390, height: 844, theme: 'light' },
  { width: 390, height: 844, theme: 'dark' },
  { width: 844, height: 390, theme: 'light' },
  { width: 768, height: 1024, theme: 'light' },
  { width: 1440, height: 900, theme: 'dark' },
];

async function mockForgetJourney(page) {
  await page.route('http://localhost:8000/login/forget*', async (route) => {
    await route.fulfill({
      status: 200,
      json: { email_masked: 'c***@example.com' },
    });
  });
}

function fieldInput(page, label) {
  return page.locator('.base-field')
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator('input.uni-input-input');
}

async function openRegisterContactStep(page) {
  await openVisualRoute(page, '/pages/login/register');
  await fieldInput(page, '用户名').fill('collector');
  await fieldInput(page, '密码').fill('password123');
  await fieldInput(page, '确认密码').fill('password123');
  await page.getByRole('button', { name: '继续验证邮箱' }).click();
  await expect(page.getByText('确认你的联络方式')).toBeVisible();
}

async function openForgetPasswordStep(page) {
  await openVisualRoute(page, '/pages/login/forget');
  await fieldInput(page, '用户名').fill('collector');
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(page.getByText('换一把新的钥匙')).toBeVisible();
}

async function expectStepBackAction(action) {
  await expect(action).toBeVisible();
  await expect(action).toBeEnabled();
  const box = await action.boundingBox();
  expect(box?.height || 0).toBeGreaterThanOrEqual(39);
  expect(box?.width || 0).toBeGreaterThanOrEqual(100);
}

viewports.forEach(({ width, height, theme }) => {
  test(`auth step-back actions stay consistent at ${width}x${height} ${theme}`, async ({ page }) => {
    const runtimeIssues = observeRuntime(page);
    await page.setViewportSize({ width, height });
    await installVisualFixture(page, { persona: 'guest', theme });
    await mockForgetJourney(page);

    await openRegisterContactStep(page);
    const registerBack = page.getByRole('button', { name: '返回修改账号信息' });
    await expectStepBackAction(registerBack);
    await expect(horizontalOverflow(page)).resolves.toBeLessThanOrEqual(2);
    await registerBack.scrollIntoViewIfNeeded();
    await stableScreenshot(page, {
      path: `test-results/register-step-back-${width}x${height}-${theme}.png`,
    });

    await openForgetPasswordStep(page);
    const forgetBack = page.getByRole('button', { name: '返回修改用户名' });
    await expectStepBackAction(forgetBack);
    await expect(horizontalOverflow(page)).resolves.toBeLessThanOrEqual(2);
    await forgetBack.scrollIntoViewIfNeeded();
    await stableScreenshot(page, {
      path: `test-results/forget-step-back-${width}x${height}-${theme}.png`,
    });
    expect(runtimeIssues).toEqual([]);
  });
});

test('auth step-back actions preserve account drafts and clear reset secrets', async ({ page }) => {
  const runtimeIssues = observeRuntime(page);
  await installVisualFixture(page, { persona: 'guest', theme: 'light' });
  await mockForgetJourney(page);

  await openRegisterContactStep(page);
  await fieldInput(page, '邮箱').fill('collector@example.com');
  await fieldInput(page, '验证码').fill('123456');
  const registerBack = page.getByRole('button', { name: '返回修改账号信息' });
  await registerBack.focus();
  await page.keyboard.press('Space');
  await expect(page.getByText('先留下一个署名')).toBeVisible();
  await page.getByRole('button', { name: '继续验证邮箱' }).click();
  await expect(fieldInput(page, '邮箱')).toHaveValue('collector@example.com');
  await expect(fieldInput(page, '验证码')).toHaveValue('123456');

  await openForgetPasswordStep(page);
  await fieldInput(page, '新密码').fill('password123');
  await fieldInput(page, '重复密码').fill('password123');
  await fieldInput(page, '验证码').fill('654321');
  const forgetBack = page.getByRole('button', { name: '返回修改用户名' });
  await forgetBack.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('先确认你的账号')).toBeVisible();
  await expect(fieldInput(page, '用户名')).toHaveValue('collector');
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(fieldInput(page, '新密码')).toHaveValue('');
  await expect(fieldInput(page, '重复密码')).toHaveValue('');
  await expect(fieldInput(page, '验证码')).toHaveValue('');
  expect(runtimeIssues).toEqual([]);
});

test('registration shows a disabled send button while the code request is pending', async ({ page }) => {
  await installVisualFixture(page, { persona: 'guest', theme: 'light' });
  let releaseResponse;
  const pendingResponse = new Promise((resolve) => { releaseResponse = resolve; });
  await page.route('http://localhost:8000/users/email-code', async (route) => {
    await pendingResponse;
    await route.fulfill({ status: 200, json: {} });
  });

  await openRegisterContactStep(page);
  await fieldInput(page, '邮箱').fill('collector@example.com');
  await page.getByRole('button', { name: '获取验证码' }).click();
  try {
    await expect(page.getByRole('button', { name: '发送中…' })).toBeDisabled();
  } finally {
    releaseResponse();
  }
  await expect(page.getByText('验证码已发送')).toBeVisible();
  await expect(page.getByRole('button', { name: /重新获取/ })).toBeDisabled();
});
