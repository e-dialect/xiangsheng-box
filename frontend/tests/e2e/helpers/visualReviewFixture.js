const TINY_WAV = 'data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const FIXTURE_AVATAR = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2296%22 height=%2296%22 viewBox=%220 0 96 96%22%3E%3Crect width=%2296%22 height=%2296%22 rx=%2248%22 fill=%22%23e8f3ed%22/%3E%3Ccircle cx=%2248%22 cy=%2237%22 r=%2217%22 fill=%22%23216a4d%22/%3E%3Cpath d=%22M19 86c3-19 14-30 29-30s26 11 29 30%22 fill=%22%23216a4d%22/%3E%3Cpath d=%22M34 38c6-4 11-9 14-16 5 7 10 12 16 15%22 fill=%22none%22 stroke=%22%23a8dfc2%22 stroke-width=%225%22 stroke-linecap=%22round%22/%3E%3C/svg%3E';

const DIALECTS = [
  {
    id: 1,
    name: '闽语',
    code: '闽',
    qualified_code: '闽',
    parent_id: null,
    sort_order: 1,
  },
  {
    id: 3,
    name: '莆仙方言',
    code: '莆仙',
    qualified_code: '闽.莆仙',
    parent_id: 1,
    path_names: ['闽语', '莆仙方言'],
    sort_order: 1,
  },
];

const ENTRY = {
  id: 21,
  display_writing: '落大雨',
  summary: '形容雨突然下得很大、来得很急。',
  status: 'reviewed',
  recording_count: 2,
  evidence_count: 3,
  attestation_count: 4,
  needs_audio: false,
  is_bookmarked: true,
  usage_dialect: DIALECTS[1],
  writings: [
    {
      id: 31,
      text: '落大雨',
      writing_type: 'orthographic',
      is_preferred: true,
      writing: { text: '落大雨', form_type: 'orthographic' },
    },
    {
      id: 32,
      text: '骆大雨',
      writing_type: 'uncertain',
      is_preferred: false,
      writing: { text: '骆大雨', form_type: 'uncertain' },
    },
  ],
  senses: [{
    id: 41,
    order: 1,
    sense_number: 1,
    gloss: '阵雨突然变得猛烈',
    note: '常用于提醒屋外的人收衣服。',
    usage_note: '常用于提醒屋外的人收衣服。',
    concepts: [],
  }],
  concepts: [],
  pronunciation_variants: [{
    id: 51,
    ipa: 'loʔ˥ tua˨˩ hø˧˥',
    romanization: 'loh dua ho',
    surface_romanization: 'loh dua ho',
    dialect: DIALECTS[1],
  }],
};

const RECORDING = {
  id: 11,
  audio_url: TINY_WAV,
  duration_ms: 3200,
  original_gloss: '表示雨突然下得很大',
  original_writing: '落大雨',
  original_pronunciation: 'lo dua ho',
  recording_type: 'word',
  rights_statement: '已获授权公开展示',
  usage_dialect: DIALECTS[1],
  recorder: {
    id: 12,
    username: 'speaker',
    nickname: '乡音记录者',
    avatar: FIXTURE_AVATAR,
  },
  entry_links: [{
    id: 61,
    role: 'primary',
    status: 'accepted',
    is_current: true,
    entry: ENTRY,
  }],
};

const USER = {
  id: 7,
  username: 'visual-reviewer',
  nickname: '视觉巡检员',
  avatar: FIXTURE_AVATAR,
  email: 'review@example.com',
  telephone: '13900000001',
  birthday: '1991-02-03',
  wechat: false,
  has_usable_password: true,
  primary_dialect: DIALECTS[1],
  followed_dialects: [DIALECTS[1]],
  follower_count: 18,
  following_count: 7,
  is_following: false,
};

const USER_RESPONSE = {
  user: USER,
  contribution: {
    recordings: 12,
    recordings_total: 12,
    entries: 5,
    entries_total: 5,
    senses: 8,
    senses_total: 8,
    evidence: 7,
  },
  notification: { statistics: { unread: 2 } },
};

const PUBLIC_USER_RESPONSE = {
  user: {
    ...USER,
    id: 12,
    username: 'speaker',
    nickname: '乡音记录者',
    email: '',
    telephone: '',
    follower_count: 28,
    following_count: 9,
    is_following: false,
  },
  contribution: {
    recordings: 16, entries: 6, senses: 9, evidence: 4,
  },
};

const CIRCLE = {
  id: 3,
  name: '莆仙乡音圈',
  description: '一起记录莆仙各地真实使用的说法与读音差异。',
  dialect: DIALECTS[1],
  member_count: 128,
  recording_count: 42,
  is_member: true,
};

const NOTIFICATION = {
  id: 31,
  title: '你的补证已被采纳',
  content: '整理员已核对这份地区读音依据。',
  time: '2026-09-05 10:20',
  unread: true,
  from: { id: 12, nickname: '莆仙整理员', avatar: FIXTURE_AVATAR },
  to: { id: 7, nickname: '视觉巡检员', avatar: FIXTURE_AVATAR },
  target: { url: '/pages/entries/details?id=21' },
};

const enabledCapabilities = {
  listen_feed: true,
  entry_search: true,
  recording: true,
  usage_attestation: true,
  curation_workbench: true,
  wechat_auth: true,
};

function paged(results) {
  return {
    count: results.length,
    next: null,
    previous: null,
    results,
  };
}

function focused(pathname, focus) {
  const checks = {
    recordings: pathname === '/recordings/',
    entries: pathname === '/entries/',
    bookmarks: pathname === '/entries/bookmarks/',
    notifications: pathname === '/notifications',
  };
  return Boolean(focus && checks[focus]);
}

function profileFixture(response, avatarState) {
  if (avatarState !== 'missing') return response;
  return {
    ...response,
    user: {
      ...response.user,
      avatar: '',
    },
  };
}

function successPayload(pathname, method, {
  avatarState = 'image',
  empty = false,
} = {}) {
  if (pathname === '/site-settings/capabilities') {
    return { version: 1, capabilities: enabledCapabilities, updated_at: '2026-09-05T00:00:00Z' };
  }
  if (pathname === '/site-settings/carousel') return { carousel: [] };
  if (pathname === '/site-settings/announcements') return { announcements: [] };
  if (pathname === '/site-settings/featured-announcements') return { featured_announcements: [] };
  if (pathname === '/product-events/' || pathname === '/users/theme/events/') {
    return { accepted: 1 };
  }
  if (pathname === '/login' && method === 'PUT') {
    return { token: 'visual-review-token', id: 7 };
  }
  if (pathname === '/users/7') return profileFixture(USER_RESPONSE, avatarState);
  if (pathname === '/users/12') return PUBLIC_USER_RESPONSE;
  if (pathname === '/users') return { users: empty ? [] : [PUBLIC_USER_RESPONSE.user] };
  if (pathname === '/users/recommendations') {
    return paged(empty ? [] : [{
      ...PUBLIC_USER_RESPONSE.user,
      public_recording_count: 16,
    }]);
  }
  if (pathname === '/dialects/resolve/') return DIALECTS[1];
  if (pathname === '/dialects/') return paged(empty ? [] : DIALECTS);
  if (pathname === '/entries/suggestions/' || pathname === '/entries/popular/') return [ENTRY];
  if (pathname === '/recordings/daily/' || pathname === '/recordings/random/') return { ...RECORDING, visibility: true };
  if (pathname === '/recording-comments/' || pathname === '/entry-comments/') return paged([]);
  if (pathname === '/collections/') return paged([{ id: 1, title: '雨落故乡', description: '听见雨声里的乡音', is_public: true }]);
  if (pathname === '/collections/1/') return {
    id: 1, title: '雨落故乡', description: '从一句落大雨，听见不同地方的日常。', is_public: true, editable: true,
    entry_count: 1, recording_count: 1, pending: [], sections: [{ id: 1, entry: ENTRY, recording_count: 1, recordings: [{ id: 1, recording: { ...RECORDING, visibility: true } }] }],
  };
  if (pathname === '/entries/bookmarks/') return paged(empty ? [] : [ENTRY]);
  if (/^\/entries\/\d+\/bookmark\/$/.test(pathname)) return { bookmarked: method !== 'DELETE' };
  if (/^\/entries\/\d+\/$/.test(pathname)) return ENTRY;
  if (pathname === '/entries/') return paged(empty ? [] : [ENTRY]);
  if (/^\/recordings\/\d+\/$/.test(pathname)) return { ...RECORDING, visibility: true, liked: false, like_count: 2 };
  if (pathname === '/recordings/') return paged(empty ? [] : [RECORDING]);
  if (/^\/circles\/\d+\/recordings\/$/.test(pathname)) return paged(empty ? [] : [RECORDING]);
  if (/^\/circles\/\d+\/membership\/$/.test(pathname)) return { ...CIRCLE, is_member: true };
  if (/^\/circles\/\d+\/$/.test(pathname)) return CIRCLE;
  if (pathname === '/circles/') return paged(empty ? [] : [CIRCLE]);
  if (pathname === '/curation/') {
    return {
      grants: [{ id: 71, role: 'regional_curator', dialect: DIALECTS[1] }],
      pending: { entries: 1, recordings: 1, pronunciations: 1 },
    };
  }
  if (pathname === '/curation/tasks/') {
    return paged(empty ? [] : [{
      id: 81,
      kind: 'entry',
      target_type: 'entry',
      title: '落大雨',
      summary: '核对这条写法与地区读音证据。',
      dialect: DIALECTS[1],
      actions: ['reviewed', 'disputed', 'rejected'],
    }]);
  }
  if (pathname === '/curator-applications/') return paged([]);
  if (pathname === '/curator-grants/') {
    return paged(empty ? [] : [{
      id: 71,
      role: 'regional_curator',
      dialect: DIALECTS[1],
      user: USER,
      reason: '熟悉本地日常使用与读音差异',
      valid_from: '2026-01-01',
      valid_until: '2026-12-31',
    }]);
  }
  if (pathname === '/contributions/me/') {
    return {
      summary: {
        recordings: 12, evidence: 7, revisions: 4, dialects: 2,
      },
      dialect_footprint: empty ? [] : [{ dialect: DIALECTS[1], contribution_count: 14 }],
      recent_activity: empty ? [] : [{
        kind: 'recording',
        target_id: 11,
        label: '补录“落大雨”的本地读音',
        created_at: '2026-09-04T10:00:00Z',
      }],
    };
  }
  if (/^\/notifications\/\d+$/.test(pathname)) return NOTIFICATION;
  if (pathname === '/notifications') {
    return { notifications: empty ? [] : [NOTIFICATION], page: 1, pages: 1 };
  }
  if (pathname === '/themes/' || pathname === '/decorations/') {
    return { catalog_version: 1, ...paged([]) };
  }
  if (pathname === '/users/theme/entitlement/') {
    return { is_member: true, creator_unlocked: false, activity_ids: ['event-lantern'] };
  }
  if (pathname === '/users/theme/config/') {
    return {
      theme_id: 'default',
      local_decorations: {},
      overlay_local_decorations: true,
      recent_items: [],
    };
  }
  if (pathname === '/users/theme/collects/') return { collect_list: [] };
  if (pathname === '/users/theme/mixes/') return [];
  if (method === 'GET') return paged([]);
  return { ok: true };
}

export function observeRuntime(page) {
  const issues = [];
  page.on('pageerror', (error) => {
    issues.push({ type: 'pageerror', text: error.message });
  });
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      issues.push({ type: message.type(), text: message.text() });
    }
  });
  return issues;
}

export async function installVisualFixture(page, {
  accent = 'pine',
  avatarState = 'image',
  persona = 'guest',
  theme = 'light',
  state = 'success',
  focus = '',
  preserveStorage = false,
} = {}) {
  await page.addInitScript(({
    member, selectedAccent, selectedTheme, preserve,
  }) => {
    if (!preserve || !sessionStorage.getItem('fixture-seeded')) localStorage.clear();
    sessionStorage.setItem('fixture-seeded', 'true');
    localStorage.setItem('ui_theme', selectedTheme);
    localStorage.setItem('ui_accent', selectedAccent);
    localStorage.setItem('visitor_id', 'visual-review-visitor');
    if (member) {
      localStorage.setItem('token', 'visual-review-token');
      localStorage.setItem('id', '7');
    }
  }, {
    member: persona === 'member',
    selectedAccent: accent,
    selectedTheme: theme,
    preserve: preserveStorage,
  });

  await page.route(`${process.env.VISUAL_REVIEW_API_ORIGIN || 'http://localhost:8000'}/**`, async (route) => {
    const request = route.request();
    if (!['xhr', 'fetch'].includes(request.resourceType())) { await route.continue(); return; }
    const { pathname } = new URL(request.url());
    const isFocus = focused(pathname, focus);
    if (isFocus && state === 'loading') {
      await new Promise((resolve) => { setTimeout(resolve, 2500); });
    }
    if (isFocus && state === 'error') {
      await route.fulfill({
        status: 503,
        json: { message: '视觉巡检故障样本，请稍后重试' },
      });
      return;
    }
    await route.fulfill({
      status: 200,
      json: successPayload(pathname, request.method(), {
        avatarState,
        empty: isFocus && state === 'empty',
      }),
    });
  });
}

export async function openVisualRoute(page, target, { persona = 'guest' } = {}) {
  await page.goto('/');
  if (persona === 'member') {
    await page.waitForFunction(() => (
      typeof getApp === 'function'
      && Number(getApp()?.globalData?.userInfo?.id) === 7
    ));
  }

  if (target !== '/') {
    await page.evaluate((url) => new Promise((resolve, reject) => {
      uni.navigateTo({
        url,
        success: resolve,
        fail: (error) => reject(new Error(error?.errMsg || 'navigateTo failed')),
      });
    }), target);
  }

  await page.locator('.immersive-shell, .app-shell, .page-shell').first().waitFor({
    state: 'visible',
  });
}

export async function horizontalOverflow(page) {
  return page.evaluate(() => Math.max(
    0,
    document.documentElement.scrollWidth - window.innerWidth,
    document.body.scrollWidth - window.innerWidth,
  ));
}
