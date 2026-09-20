import { expect, test } from '@playwright/test';
import { stableScreenshot } from './helpers/stableScreenshot';
import { observeRuntime } from './helpers/visualReviewFixture';

async function tap(locator) {
  await locator.click();
}

async function tapAction(page, name) {
  const byRole = page.getByRole('button', { name });
  if (await byRole.count()) {
    await byRole.last().click();
    return;
  }
  await page.locator('.base-button', { hasText: name }).last().click();
}

async function openMine(page) {
  await page.goto('/');
  await page.getByRole('button', { name: '我的' }).click();
  await expect(page.getByText('还没有登录')).toBeVisible();
}

function waitForThemeCatalog(page) {
  const catalogPaths = ['/themes/', '/decorations/'];
  return Promise.all(catalogPaths.map((pathname) => page.waitForResponse((response) => (
    new URL(response.url()).pathname === pathname && response.ok()
  ))));
}

async function themeCenterLayout(page) {
  await page.evaluate(() => new Promise((resolve) => {
    const resetScroll = () => {
      window.scrollTo(0, 0);
      document.querySelectorAll('.shell-scroll, .app-shell__scroll')
        .forEach((element) => element.scrollTo(0, 0));
    };
    resetScroll();
    requestAnimationFrame(() => {
      resetScroll();
      requestAnimationFrame(() => {
        resetScroll();
        resolve();
      });
    });
  }));
  return page.evaluate(() => {
    const recentElement = document.querySelector('.recent-block');
    const currentElement = document.querySelector('.current-card');
    const recent = recentElement?.getBoundingClientRect();
    const current = currentElement?.getBoundingClientRect();
    const scrollContainer = currentElement?.closest('.shell-scroll, .app-shell__scroll');
    const scrollRect = scrollContainer?.getBoundingClientRect();
    const currentTop = current && scrollRect
      ? current.top - scrollRect.top + scrollContainer.scrollTop
      : (current?.top || 0) + window.scrollY;
    return {
      recentHeight: recent?.height || 0,
      currentTop,
      scrollTop: scrollContainer?.scrollTop || window.scrollY,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
}

async function themeTokens(page) {
  return page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      theme: document.documentElement.dataset.theme || '',
      page: styles.getPropertyValue('--page-color').trim(),
      text: styles.getPropertyValue('--text-color').trim(),
      surface: styles.getPropertyValue('--surface-color').trim(),
    };
  });
}

test('mine page keeps contrast in light and dark themes', async ({ page }) => {
  await openMine(page);
  const initialCatalogReady = waitForThemeCatalog(page);
  await tap(page.getByText('主题中心'));
  await initialCatalogReady;
  await expect(page.getByText('装扮目录加载中…')).toHaveCount(0);
  await expect(page.getByText('当前使用')).toBeVisible();
  await expect(page.locator('.recent-block .theme-status-pane--compact')).toBeVisible();
  await expect(page.locator('.recent-block .empty-state')).toHaveCount(0);

  const lightLayout = await themeCenterLayout(page);
  expect(lightLayout.recentHeight).toBeLessThanOrEqual(120);
  expect(lightLayout.currentTop).toBeLessThanOrEqual(539);
  expect(lightLayout.scrollTop).toBe(0);
  expect(lightLayout.overflow).toBeLessThanOrEqual(0);

  const light = await themeTokens(page);
  expect(light.page).toBe('#f6f7f3');
  expect(light.text).toBe('#1d2a24');
  expect(light.page).not.toBe(light.text);
  await stableScreenshot(page, {
    path: 'test-results/account-me-light.png',
  });

  await tap(page.locator('.filters.appearance .chip', { hasText: '深色' }));
  await expect.poll(async () => (await themeTokens(page)).theme).toBe('dark');
  const darkCatalogReady = waitForThemeCatalog(page);
  await page.reload();
  await darkCatalogReady;
  await expect(page.getByText('装扮目录加载中…')).toHaveCount(0);
  await expect(page.getByText('当前使用')).toBeVisible();
  await expect.poll(async () => (await themeTokens(page)).theme).toBe('dark');

  const dark = await themeTokens(page);
  expect(dark.page).toBe('#121915');
  expect(dark.text).toBe('#edf4ef');
  expect(dark.surface).toBe('#1d2822');
  expect(dark.page).not.toBe(light.page);
  const darkLayout = await themeCenterLayout(page);
  expect(darkLayout).toEqual(lightLayout);
  await stableScreenshot(page, {
    path: 'test-results/account-me-dark.png',
  });
});

test('theme center keeps one live pack and placeholders', async ({ page }) => {
  const runtimeIssues = observeRuntime(page);
  let contributionRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/contributions/me/') {
      contributionRequests += 1;
    }
  });
  await openMine(page);
  await tap(page.getByText('主题中心'));
  await expect(page.locator('.tab.active', { hasText: '全局主题' })).toBeVisible();
  await expect(page.getByText('默认方言主题').first()).toBeVisible();
  await expect(page.getByText('已启用').first()).toBeVisible();
  await expect(page.getByText('最近使用', { exact: true })).toBeVisible();
  await expect(page.getByText('搜索主题、装扮名称、方言风格')).toBeVisible();
  await expect(page.getByText('热门搜索词')).toBeVisible();
  await expect(page.getByText('方言头像框')).toBeVisible();
  await expect(page.getByText('名称A-Z')).toHaveCount(0);
  await expect(page.getByText('提示：可以通过方言地域标签快速筛选家乡风格装扮；筛选条件会临时保留。')).toBeVisible();
  await expect(page.getByText('提示：实时预览仅模拟展示效果；微信小程序部分系统原生组件不支持自定义装扮。')).toBeVisible();
  await expect(page.getByText('暂无最近使用记录，快去挑选装扮吧')).toBeVisible();
  await expect(page.getByText('提示：最近使用记录仅记录你启用过的装扮；保存搭配可一键还原整套界面组合；')).toBeVisible();
  await expect(page.getByText('敬请期待').first()).toBeVisible();
  await expect(page.getByText('装扮获取')).toBeVisible();
  await expect(page.getByText('会员专属').first()).toBeVisible();
  await expect(page.getByText('已绝版').first()).toBeVisible();
  await expect(page.getByText('川渝烟火', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('地域方言风', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('国风', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('全局主题将统一改变导航栏、按钮、卡片、背景、文字色彩')).toBeVisible();
  await expect(page.getByText('全局主题会带轻微地域纹理，不会改变录音播放内容；部分组件在微信小程序存在限制。')).toBeVisible();
  await expect(page.getByText('提示：部分限定装扮为限时活动产出，活动结束后将绝版；')).toBeVisible();
  await expect(page.getByText('会员装扮权益在H5、小程序两端同步；')).toBeVisible();
  await expect(page.getByText('最新上架').first()).toBeVisible();
  await expect(page.getByText('我的收藏')).toBeVisible();
  await expect(page.getByText('提示：收藏仅为个人标记，不会自动解锁装扮；')).toBeVisible();

  await page.locator('.tab', { hasText: '我的收藏' }).click();
  await expect(page.getByText('你还没有收藏任何主题装扮，快去挑选喜欢的吧')).toBeVisible();
  await page.locator('.tab', { hasText: '全局主题' }).click();

  await page.getByRole('button', { name: /^筛选与排序/ }).click();
  await expect(page.getByText('权限筛选')).toBeVisible();
  await expect(page.getByText('地域方言标签')).toBeVisible();
  await expect(page.getByText('可多选家乡风格')).toBeVisible();
  await expect(page.getByText('名称A-Z')).toBeVisible();
  await page.getByText('重置').click({ force: true });
  await page.getByText('确定').click({ force: true });

  await page.locator('.hot-scroll .chip', { hasText: '川渝烟火' }).click();
  await expect(page.getByText('川渝烟火').first()).toBeVisible();
  await expect(page.getByText('返回列表').first()).toBeVisible();
  const searchBox = page.locator('.search-bar input').first();
  await searchBox.scrollIntoViewIfNeeded();
  await searchBox.fill('xyz-not-a-skin');
  await page.locator('.search-go').click({ force: true });
  await expect(page.getByText('没有找到相关主题或装扮，换个关键词试试')).toBeVisible();
  await page.getByRole('button', { name: '返回列表' }).first().click({ force: true });
  await expect(page.locator('.tab.active', { hasText: '全局主题' })).toBeVisible();

  await page.getByText('装扮获取').click();
  await expect(page.getByText('开通会员即可解锁全部会员全局主题、会员局部装扮。')).toBeVisible();
  await expect(page.getByText('去录乡音').first()).toBeVisible();
  await expect(page.getByText('录音数从贡献履历自动核验；徽章与挑战资格由活动审核发放，不能在本页自行增加。')).toBeVisible();
  await page.goBack();

  await page.locator('.theme-card', { hasText: '松风会员' }).locator('.theme-name').click();
  await expect(page.getByText('该装扮为会员专属，开通会员即可解锁全部会员主题与装扮').first()).toBeVisible();
  await page.locator('.sheet-actions .base-button').first().click({ force: true });

  await page.locator('.theme-card', { hasText: '开春乡音' }).locator('.theme-name').click();
  await expect(page.getByText('已绝版').first()).toBeVisible();
  await page.locator('.sheet-actions .base-button').first().click({ force: true });

  await page.locator('.theme-card', { hasText: '川渝烟火' }).click();
  await expect(page.getByText('H5网页版：该主题全部样式完整生效')).toBeVisible();
  await expect(page.locator('.sheet').getByText('实时预览')).toBeVisible();
  await expect(page.getByText('预览仅为模拟效果，不会修改你的界面')).toBeVisible();
  await expect(page.getByText('首页录音流').first()).toBeVisible();
  await expect(page.getByText('会修改的元素')).toBeVisible();
  await expect(page.getByText('该主题暂未开放，敬请期待')).toBeVisible();
  await expect(page.locator('.sheet').getByText('取消')).toBeVisible();
  await page.locator('.sheet').getByText('实时预览').click({ force: true });
  await expect(page.getByText('立即应用')).toHaveCount(0);
  await page.locator('.sheet-actions .base-button').first().click({ force: true });

  await page.locator('.theme-card', { hasText: '默认方言主题' }).locator('.theme-name').click();
  await page.locator('.sheet').getByText('实时预览').click({ force: true });
  await expect(page.locator('.preview-sheet').getByText('实时预览').first()).toBeVisible();
  await expect(page.getByText('立即应用').first()).toBeVisible();
  await expect(page.getByText('示例录音占位').first()).toBeVisible();
  await page.locator('.preview-close').click({ force: true });
  await page.locator('.sheet-actions .base-button').first().click({ force: true });

  await page.getByText('局部装扮', { exact: true }).click();
  await expect(page.getByText('局部装扮可单独修改界面组件，不会强制替换整套全局主题')).toBeVisible();
  await expect(page.getByText('小程序部分原生组件暂不支持自定义装扮。')).toBeVisible();
  await expect(page.getByText('导航栏底色与图标')).toBeVisible();
  await expect(page.getByText('录音卡片').first()).toBeVisible();
  await expect(page.getByText('江南吴语头像框')).toBeVisible();
  await expect(page.getByText('去设置').first()).toBeVisible();

  await page.locator('.tab', { hasText: '我的装扮' }).click();
  await expect(page.getByText('当前正在使用：默认方言主题').first()).toBeVisible();
  await expect(page.getByText('暂未设置局部装扮，快去搭配你的专属界面').first()).toBeVisible();
  await expect(page.getByText('保存当前搭配').first()).toBeVisible();
  await expect(page.getByText('还没有保存任何搭配方案，可将当前装扮保存为专属搭配').first()).toBeVisible();
  await expect(page.getByText('全局主题覆盖局部装扮').first()).toBeVisible();
  await expect(page.getByText('重置全部装扮').first()).toBeVisible();
  await expect(page.getByText('预览装扮效果').first()).toBeVisible();
  await expect(page.getByText('未登录状态，装扮仅保存在本地，登录后可同步到云端').first()).toBeVisible();

  await page.locator('.tab', { hasText: '局部装扮' }).click();
  await page.locator('.dress-card', { hasText: '导航栏底色与图标' }).locator('.theme-name').click();
  await expect(page.getByText('系统默认顶栏').first()).toBeVisible();
  const availability = page.locator('.availability-note');
  await expect(availability.getByText('目录状态', { exact: true })).toBeVisible();
  await expect(availability).toContainText('部分素材仍在制作，已上线项可正常预览和应用。');
  await expect(page.locator('.directory-head')).toContainText('可用目录');
  await page.getByText('系统默认顶栏').first().click();
  await expect(page.getByText('H5网页版：完整生效').first()).toBeVisible();
  await page.locator('.sheet-actions .base-button').last().click({ force: true });
  await expect(page.getByText('已应用').first()).toBeVisible();
  await page.goBack();
  await page.locator('.tab', { hasText: '我的装扮' }).click();
  await expect(page.getByText('系统默认顶栏').first()).toBeVisible();
  await expect(page.getByText('修改').first()).toBeVisible();
  await page.locator('.action-stack .base-button', { hasText: '预览装扮效果' }).click({ force: true });
  await expect(page.getByText('装扮效果预览').first()).toBeVisible();
  await expect(page.getByText('预览仅为模拟效果，不会修改你的界面').first()).toBeVisible();
  await expect(page.getByText('评论区').first()).toBeVisible();
  await expect(page.locator('.preview-sheet').getByText('关闭').first()).toBeVisible();
  await expect(page.getByText('立即应用').first()).toBeVisible();
  await page.locator('.preview-close').click({ force: true });
  await page.locator('.current-card .base-button').click({ force: true });
  await expect(page.locator('.tab.active', { hasText: '全局主题' })).toBeVisible();
  expect(contributionRequests).toBe(0);
  expect(runtimeIssues).toEqual([]);
});

test('account settings stay behind login and use PageShell titles', async ({ page }) => {
  await openMine(page);
  await tap(page.locator('.login-button'));
  await expect(page.getByText('验证身份后返回「我的」。')).toBeVisible();

  await page.goto('/pages/users/settings/information');
  await expect(page).toHaveURL(/\/pages\/login\/login/);

  await page.goto('/pages/users/settings/password');
  await expect(page).toHaveURL(/\/pages\/login\/login/);
});

async function mockSignedInCollector(page) {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('id', '7');
  });
  await page.route('**/login', async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({ json: { token: 'fresh-token', id: 7 } });
      return;
    }
    await route.continue();
  });
  await page.route('**/users/7/email', async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({ json: { user: { id: 7, email: 'new@example.com' } } });
      return;
    }
    await route.continue();
  });
  await page.route('**/users/email-code', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: { retry_after: 60 } });
      return;
    }
    await route.continue();
  });
  await page.route('**/users/7/password', async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({
        json: {
          user: {
            id: 7,
            username: 'collector',
            nickname: '采集者',
            email: 'c@example.com',
            telephone: '13900000001',
            birthday: '1991-02-03',
            wechat: false,
            primary_dialect: { id: 3, name: '四川话', qualified_code: '西南官话.四川' },
          },
          token: 'fresh-token',
        },
      });
      return;
    }
    await route.continue();
  });
  await page.route('**/dialects/**', async (route) => {
    await route.fulfill({
      json: {
        count: 1,
        next: null,
        previous: null,
        results: [{
          id: 3,
          name: '四川话',
          qualified_code: '西南官话.四川',
          sort_order: 1,
        }],
      },
    });
  });
  await page.route('**/users/7', async (route) => {
    await route.fulfill({
      json: {
        user: {
          id: 7,
          username: 'collector',
          nickname: '采集者',
          email: 'c@example.com',
          telephone: '13900000001',
          birthday: '1991-02-03',
          wechat: false,
          primary_dialect: { id: 3, name: '四川话', qualified_code: '西南官话.四川' },
        },
        contribution: {},
      },
    });
  });
}

test('H5 mine account menu hides WeChat bind and keeps email', async ({ page }) => {
  await mockSignedInCollector(page);
  await page.goto('/pages/users/me');

  await expect(page.getByText('个人资料、隐私与安全')).toBeVisible();
  await expect(page.getByText('主题中心')).toBeVisible();
  await expect(page.getByText('邮箱')).toBeVisible();
  await expect(page.getByText('修改密码')).toBeVisible();
  await expect(page.getByText('绑定微信')).toHaveCount(0);
  await expect(page.getByText('点此授权')).toHaveCount(0);

  const buttonTokens = await page.locator('.profile-actions .t-button').first().evaluate((element) => {
    const styles = getComputedStyle(element);
    const root = getComputedStyle(document.documentElement);
    return {
      brand: styles.getPropertyValue('--td-brand-color').trim().toLowerCase(),
      rootAccent: root.getPropertyValue('--accent-color').trim().toLowerCase(),
      rootBrand: root.getPropertyValue('--td-brand-color').trim().toLowerCase(),
    };
  });
  expect(buttonTokens.brand).toBe(buttonTokens.rootAccent);
  expect(buttonTokens.brand).toBe(buttonTokens.rootBrand);
  expect(buttonTokens.brand).not.toBe('#0052d9');
  expect(buttonTokens.brand).not.toBe('#366ef4');
});

test('password settings use design-system fields, visibility, and loading', async ({ page }) => {
  await mockSignedInCollector(page);
  await page.goto('/pages/users/settings/password');

  await expect(page.getByText('修改密码').first()).toBeVisible();
  await expect(page.getByText('原密码').first()).toBeVisible();
  await expect(page.getByText('新密码').first()).toBeVisible();
  await expect(page.getByText('确认密码')).toBeVisible();
  await expect(page.locator('form:not(.t-form)')).toHaveCount(0);

  await tapAction(page, '保存');
  await expect(page.locator('.base-field-error').first()).toHaveText('请输入原密码');

  const oldInput = page.locator('input').first();
  await expect(oldInput).toHaveAttribute('type', 'password');
  await page.locator('.base-button', { hasText: '显示' }).first().click({ force: true });
  await expect(oldInput).toHaveAttribute('type', 'text');
  await page.locator('.base-button', { hasText: '隐藏' }).click({ force: true });
  await expect(oldInput).toHaveAttribute('type', 'password');

  if (process.env.E2E_SCREENSHOT_DIR) {
    await stableScreenshot(page, {
      path: `${process.env.E2E_SCREENSHOT_DIR}/account-password-light.png`,
    });
  }

  const inputs = page.locator('input');
  await inputs.nth(0).fill('old-pass');
  await inputs.nth(1).fill('new-pass');
  await inputs.nth(2).fill('new-pass');
  const passwordRequest = page.waitForRequest((request) => (
    request.method() === 'PUT' && request.url().endsWith('/users/7/password')
  ));
  await tapAction(page, '保存');
  await passwordRequest;
  await expect(page).toHaveURL(/\/pages\/users\/settings\/information/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('token')))
    .toBe('fresh-token');
});

test('H5 nickname page hides WeChat nickname fill', async ({ page }) => {
  await mockSignedInCollector(page);
  await page.goto('/pages/users/settings/nickname');

  await expect(page.getByText('修改昵称').first()).toBeVisible();
  await expect(page.getByText('点这里填入微信昵称')).toHaveCount(0);
  await expect(page.getByText('也可以点下方授权')).toHaveCount(0);
});

test('information settings replace native pickers and open the avatar sheet', async ({ page }) => {
  await mockSignedInCollector(page);
  await page.goto('/pages/users/settings/information');

  await expect(page.getByText('编辑资料').first()).toBeVisible();
  await expect(page.getByText('公开档案')).toBeVisible();
  await expect(page.getByText('仅自己可见')).toBeVisible();
  await expect(page.getByText('发音默认地点')).toBeVisible();
  await expect(page.getByText('四川话')).toBeVisible();
  await expect(page.getByText('西南官话.四川')).toHaveCount(0);
  await expect(page.locator('picker')).toHaveCount(0);

  await tap(page.locator('.avatar-hit'));
  await expect(page.locator('.sheet-item', { hasText: '从相册选择' })).toBeVisible();
  await expect(page.locator('.sheet-item', { hasText: '拍照' })).toBeVisible();
  await expect(page.getByText('使用微信头像')).toHaveCount(0);
  await expect(page.getByText('从聊天记录选择')).toHaveCount(0);
  await expect(page.getByText('微信头像和聊天记录需要在小程序里使用')).toHaveCount(0);

  if (process.env.E2E_SCREENSHOT_DIR) {
    await stableScreenshot(page, {
      path: `${process.env.E2E_SCREENSHOT_DIR}/account-information-light.png`,
    });
  }

  await tap(page.getByText('取消'));
  await tap(page.getByText('生日'));
  await expect(page.getByText('确定').first()).toBeVisible();
});

test('email settings send a bind code without native form controls', async ({ page }) => {
  await mockSignedInCollector(page);
  await page.goto('/pages/users/settings/email');

  await expect(page.getByText('修改邮箱').first()).toBeVisible();
  await expect(page.getByText('正在读取邮箱…')).toHaveCount(0);
  await expect(page.getByText('原邮箱')).toBeVisible();
  await expect(page.getByText('c@example.com')).toBeVisible();
  await expect(page.locator('input').first()).toHaveValue('c@example.com');
  await expect(page.getByText('获取验证码')).toBeVisible();
  await expect(page.locator('form:not(.t-form)')).toHaveCount(0);

  await tapAction(page, '保存');
  await expect(page.locator('.base-field-error').first()).toHaveText('请输入新邮箱');

  const inputs = page.locator('input');
  await inputs.nth(1).fill('new@example.com');
  await page.locator('.base-button', { hasText: '获取验证码' }).click({ force: true });
  await expect(page.getByText('验证码已发送')).toBeVisible();
  await expect(page.locator('.base-button', { hasText: /后重发/ })).toBeDisabled();

  if (process.env.E2E_SCREENSHOT_DIR) {
    await stableScreenshot(page, {
      path: `${process.env.E2E_SCREENSHOT_DIR}/account-email-light.png`,
    });
  }
});
