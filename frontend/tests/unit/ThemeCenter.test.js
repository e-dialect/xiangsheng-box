import { mount } from '@vue/test-utils';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import confirmDialog from '@/components/ConfirmDialog';
import { notify, notifySuccess } from '@/services/feedback';
import {
  goThemeOutfit,
  goThemeSearch,
  ROUTES,
} from '@/services/navigation';
import { isWechatMiniProgram } from '@/services/platform';
import {
  getThemeAnalyticsQueue,
  resetThemeAnalyticsQueue,
} from '@/services/themeAnalytics';
import * as themeApi from '@/services/themeApi';
import {
  ACCESS_FREE,
  applySavedOutfit,
  canLivePreview,
  claimSkin,
  cleanOutfitName,
  cleanSearchKeyword,
  clearLocalDress,
  composePreviewOutfit,
  describeAccess,
  describeSkinTokens,
  dressDisplayTags,
  getActiveTheme,
  getDressGroup,
  getDressItem,
  getFavoriteMap,
  getLocalDressMap,
  getOverlayLocalDress,
  getRecentRaw,
  getSavedOutfits,
  GLOBAL_THEMES,
  getRenderableTheme,
  hasPermission,
  hydrateFavoriteMap,
  hydrateFromCloudConfig,
  hydrateOutfitStyle,
  hydrateSavedOutfits,
  isFavorited,
  isRemotePreviewSrc,
  listAppliedDress,
  listDressGroupsByCategory,
  listFavorites,
  listOutfitHubDress,
  listRecentUses,
  listThemesByCategory,
  LOCAL_DRESS_GROUPS,
  LOCAL_DRESS_ITEMS,
  mergeRemoteCatalog,
  mergeGuestThemeSnapshot,
  persistActiveTheme,
  persistLocalDress,
  P1_DRESS_GROUP_IDS,
  previewCoverOf,
  previewDetailOf,
  queryThemeCatalog,
  recordRecentUse,
  resetAllDress,
  resetThemeSessionState,
  saveCurrentOutfit,
  searchThemeCatalog,
  setActiveThemeId,
  setCreatorProgress,
  setMemberStatus,
  setOverlayLocalDress,
  socialStats,
  themeDisplayTags,
  themePreviewVars,
  THEME_CATEGORIES,
  THEME_CLOUD_QUEUE_KEY,
  THEME_FAVORITE_STORAGE_KEY,
  THEME_OUTFIT_LIMIT,
  THEME_OUTFIT_NAME_MAX,
  THEME_OUTFIT_STORAGE_KEY,
  THEME_OVERLAY_STORAGE_KEY,
  THEME_PACK_STORAGE_KEY,
  THEME_QUERY_STORAGE_KEY,
  THEME_RECENT_STORAGE_KEY,
  THEME_SEARCH_CACHE_KEY,
  THEME_SEARCH_KEYWORD_MAX,
  toggleFavorite,
} from '@/services/themeCenter';
import {
  resetThemeFaultAdapters,
  THEME_FAULT_TOAST,
} from '@/services/themeFault';
import ThemeCenterPage from '@/pages/users/theme-center.vue';
import { cleanThemeShareQuery, themeShareCopy } from '@/utils/themeShare';
import {
  getAccentPreference,
  getEffectPreference,
  getPrimaryLookPreference,
} from '@/services/theme';
import { getAppliedOutfitVars } from '@/services/themeSchema';

vi.mock('@/services/feedback', () => ({
  notify: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock('@/components/ConfirmDialog', () => ({
  default: vi.fn(async () => true),
}));

vi.mock('@/services/platform', () => ({
  isH5Runtime: vi.fn(() => false),
  isWechatMiniProgram: vi.fn(() => false),
  default: vi.fn(() => false),
}));

function memoryStore(initial = {}) {
  const store = { ...initial };
  uni.getStorageSync.mockImplementation((key) => store[key] ?? '');
  uni.setStorageSync.mockImplementation((key, value) => {
    store[key] = value;
  });
  uni.removeStorageSync = vi.fn((key) => {
    delete store[key];
  });
  return store;
}

describe('themeCenter catalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetThemeFaultAdapters();
    resetThemeSessionState();
    global.uni = {
      getStorageSync: vi.fn(() => ''),
      setStorageSync: vi.fn(),
      removeStorageSync: vi.fn(),
      navigateTo: vi.fn(),
    };
  });

  it('keeps the default pack free and gates member, event, and creator skins', async () => {
    const live = GLOBAL_THEMES.filter((item) => item.available);
    expect(live.map((item) => item.id)).toEqual(expect.arrayContaining([
      'default',
      'paper',
      'mistpad',
      'member-pine',
      'event-lantern',
      'event-spring',
      'creator-tile',
      'wuyu',
      'yue',
      'minnan',
      'mimeograph',
      'teaslip',
      'ledger',
      'nightferry',
      'signalbooth',
      'gridlamp',
      'qingshan',
      'sealpaper',
      'inkscroll',
      'teahouse',
      'nightstall',
      'lanternalley',
      'midautumn',
      'duanwu',
      'lanternyear',
      'pixelbooth',
      'starglyph',
      'comicstrip',
      'inknight',
      'voidgrid',
      'coalnook',
    ]));
    expect(GLOBAL_THEMES[0]).toMatchObject({
      id: 'default',
      name: '默认方言主题',
      tag: '免费',
    });
    const freeCyber = listThemesByCategory('cyber').filter((item) => (
      item.available && (item.access || ACCESS_FREE) === ACCESS_FREE
    )).map((item) => item.id);
    expect(freeCyber).toEqual(expect.arrayContaining(['gridlamp', 'nightferry', 'signalbooth']));
    expect(freeCyber.length).toBeGreaterThanOrEqual(9);
    expect(LOCAL_DRESS_GROUPS.length).toBeGreaterThanOrEqual(20);
    expect(P1_DRESS_GROUP_IDS).toEqual(['cards', 'profile', 'avatar', 'comment-bubble']);
    expect(getDressItem('cards-plain').style_json).toEqual({ borderRadius: '12px' });
    expect(listDressGroupsByCategory('nav').map((item) => item.id)).toEqual([
      'navbar',
      'navbar-font',
    ]);
    expect(listDressGroupsByCategory('nav', { isMiniProgram: true })).toEqual([]);
    expect(listDressGroupsByCategory('tabbar').every((item) => item.mpBlocked)).toBe(true);
    expect(GLOBAL_THEMES.some((item) => item.name === '江南吴语')).toBe(true);
    expect(GLOBAL_THEMES.some((item) => item.name === '岭南粤韵')).toBe(true);
    expect(listThemesByCategory('dialect', 'chuankiang').map((item) => item.id)).toEqual([
      'chuankiang',
    ]);

    memoryStore();
    expect(setActiveThemeId('member-pine')).toEqual({
      ok: false,
      reason: 'member',
    });
    setMemberStatus(true);
    expect(setActiveThemeId('member-pine').ok).toBe(true);

    expect(await persistLocalDress('cards', 'cards-event')).toMatchObject({
      ok: false,
      reason: 'event',
    });
    claimSkin('dress', 'cards-event');
    expect((await persistLocalDress('cards', 'cards-event')).ok).toBe(true);

    expect(setActiveThemeId('event-spring').reason).toBe('event');
    expect((await persistLocalDress('avatar', 'avatar-creator')).reason).toBe('creator');
    setCreatorProgress({
      recordings: 10,
      badge: true,
      challenge: true,
    });
    expect(describeAccess(getDressItem('avatar-creator'), 'dress').action).toBe('claim');
    claimSkin('dress', 'avatar-creator');
    expect((await persistLocalDress('avatar', 'avatar-creator')).ok).toBe(true);

    const navbar = getDressGroup('navbar');
    expect(describeAccess(getDressItem('navbar-member'), 'dress', {
      group: navbar,
      isMiniProgram: true,
    })).toMatchObject({
      owned: true,
      blocked: true,
      hint: '拥有权限，但小程序环境暂不支持该装扮',
    });
  });

  it('does not let a claimed member skin bypass membership or keep rendering after expiry', async () => {
    memoryStore();
    expect(claimSkin('theme', 'member-pine')).toEqual({
      ok: false,
      reason: 'member',
    });
    expect(setActiveThemeId('member-pine').ok).toBe(false);
    setMemberStatus(true);
    expect(setActiveThemeId('member-pine').ok).toBe(true);
    expect(getActiveTheme().id).toBe('member-pine');
    expect(getRenderableTheme().id).toBe('member-pine');
    setMemberStatus(false);
    expect(getActiveTheme().id).toBe('member-pine');
    expect(hasPermission('theme', getActiveTheme())).toBe(false);
    expect(getRenderableTheme().id).toBe('default');
  });

  it('stops rendering a claimed creator dress after the creator progress drops', async () => {
    memoryStore({ [THEME_OVERLAY_STORAGE_KEY]: '0' });
    setCreatorProgress({
      recordings: 10,
      badge: true,
      challenge: true,
    });
    expect(claimSkin('dress', 'avatar-creator').ok).toBe(true);
    expect((await persistLocalDress('avatar', 'avatar-creator')).ok).toBe(true);
    expect(listAppliedDress().find((row) => row.item.id === 'avatar-creator')?.effective).toBe(true);
    setCreatorProgress({
      recordings: 0,
      badge: false,
      challenge: false,
    });
    expect(hasPermission('dress', getDressItem('avatar-creator'))).toBe(false);
    expect(getLocalDressMap().avatar).toBe('avatar-creator');
    expect(listAppliedDress().find((row) => row.item.id === 'avatar-creator')?.effective).toBe(false);
  });

  it('enables free live packs and rejects upcoming placeholders', () => {
    expect(setActiveThemeId('nightferry')).toEqual({
      ok: true,
      theme: expect.objectContaining({ id: 'nightferry' }),
      overlayCleared: false,
      overlaySuppressed: true,
      persisted: true,
    });
    expect(setActiveThemeId('chuankiang')).toEqual({ ok: false, reason: 'upcoming' });
    expect(setActiveThemeId('default')).toEqual({
      ok: true,
      theme: expect.objectContaining({ id: 'default' }),
      overlayCleared: false,
      overlaySuppressed: true,
      persisted: true,
    });
    expect(uni.setStorageSync).toHaveBeenCalledWith(THEME_PACK_STORAGE_KEY, 'default');
    expect(getActiveTheme().name).toBe('默认方言主题');
  });

  it('offers at least nine distinctive free live packs in each style category', () => {
    const allFree = GLOBAL_THEMES.filter((item) => (
      item.available && (item.access || ACCESS_FREE) === ACCESS_FREE
    ));
    expect(allFree.length).toBeGreaterThanOrEqual(20);
    THEME_CATEGORIES.filter((row) => row.value !== 'all').forEach((row) => {
      const freeLive = GLOBAL_THEMES.filter((item) => (
        item.category === row.value
        && item.available
        && (item.access || ACCESS_FREE) === ACCESS_FREE
      ));
      expect(freeLive.length).toBeGreaterThanOrEqual(9);
      const looks = freeLive.map((item) => JSON.stringify(item.style_json));
      expect(new Set(looks).size).toBe(looks.length);
    });
    P1_DRESS_GROUP_IDS.forEach((groupId) => {
      const freeLive = LOCAL_DRESS_ITEMS.filter((item) => (
        item.group === groupId
        && item.available
        && (item.access || ACCESS_FREE) === ACCESS_FREE
        && !String(item.id).endsWith('-plain')
      ));
      expect(freeLive.length).toBeGreaterThanOrEqual(9);
      const looks = freeLive.map((item) => JSON.stringify(item.style_json));
      expect(new Set(looks).size).toBe(looks.length);
    });
    expect(getDressItem('cards-paper').available).toBe(true);
    expect(getDressItem('cards-brick').available).toBe(true);
    expect(getDressItem('cards-round').available).toBe(true);
    expect(getDressItem('profile-mist').available).toBe(true);
    expect(getDressItem('profile-night').available).toBe(true);
    expect(getDressItem('profile-grain').available).toBe(true);
    expect(getDressItem('avatar-frame').available).toBe(true);
    expect(getDressItem('avatar-glyph').available).toBe(true);
    expect(getDressItem('avatar-ink').available).toBe(true);
    expect(getDressItem('comment-paper').available).toBe(true);
    expect(getDressItem('comment-round').available).toBe(true);
    expect(getDressItem('comment-ink').available).toBe(true);
    expect(getDressItem('navbar-glyph').available).toBe(false);
    expect(GLOBAL_THEMES.find((item) => item.id === 'paper').style_json).toMatchObject({
      cardBorderRadius: '4px',
      cardBackground: 'var(--page-color)',
      grainImage: 'var(--grain-paper)',
      letterSpacing: '0.06em',
    });
    expect(GLOBAL_THEMES.find((item) => item.id === 'nightferry').style_json).toMatchObject({
      cardBorderRadius: '6px',
      cardBorderColor: 'var(--text-color)',
    });
    expect(GLOBAL_THEMES.find((item) => item.id === 'chuankiang').style_json).toMatchObject({
      cardBorderRadius: '14px',
      cardBackground: 'var(--page-color)',
    });
    const styleLabels = THEME_CATEGORIES
      .filter((row) => row.value !== 'all')
      .map((row) => row.label);
    const familyMarks = THEME_CATEGORIES.filter((row) => row.value !== 'all').map((row) => {
      const pack = GLOBAL_THEMES.find((item) => (
        item.category === row.value
        && item.available
        && (item.access || ACCESS_FREE) === ACCESS_FREE
      ));
      expect(pack?.style_json?.cardBorderRadius).toBeTruthy();
      expect(pack?.style_json?.grainOpacity).toBeTruthy();
      expect(pack?.style_json?.grainImage).toBeTruthy();
      expect(pack?.style_json?.letterSpacing).toBeTruthy();
      return [
        pack.style_json.cardBorderRadius,
        pack.style_json.cardBorderWidth,
        pack.style_json.cardShadow,
        pack.style_json.grainOpacity,
        pack.style_json.grainImage,
        pack.style_json.letterSpacing,
      ].join('|');
    });
    expect(new Set(familyMarks).size).toBe(styleLabels.length);
    P1_DRESS_GROUP_IDS.forEach((groupId) => {
      const labels = LOCAL_DRESS_ITEMS
        .filter((item) => item.group === groupId && item.available && (item.access || ACCESS_FREE) === ACCESS_FREE)
        .flatMap((item) => item.style_tags || []);
      styleLabels.forEach((label) => {
        expect(labels).toContain(label);
      });
    });
  });

  it('keeps pack surfaces when remote catalog only returns appearance', () => {
    const paper = GLOBAL_THEMES.find((item) => item.id === 'paper');
    const before = { ...paper.style_json };
    mergeRemoteCatalog({
      themes: [{ id: 'paper', available: true, style_json: { accent: 'mist' } }],
    });
    expect(paper.style_json).toMatchObject({
      accent: 'mist',
      cardBorderRadius: '4px',
      cardBackground: 'var(--page-color)',
    });
    paper.style_json = before;
  });

  it('keeps local dress when overlay is on, including after enabling a global pack', async () => {
    memoryStore({ [THEME_OVERLAY_STORAGE_KEY]: '1' });
    expect(await persistLocalDress('navbar', 'navbar-plain')).toMatchObject({
      ok: true,
      suppressed: true,
    });
    expect((await persistLocalDress('actions', 'actions-plain')).ok).toBe(true);
    expect(getLocalDressMap()).toEqual({
      navbar: 'navbar-plain',
      actions: 'actions-plain',
    });
    setOverlayLocalDress(true);
    expect(getLocalDressMap()).toEqual({
      navbar: 'navbar-plain',
      actions: 'actions-plain',
    });
    expect(listAppliedDress().every((entry) => entry.suppressed && !entry.effective)).toBe(true);
    expect(setActiveThemeId('default')).toMatchObject({
      overlayCleared: false,
      overlaySuppressed: true,
    });
    expect(getLocalDressMap()).toEqual({
      navbar: 'navbar-plain',
      actions: 'actions-plain',
    });
  });

  it('does not overwrite other groups when applying one dress', async () => {
    memoryStore({ [THEME_OVERLAY_STORAGE_KEY]: '0' });
    await persistLocalDress('navbar', 'navbar-plain');
    await persistLocalDress('cards', 'cards-plain');
    expect(await persistLocalDress('navbar', 'navbar-glyph')).toEqual({
      ok: false,
      reason: 'upcoming',
    });
    expect(getLocalDressMap()).toEqual({
      navbar: 'navbar-plain',
      cards: 'cards-plain',
    });
  });

  it('resets the default pack and local dress, then queues cloud sync', async () => {
    memoryStore({
      token: 'token',
      [THEME_OVERLAY_STORAGE_KEY]: '0',
    });
    await persistLocalDress('navbar', 'navbar-plain');
    await persistLocalDress('actions', 'actions-plain');
    saveCurrentOutfit('巷口搭配');
    toggleFavorite('theme', getActiveTheme());
    recordRecentUse('theme', getActiveTheme());
    const result = await resetAllDress();
    expect(result).toMatchObject({ ok: true, queued: true });
    expect(getActiveTheme().id).toBe('default');
    expect(getLocalDressMap()).toEqual({});
    expect(getOverlayLocalDress()).toBe(true);
    expect(getSavedOutfits().map((row) => row.name)).toEqual(['巷口搭配']);
    expect(isFavorited('theme', 'default')).toBe(true);
    expect(getRecentRaw().some((row) => row.id === 'default')).toBe(true);
    expect(uni.setStorageSync).toHaveBeenCalledWith(
      THEME_CLOUD_QUEUE_KEY,
      expect.objectContaining({
        themeId: 'default',
        localDress: {},
        overlay: true,
      }),
    );
  });

  it('fills P1 outfit hub slots and sanitizes mix names', async () => {
    memoryStore({ [THEME_OVERLAY_STORAGE_KEY]: '0' });
    expect(cleanOutfitName('<b>巷口</b>搭配<>')).toBe('巷口搭配');
    expect(cleanOutfitName('x'.repeat(40))).toHaveLength(THEME_OUTFIT_NAME_MAX);
    expect(listOutfitHubDress().map((row) => row.group.id)).toEqual(P1_DRESS_GROUP_IDS);
    expect(listOutfitHubDress().every((row) => row.empty)).toBe(true);
    await persistLocalDress('cards', 'cards-plain');
    await persistLocalDress('navbar', 'navbar-plain');
    expect(listOutfitHubDress().map((row) => row.group.id)).toEqual([
      'cards',
      'profile',
      'avatar',
      'comment-bubble',
      'navbar',
    ]);
    expect(listOutfitHubDress().find((row) => row.group.id === 'cards').item.id).toBe('cards-plain');
    expect(listOutfitHubDress().find((row) => row.group.id === 'profile').empty).toBe(true);
    const mpHub = listOutfitHubDress({ isMiniProgram: true });
    expect(mpHub.find((row) => row.group.id === 'navbar')).toMatchObject({
      blocked: true,
      empty: false,
    });
    expect(mpHub.some((row) => row.empty && row.group.mpBlocked)).toBe(false);
    expect(dressDisplayTags(getDressItem('cards-plain'), getDressGroup('cards'), {
      applied: true,
    }).map((tag) => tag.label)).toEqual(expect.arrayContaining(['录音卡片', '已启用']));
    expect(saveCurrentOutfit('<b>巷口搭配</b>').outfit.name).toBe('巷口搭配');
  });

  it('queues a cloud payload when the user is signed in', async () => {
    memoryStore({
      token: 'token',
      [THEME_OVERLAY_STORAGE_KEY]: '0',
    });
    const result = await persistActiveTheme('default');
    expect(result).toMatchObject({ ok: true, queued: true, overlayCleared: false });
    expect(uni.setStorageSync).toHaveBeenCalledWith(
      THEME_CLOUD_QUEUE_KEY,
      expect.objectContaining({
        themeId: 'default',
        recent: expect.any(Array),
        outfits: expect.any(Array),
      }),
    );
  });

  it('keeps the local pack when cloud config hydrate is corrupt', () => {
    memoryStore({ [THEME_PACK_STORAGE_KEY]: 'paper' });
    const result = hydrateFromCloudConfig({
      get global_theme_id() {
        throw new Error('corrupt');
      },
    });
    expect(result).toMatchObject({ ok: false, reason: 'corrupt' });
    expect(uni.getStorageSync(THEME_PACK_STORAGE_KEY)).toBe('paper');
  });

  it('clears stale local recents when the cloud list is empty', () => {
    const store = memoryStore({
      [THEME_RECENT_STORAGE_KEY]: [{ kind: 'theme', id: 'paper', usedAt: 1 }],
    });
    const result = hydrateFromCloudConfig({
      global_theme_id: 'default',
      decoration_map: {},
      is_cover_local_decoration: true,
      recent_use_list: [],
    });
    expect(result.ok).toBe(true);
    expect(store[THEME_RECENT_STORAGE_KEY]).toEqual([]);
  });

  it('merges guest data into cloud state while keeping cloud conflicts', () => {
    const store = memoryStore({
      token: 'token',
      [THEME_PACK_STORAGE_KEY]: 'paper',
      ui_local_dress: { cards: 'cards-plain' },
      [THEME_OVERLAY_STORAGE_KEY]: '1',
      [THEME_FAVORITE_STORAGE_KEY]: { themes: ['default'], dresses: [] },
      [THEME_RECENT_STORAGE_KEY]: [{ kind: 'theme', id: 'default', usedAt: 10 }],
      [THEME_OUTFIT_STORAGE_KEY]: [{
        id: 'cloud-outfit',
        name: '云端搭配',
        themeId: 'paper',
        localDress: { cards: 'cards-plain' },
      }],
    });
    const result = mergeGuestThemeSnapshot({
      themeId: 'default',
      overlay: false,
      localDress: { cards: 'cards-accent', avatar: 'avatar-plain' },
      favorites: { themes: ['paper'], dresses: ['cards-plain'] },
      recent: [{ kind: 'theme', id: 'paper', usedAt: 20 }],
      outfits: [{
        id: 'guest-outfit',
        name: '本地搭配',
        themeId: 'default',
        localDress: { avatar: 'avatar-plain' },
      }],
    });
    expect(result.ok).toBe(true);
    expect(store[THEME_PACK_STORAGE_KEY]).toBe('paper');
    expect(store[THEME_OVERLAY_STORAGE_KEY]).toBe('1');
    expect(getLocalDressMap()).toEqual({
      cards: 'cards-plain',
      avatar: 'avatar-plain',
    });
    expect(getFavoriteMap()).toEqual({
      themes: ['default', 'paper'],
      dresses: ['cards-plain'],
    });
    expect(getRecentRaw().map((row) => row.id)).toEqual(['paper', 'default']);
    expect(getSavedOutfits().map((row) => row.id)).toEqual([
      'cloud-outfit',
      'guest-outfit',
    ]);
  });

  it('enables the second free pack and shows style plus status tags', async () => {
    memoryStore({ [THEME_OVERLAY_STORAGE_KEY]: '0' });
    const result = await persistActiveTheme('paper');
    expect(result.ok).toBe(true);
    expect(getActiveTheme().id).toBe('paper');
    const paper = GLOBAL_THEMES.find((item) => item.id === 'paper');
    expect(themeDisplayTags(paper, { applied: true }).map((row) => row.label)).toEqual(
      expect.arrayContaining(['简约', '免费', '已启用']),
    );
  });

  it('paints the enabled pack and dress after leaving the catalog', async () => {
    memoryStore({ [THEME_OVERLAY_STORAGE_KEY]: '0' });
    uni.setNavigationBarColor = vi.fn();
    uni.setBackgroundColor = vi.fn();
    uni.$emit = vi.fn();
    await persistActiveTheme('nightferry');
    expect(getAccentPreference()).toBe('ink');
    expect(getPrimaryLookPreference()).toBe('contrast');
    expect(getEffectPreference()).toBe('glow');
    expect(uni.setNavigationBarColor).toHaveBeenCalledWith(expect.objectContaining({
      backgroundColor: '#2c4a6e',
    }));
    expect(uni.setBackgroundColor).toHaveBeenCalledWith(expect.objectContaining({
      backgroundColor: '#f3f5f8',
    }));
    expect(getAppliedOutfitVars()).toMatchObject({
      '--dress-card-border-radius': '6px',
      '--dress-card-border-color': 'var(--text-color)',
      '--dress-grain-image': 'var(--grain-grid)',
    });
    await persistLocalDress('cards', 'cards-paper');
    hydrateOutfitStyle();
    expect(getAppliedOutfitVars()).toMatchObject({
      '--dress-card-border-radius': '4px',
      '--dress-card-background': 'var(--surface-color)',
    });
  });

  it('paints pack surfaces while overlay covers local dress', async () => {
    memoryStore({ [THEME_OVERLAY_STORAGE_KEY]: '1' });
    await persistActiveTheme('paper');
    expect(getAppliedOutfitVars()).toMatchObject({
      '--dress-card-border-radius': '4px',
      '--dress-card-background': 'var(--page-color)',
    });
    await persistLocalDress('cards', 'cards-round');
    hydrateOutfitStyle();
    expect(getAppliedOutfitVars()).toMatchObject({
      '--dress-card-border-radius': '4px',
      '--dress-card-background': 'var(--page-color)',
    });
    expect(getLocalDressMap()).toEqual({ cards: 'cards-round' });
  });

  it('posts decoration apply when signed in and rolls back on 403', async () => {
    memoryStore({
      token: 'token',
      [THEME_OVERLAY_STORAGE_KEY]: '0',
    });
    const apply = vi.spyOn(themeApi, 'applyThemeRemote').mockResolvedValueOnce({});
    const result = await persistLocalDress('cards', 'cards-plain');
    expect(result.ok).toBe(true);
    expect(apply).toHaveBeenCalledWith('decoration', 'cards-plain');
    expect(getLocalDressMap()).toEqual({ cards: 'cards-plain' });

    apply.mockRejectedValueOnce({
      statusCode: 403,
      data: { reason: 'privilege' },
    });
    const denied = await persistLocalDress('avatar', 'avatar-plain');
    expect(denied).toMatchObject({ ok: false, reason: 'privilege', queued: false });
    expect(getLocalDressMap()).toEqual({ cards: 'cards-plain' });
    expect(getRecentRaw().some((row) => row.id === 'avatar-plain')).toBe(false);
    expect(getRecentRaw().some((row) => row.id === 'cards-plain')).toBe(true);
    apply.mockRestore();
  });

  it('keeps local pack when apply is rate-limited', async () => {
    memoryStore({
      token: 'token',
      [THEME_OVERLAY_STORAGE_KEY]: '0',
    });
    const apply = vi.spyOn(themeApi, 'applyThemeRemote').mockRejectedValueOnce({
      statusCode: 429,
      data: { reason: 'rate' },
    });
    const result = await persistActiveTheme('paper');
    expect(result).toMatchObject({ ok: true, reason: 'rate', queued: true });
    expect(getActiveTheme().id).toBe('paper');
    apply.mockRestore();
  });

  it('keeps local dress when apply network fails, and can clear one group', async () => {
    memoryStore({
      token: 'token',
      [THEME_OVERLAY_STORAGE_KEY]: '0',
    });
    const apply = vi.spyOn(themeApi, 'applyThemeRemote').mockRejectedValueOnce(new Error('offline'));
    const result = await persistLocalDress('profile', 'profile-plain');
    expect(result.ok).toBe(true);
    expect(getLocalDressMap()).toEqual({ profile: 'profile-plain' });
    apply.mockRestore();

    await persistLocalDress('cards', 'cards-plain');
    expect(clearLocalDress('profile')).toMatchObject({ ok: true, cleared: true });
    expect(getLocalDressMap()).toEqual({ cards: 'cards-plain' });
    expect(clearLocalDress('profile').cleared).toBe(false);
  });

  it('records recent uses, dedupes, caps at 8, and skips upcoming packs', async () => {
    const store = memoryStore({ [THEME_OVERLAY_STORAGE_KEY]: '0' });
    await persistActiveTheme('default');
    await persistLocalDress('navbar', 'navbar-plain');
    await persistLocalDress('actions', 'actions-plain');
    await persistLocalDress('navbar', 'navbar-plain');
    const recents = getRecentRaw();
    expect(recents[0]).toMatchObject({ kind: 'dress', id: 'navbar-plain' });
    expect(recents.filter((row) => row.id === 'navbar-plain')).toHaveLength(1);
    expect((await persistLocalDress('navbar', 'navbar-glyph')).ok).toBe(false);
    expect(getRecentRaw().some((row) => row.id === 'navbar-glyph')).toBe(false);
    expect(recordRecentUse('theme', GLOBAL_THEMES.find((item) => item.id === 'chuankiang'))).toEqual(
      getRecentRaw(),
    );

    await persistLocalDress('cards', 'cards-plain');
    await persistLocalDress('profile', 'profile-plain');
    await persistLocalDress('avatar', 'avatar-plain');
    await persistLocalDress('tabbar', 'tabbar-plain');
    await persistLocalDress('navbar-font', 'navbar-font-plain');
    await persistLocalDress('tabbar-ornament', 'tabbar-ornament-plain');
    await persistLocalDress('cards-tag', 'cards-tag-plain');
    expect(getRecentRaw()).toHaveLength(8);
    expect(getRecentRaw().map((row) => row.id)).not.toContain('default');

    store[THEME_RECENT_STORAGE_KEY] = [
      {
        kind: 'theme',
        id: 'event-spring',
        name: '开春乡音',
        preview: 'festival',
        usedAt: 3,
      },
      {
        kind: 'dress',
        id: 'navbar-member',
        group: 'navbar',
        name: '会员顶栏细纹',
        preview: 'navbar',
        usedAt: 2,
      },
      {
        kind: 'dress',
        id: 'gone-card',
        group: 'cards',
        name: '旧录音卡',
        preview: 'cards',
        usedAt: 1,
      },
    ];
    const listed = listRecentUses({ isMiniProgram: true });
    expect(listed[0]).toMatchObject({
      status: 'ended',
      label: '⚠️已绝版',
      hint: '该装扮已绝版，无法再次使用',
      disabled: true,
    });
    expect(listed[1]).toMatchObject({
      status: 'blocked',
      label: '❌环境不支持',
      hint: '当前环境暂不支持该装扮',
      disabled: true,
    });
    expect(listed[2]).toMatchObject({
      status: 'retired',
      label: '📦已下架',
      hint: '装扮已下架',
      disabled: true,
    });

    store[THEME_RECENT_STORAGE_KEY] = [
      {
        kind: 'theme',
        id: 'member-pine',
        name: '松风会员',
        preview: 'simple',
        usedAt: 2,
      },
      {
        kind: 'dress',
        id: '',
        usedAt: 1,
      },
    ];
    const gated = listRecentUses();
    expect(gated).toHaveLength(1);
    expect(gated[0]).toMatchObject({
      id: 'member-pine',
      status: 'gated',
      disabled: true,
    });
    expect(gated[0].label).toContain('会员');
  });

  it('saves named outfits, caps at 10, and skips unavailable pieces on apply', () => {
    memoryStore({
      token: 'token',
      [THEME_OVERLAY_STORAGE_KEY]: '1',
      [THEME_PACK_STORAGE_KEY]: 'default',
      ui_local_dress: { cards: 'cards-plain' },
    });
    const saved = saveCurrentOutfit('川渝市井全套');
    expect(saved.ok).toBe(true);
    expect(getSavedOutfits()[0]).toMatchObject({
      name: '川渝市井全套',
      themeId: 'default',
      localDress: { cards: 'cards-plain' },
    });
    expect(saveCurrentOutfit('再存一次')).toEqual({ ok: false, reason: 'duplicate' });
    expect(uni.setStorageSync).toHaveBeenCalledWith(
      THEME_CLOUD_QUEUE_KEY,
      expect.objectContaining({ outfits: expect.any(Array) }),
    );

    const store = memoryStore({ [THEME_OVERLAY_STORAGE_KEY]: '1' });
    store[THEME_OUTFIT_STORAGE_KEY] = Array.from({ length: THEME_OUTFIT_LIMIT }, (_, index) => ({
      id: `outfit-${index}`,
      name: `方案${index}`,
      themeId: 'default',
      localDress: {},
      savedAt: index,
    }));
    expect(saveCurrentOutfit('江南吴语简约搭配')).toEqual({ ok: false, reason: 'limit' });

    const applied = applySavedOutfit({
      themeId: 'event-spring',
      localDress: {
        navbar: 'navbar-member',
        cards: 'cards-plain',
        avatar: 'gone-id',
      },
    }, { isMiniProgram: true });
    expect(applied).toMatchObject({
      ok: true,
      skipped: true,
      empty: false,
      themeId: 'default',
      localDress: { cards: 'cards-plain' },
    });
    expect(getActiveTheme().id).toBe('default');
    expect(getLocalDressMap()).toEqual({ cards: 'cards-plain' });
  });

  it('searches across tabs, greys upcoming packs, and keeps query local', () => {
    const store = memoryStore({ token: 'token' });
    const result = searchThemeCatalog('川渝烟火', {}, { isMiniProgram: false });
    expect(result.all.map((row) => row.item.id)).toContain('chuankiang');
    expect(result.themes.every((row) => row.item.available) === false).toBe(true);
    expect(result.queued).toBe(false);
    expect(store[THEME_QUERY_STORAGE_KEY]).toMatchObject({
      keyword: '川渝烟火',
      searching: true,
      sort: 'newest',
    });
    expect(store[THEME_SEARCH_CACHE_KEY]).toEqual(expect.objectContaining({
      keyword: '川渝烟火',
    }));
    expect(store[THEME_CLOUD_QUEUE_KEY]).toBeUndefined();

    expect(cleanSearchKeyword('<b>川渝</b>烟火<>')).toBe('川渝烟火');
    expect(cleanSearchKeyword('x'.repeat(80))).toHaveLength(THEME_SEARCH_KEYWORD_MAX);
    expect(searchThemeCatalog('<script>川渝烟火</script>').all.map((row) => row.item.id))
      .toContain('chuankiang');

    const avatar = searchThemeCatalog('方言头像框');
    expect(avatar.dresses.some((row) => row.item.name.includes('头像框'))).toBe(true);
    expect(queryThemeCatalog({ keyword: '录音卡片' }).dresses.length).toBeGreaterThan(0);

    const mixed = queryThemeCatalog({ keyword: '复古国风', sort: 'name' });
    expect(mixed.themes.map((row) => row.item.category)).toEqual(
      expect.arrayContaining(['retro', 'guofeng']),
    );
    const names = mixed.themes.map((row) => row.item.name);
    expect([...names].sort((left, right) => left.localeCompare(right, 'zh'))).toEqual(names);

    const ended = queryThemeCatalog({ status: 'ended' });
    expect(ended.themes.map((row) => row.item.id)).toContain('event-spring');
    expect(ended.dresses.map((row) => row.item.id)).toContain('avatar-event-end');

    const blocked = queryThemeCatalog({
      keyword: '会员顶栏',
      dressCategory: 'nav',
    }, { isMiniProgram: true });
    expect(blocked.dresses[0]).toMatchObject({
      blocked: true,
      item: expect.objectContaining({ id: 'navbar-member' }),
    });

    const regions = queryThemeCatalog({
      regions: ['chuankiang', 'wuyu'],
    });
    expect(regions.themes.map((row) => row.item.id)).toEqual(
      expect.arrayContaining(['chuankiang', 'wuyu']),
    );
    expect(queryThemeCatalog({ keyword: '没有这个装扮xyz' }).all).toHaveLength(0);
  });

  it('blocks live preview for upcoming packs and allows ended preview', () => {
    expect(canLivePreview(GLOBAL_THEMES[0])).toBe(true);
    expect(canLivePreview(GLOBAL_THEMES.find((item) => item.id === 'paper'))).toBe(true);
    expect(canLivePreview(GLOBAL_THEMES.find((item) => item.id === 'chuankiang'))).toBe(false);
    expect(canLivePreview(GLOBAL_THEMES.find((item) => item.id === 'event-spring'))).toBe(true);
    memoryStore({
      ui_local_dress: { navbar: 'navbar-plain' },
      ui_theme_overlay_local: '0',
    });
    const preview = composePreviewOutfit({ isMiniProgram: true });
    expect(preview.nativeLocked).toBe(true);
    expect(preview.skipped.some((row) => row.group?.id === 'navbar')).toBe(true);
    expect(preview.sample.recordings[0].caption).toBe('示例录音占位');
  });

  it('uses remote preview images only for http paths', () => {
    expect(isRemotePreviewSrc('default')).toBe(false);
    expect(isRemotePreviewSrc('simple')).toBe(false);
    expect(isRemotePreviewSrc('https://cdn.example/cover.webp')).toBe(true);
    expect(isRemotePreviewSrc('/static/cover.webp')).toBe(true);
    expect(previewCoverOf({ preview: 'simple' })).toBe('simple');
    expect(previewDetailOf({
      detail_img: 'https://cdn.example/detail.webp',
      preview: 'simple',
    })).toBe('https://cdn.example/detail.webp');
  });
});

describe('Theme center page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetThemeAnalyticsQueue();
    resetThemeFaultAdapters();
    resetThemeSessionState();
    isWechatMiniProgram.mockReturnValue(false);
    global.uni = {
      $emit: vi.fn(),
      $on: vi.fn(),
      $off: vi.fn(),
      getStorageSync: vi.fn(() => ''),
      setStorageSync: vi.fn(),
      removeStorageSync: vi.fn(),
      getSystemInfoSync: vi.fn(() => ({ theme: 'light' })),
      navigateTo: vi.fn(),
      setClipboardData: vi.fn(({ success }) => success && success()),
      saveImageToPhotosAlbum: vi.fn(({ complete }) => complete && complete()),
      onNetworkStatusChange: vi.fn(),
      report: vi.fn(),
    };
  });

  function mountPage() {
    return mount(ThemeCenterPage, {
      global: {
        stubs: {
          PageShell: {
            name: 'PageShell',
            props: ['title', 'actionText'],
            template: '<main><slot /><button v-if="actionText" class="shell-action" @click="$emit(\'action\')">{{ actionText }}</button></main>',
          },
          TSwitch: {
            name: 'TSwitch',
            props: ['value'],
            template: '<button class="switch" @click="$emit(\'change\', { value: !value })" />',
          },
          EmptyState: {
            name: 'EmptyState',
            props: ['title', 'actionText'],
            template: '<div class="empty">{{ title }}</div>',
          },
          BaseForm: {
            props: ['data', 'rules'],
            template: '<form><slot /></form>',
          },
          BaseField: {
            props: ['modelValue', 'name', 'label', 'placeholder', 'error', 'maxlength'],
            template: '<input class="outfit-name" :value="modelValue" />',
          },
          'scroll-view': { template: '<div><slot /></div>' },
          'movable-area': { template: '<div class="zoom-area"><slot /></div>' },
          'movable-view': { template: '<div><slot /></div>' },
        },
      },
    });
  }

  it('shows the live default pack and placeholder storefront', async () => {
    const wrapper = mountPage();
    expect(wrapper.text()).toContain('全局主题');
    expect(wrapper.text()).toContain('局部装扮');
    expect(wrapper.text()).toContain('默认方言主题');
    expect(wrapper.text()).toContain('当前使用');
    expect(wrapper.vm.themeActionLabel(GLOBAL_THEMES[0])).toBe('已启用');
    expect(wrapper.vm.themeActionLabel(
      GLOBAL_THEMES.find((item) => item.id === 'chuankiang'),
    )).toBe('敬请期待');
    expect(wrapper.vm.themeActionLabel(
      GLOBAL_THEMES.find((item) => item.id === 'paper'),
    )).toBe('立即启用');
    expect(wrapper.text()).toContain('敬请期待');
    expect(wrapper.text()).toContain('免费');
    expect(wrapper.text()).toContain('会员专属');
    expect(wrapper.text()).toContain('活动限定');
    expect(wrapper.text()).toContain('方言创作者专属');
    expect(wrapper.text()).toContain('已绝版');
    expect(wrapper.text()).toContain('我的收藏');
    expect(wrapper.text()).toContain('最新上架');
    expect(wrapper.text()).not.toContain('热度最高');
    wrapper.vm.openFilterSheet();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('热度最高');
    expect(wrapper.text()).toContain('免费优先');
    expect(wrapper.text()).toContain('名称A-Z');
    wrapper.vm.closeFilterSheet();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('热门搜索词');
    expect(wrapper.text()).toContain('筛选');
    expect(wrapper.text()).toContain('方言头像框');
    expect(wrapper.text()).toContain('可以通过方言地域标签快速筛选家乡风格装扮');
    expect(wrapper.text()).toContain('实时预览仅模拟展示效果');
    expect(wrapper.text()).toContain('收藏仅为个人标记');
    expect(wrapper.text()).toContain('部分限定装扮为限时活动产出');
    expect(wrapper.text()).toContain('会员装扮权益在H5、小程序两端同步');
    expect(wrapper.text()).toContain('最近使用');
    expect(wrapper.text()).toContain('暂无最近使用记录，快去挑选装扮吧');
    expect(wrapper.text()).toContain('最近使用记录仅记录你启用过的装扮');
    expect(wrapper.text()).toContain('已绝版、下架的装扮无法再次启用');
    expect(wrapper.text()).toContain('川渝烟火');
    expect(wrapper.text()).toContain('国风');
    expect(wrapper.text()).toContain('市井烟火');
    expect(wrapper.text()).toContain('二次元');
    expect(wrapper.text()).toContain('极简暗色');
    expect(wrapper.text()).toContain('节日限定');
    expect(wrapper.text()).toContain('节日风俗');
    expect(wrapper.text()).toContain('季节时令');
    expect(wrapper.text()).toContain('全局主题将统一改变导航栏、按钮、卡片、背景、文字色彩');
    expect(wrapper.text()).toContain('全局主题会带轻微地域纹理，不会改变录音播放内容');
    expect(wrapper.text()).not.toContain('短视频');
    expect(wrapper.text()).not.toContain('作品卡片');
    expect(wrapper.text()).not.toContain('作品');

    await wrapper.vm.onCardEnable({ id: 'paper', name: '素白纸本', available: false });
    expect(notify).toHaveBeenCalledWith({ title: '该主题暂未开放，敬请期待' });

    wrapper.vm.openDetail(GLOBAL_THEMES[0]);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('H5网页版：该主题全部样式完整生效');
    expect(wrapper.text()).not.toContain('微信小程序：原生导航栏、底部Tab栏受微信限制，部分样式无法生效');
    expect(wrapper.text()).toContain('会修改的元素');
    expect(wrapper.text()).toContain('导航栏配色');
    expect(wrapper.text()).toContain('实时预览');
    expect(wrapper.text()).toContain('预览仅为模拟效果，不会修改你的界面');
    expect(wrapper.text()).toContain('首页录音流');
    expect(wrapper.text()).toContain('个人中心');
    expect(wrapper.vm.detailTheme.name).toBe('默认方言主题');
    expect(wrapper.vm.canLivePreviewItem(GLOBAL_THEMES[0])).toBe(true);
    expect(wrapper.vm.canLivePreviewItem(
      GLOBAL_THEMES.find((item) => item.id === 'chuankiang'),
    )).toBe(false);
    expect(wrapper.vm.canLivePreviewItem(
      GLOBAL_THEMES.find((item) => item.id === 'event-spring'),
    )).toBe(true);

    wrapper.vm.openLivePreview('theme', GLOBAL_THEMES.find((item) => item.id === 'chuankiang'));
    expect(wrapper.vm.previewOpen).toBe(false);
    expect(notify).toHaveBeenCalledWith({ title: '该主题暂未开放，敬请期待' });
    wrapper.vm.openLivePreview('theme', GLOBAL_THEMES[0]);
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.previewOpen).toBe(true);
    expect(wrapper.text()).toContain('立即应用');
    expect(wrapper.text()).toContain('示例录音占位');
    expect(wrapper.text()).not.toContain('短视频');
    wrapper.vm.closePreview();
    expect(wrapper.vm.previewOpen).toBe(false);
    expect(getActiveTheme().id).toBe('default');

    await wrapper.vm.onCardEnable(GLOBAL_THEMES[0]);
    expect(confirmDialog).not.toHaveBeenCalled();

    wrapper.vm.category = 'missing';
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('当前筛选条件下暂无可用装扮');
  });

  it('keeps the live outfit when closing zoom or the preview sandbox', async () => {
    memoryStore({ [THEME_OVERLAY_STORAGE_KEY]: '0' });
    await persistLocalDress('cards', 'cards-plain');
    const wrapper = mountPage();
    wrapper.vm.openDetail(GLOBAL_THEMES[0]);
    await wrapper.vm.$nextTick();
    wrapper.vm.openZoom();
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.zoomOpen).toBe(true);
    expect(wrapper.text()).toContain('双指缩放查看细节，点空白关闭');
    expect(wrapper.text()).toContain('首页录音流');
    expect(wrapper.text()).not.toContain('短视频');
    expect(wrapper.text()).not.toContain('作品');
    wrapper.vm.closeZoom();
    expect(wrapper.vm.zoomOpen).toBe(false);
    wrapper.vm.openLivePreview('theme', GLOBAL_THEMES.find((item) => item.id === 'paper'));
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.previewOpen).toBe(true);
    wrapper.vm.closePreview();
    expect(wrapper.vm.previewOpen).toBe(false);
    expect(getActiveTheme().id).toBe('default');
    expect(getLocalDressMap()).toEqual({ cards: 'cards-plain' });
  });

  it('previews a skin card without writing the global outfit', async () => {
    const wrapper = mountPage();
    const paper = GLOBAL_THEMES.find((item) => item.id === 'paper');
    const radius = paper.style_json.cardBorderRadius;
    const applied = getAppliedOutfitVars();

    wrapper.vm.onSkinCardPreview(paper);
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.previewOpen).toBe(true);
    expect(wrapper.vm.previewItem.style_json).not.toBe(paper.style_json);
    wrapper.vm.previewItem.style_json.cardBorderRadius = '99px';
    expect(paper.style_json.cardBorderRadius).toBe(radius);
    expect(getActiveTheme().id).toBe('default');
    expect(getAppliedOutfitVars()).toEqual(applied);
    expect(wrapper.vm.livePreviewModel.skin).toMatchObject({
      name: paper.name,
      primary: expect.any(String),
      secondary: expect.any(String),
    });
    expect(describeSkinTokens(paper).previewImage != null).toBe(true);

    const previewVars = themePreviewVars(paper);
    previewVars['--dress-card-border-radius'] = '1px';
    expect(themePreviewVars(paper)['--dress-card-border-radius']).not.toBe('1px');

    wrapper.vm.closePreview();
    expect(wrapper.vm.previewOpen).toBe(false);
    expect(getActiveTheme().id).toBe('default');
    expect(getAppliedOutfitVars()).toEqual(applied);
  });

  it('opens detail from a recent theme card and routes dress recents to the list page', async () => {
    memoryStore({
      [THEME_RECENT_STORAGE_KEY]: [
        {
          kind: 'theme',
          id: 'default',
          name: '默认方言主题',
          preview: 'default',
          usedAt: 2,
        },
        {
          kind: 'dress',
          id: 'cards-plain',
          group: 'cards',
          name: '系统默认卡片',
          preview: 'cards',
          usedAt: 1,
        },
      ],
    });
    const wrapper = mountPage();
    wrapper.vm.refreshOutfit();
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.recentRows[0].id).toBe('default');
    wrapper.vm.onRecentTap(wrapper.vm.recentRows[0]);
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.detailTheme.id).toBe('default');
    expect(wrapper.text()).not.toContain('作品');

    wrapper.vm.tab = 'local';
    await wrapper.vm.$nextTick();
    wrapper.vm.onRecentTap(wrapper.vm.recentRows[0]);
    expect(uni.navigateTo).toHaveBeenCalledWith({
      url: expect.stringContaining('/pages/users/theme-dress?group=cards'),
    });
    expect(uni.navigateTo).toHaveBeenCalledWith({
      url: expect.stringContaining('id=cards-plain'),
    });
  });

  it('routes member, event, and creator actions without exposing gated skins', async () => {
    const wrapper = mountPage();
    const member = GLOBAL_THEMES.find((item) => item.id === 'member-pine');
    await wrapper.vm.onCardEnable(member);
    expect(confirmDialog).toHaveBeenCalledWith(expect.objectContaining({
      confirmText: '开通会员',
      cancelText: '取消',
      content: expect.stringContaining('解锁全部会员全局主题、会员局部装扮'),
    }));
    expect(uni.navigateTo).toHaveBeenCalledWith({
      url: '/pages/users/theme-member',
    });

    const ended = GLOBAL_THEMES.find((item) => item.id === 'event-spring');
    await wrapper.vm.onCardEnable(ended);
    expect(notify).toHaveBeenCalledWith({ title: '该限定装扮活动已结束，无法获取' });

    const creator = GLOBAL_THEMES.find((item) => item.id === 'creator-tile');
    await wrapper.vm.onCardEnable(creator);
    expect(notify).toHaveBeenCalledWith({ title: '暂未满足解锁条件，请完成方言创作任务' });
    expect(uni.navigateTo).toHaveBeenCalledWith({
      url: '/pages/users/theme-acquire?focus=creator',
    });

    const event = GLOBAL_THEMES.find((item) => item.id === 'event-lantern');
    await wrapper.vm.onCardEnable(event);
    expect(uni.navigateTo).toHaveBeenCalledWith({
      url: '/pages/users/theme-event?id=event-lantern&kind=theme',
    });

    await wrapper.vm.onAcquire();
    expect(uni.navigateTo).toHaveBeenCalledWith({
      url: '/pages/users/theme-acquire',
    });
  });

  it('lists local dress groups and opens the dress page', async () => {
    const wrapper = mountPage();
    await wrapper.findAll('.tab').at(1).trigger('tap');
    expect(wrapper.text()).toContain('局部装扮可单独修改界面组件，不会强制替换整套全局主题');
    expect(wrapper.text()).toContain('小程序部分原生组件暂不支持自定义装扮');
    expect(wrapper.text()).toContain('最近使用');
    expect(wrapper.text()).toContain('暂无最近使用记录，快去挑选装扮吧');
    expect(wrapper.text()).toContain('导航栏底色与图标');
    expect(wrapper.text()).toContain('底部Tab栏样式');
    expect(wrapper.text()).toContain('交互按钮样式');
    expect(wrapper.text()).toContain('录音卡片背景');
    expect(wrapper.text()).toContain('个人主页背景');
    expect(wrapper.text()).toContain('头像框&装饰挂件');
    expect(wrapper.text()).toContain('评论气泡样式');
    expect(wrapper.text()).toContain('方言话题卡片');
    expect(wrapper.text()).not.toContain('装扮素材即将上线');
    expect(wrapper.text()).toContain('我的装扮');
    expect(wrapper.text()).toContain('导航栏');
    expect(wrapper.text()).toContain('交互按钮');
    expect(wrapper.text()).toContain('录音卡片');
    expect(wrapper.text()).toContain('评论区');
    expect(wrapper.text()).not.toContain('头像挂件');
    wrapper.vm.openFilterSheet();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('头像挂件');
    wrapper.vm.closeFilterSheet();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('江南吴语头像框');
    expect(wrapper.text()).not.toContain('作品卡片');
    expect(wrapper.text()).not.toContain('短视频');

    wrapper.vm.dressCategory = 'avatar';
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('头像框&装饰挂件');
    expect(wrapper.text()).not.toContain('导航栏底色与图标');

    wrapper.vm.dressCategory = 'missing';
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('该分类装扮素材即将上线，敬请期待');

    await wrapper.vm.onOpenDress({ id: 'navbar', blocked: false });
    expect(uni.navigateTo).toHaveBeenCalledWith({
      url: '/pages/users/theme-dress?group=navbar',
    });
  });

  it('hides native dress groups on the mini program', async () => {
    isWechatMiniProgram.mockReturnValue(true);
    const wrapper = mountPage();
    await wrapper.findAll('.tab').at(1).trigger('tap');
    expect(wrapper.vm.dressGroups.find((group) => group.id === 'navbar')).toBeUndefined();
    expect(wrapper.vm.dressGroups.find((group) => group.id === 'tabbar')).toBeUndefined();
    const actions = wrapper.vm.dressGroups.find((group) => group.id === 'actions');
    const cards = wrapper.vm.dressGroups.find((group) => group.id === 'cards');
    expect(actions.blocked).toBe(false);
    expect(cards.blocked).toBe(false);
    expect(wrapper.text()).toContain('录音卡片');
    expect(wrapper.text()).not.toContain('小程序暂不支持该组件装扮');
    expect(wrapper.text()).not.toContain('导航栏底色与图标');
    wrapper.vm.openDetail(GLOBAL_THEMES[0]);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('微信小程序：原生导航栏、底部Tab栏受微信限制，部分样式无法生效');
    expect(wrapper.text()).not.toContain('H5网页版：该主题全部样式完整生效');
  });

  it('summarizes the live outfit, preview, and reset on the mine tab', async () => {
    const store = {
      ui_local_dress: { navbar: 'navbar-plain', actions: 'actions-plain' },
      ui_theme_overlay_local: '0',
    };
    uni.getStorageSync.mockImplementation((key) => store[key] ?? '');
    uni.setStorageSync.mockImplementation((key, value) => {
      store[key] = value;
    });
    const wrapper = mountPage();
    wrapper.vm.refreshOutfit();
    await wrapper.findAll('.tab').at(3).trigger('tap');
    expect(wrapper.text()).toContain('当前正在使用：默认方言主题');
    expect(wrapper.text()).toContain('全局主题会统一修改整套界面风格');
    expect(wrapper.text()).toContain('简约');
    expect(wrapper.text()).toContain('还没有保存任何搭配方案，可将当前装扮保存为专属搭配');
    expect(wrapper.text()).toContain('系统默认顶栏');
    expect(wrapper.text()).toContain('系统默认按钮');
    expect(wrapper.text()).toContain('暂未设置该组件装扮');
    expect(wrapper.text()).toContain('录音卡片背景');
    expect(wrapper.text()).toContain('当前生效');
    expect(wrapper.text()).toContain('装扮冲突设置');
    expect(wrapper.text()).toContain('全局主题覆盖局部装扮');
    expect(wrapper.find('.action-stack').exists()).toBe(true);
    expect(wrapper.text()).toContain('未登录状态，装扮仅保存在本地，登录后可同步到云端');
    expect(wrapper.text()).not.toContain('短视频');
    expect(wrapper.text()).not.toContain('作品');

    wrapper.vm.openPreview();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('装扮效果预览');
    expect(wrapper.text()).toContain('预览仅为模拟效果，不会修改你的界面');
    expect(wrapper.text()).toContain('评论区');
    expect(wrapper.text()).toContain('话题卡片');
    expect(wrapper.text()).toContain('示例录音占位');
    expect(wrapper.find('.preview-sheet').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('短视频');
    expect(wrapper.text()).not.toContain('作品');
    await wrapper.vm.onConfirmPreview();
    expect(wrapper.vm.previewOpen).toBe(false);
    expect(notifySuccess).toHaveBeenCalledWith('装扮已生效');

    wrapper.vm.onChangeTheme();
    expect(wrapper.vm.tab).toBe('global');

    await wrapper.vm.onResetDress();
    expect(confirmDialog).toHaveBeenCalledWith(expect.objectContaining({
      content: '确定重置所有装扮？将恢复系统默认样式，已保存的搭配方案不会删除',
    }));
    expect(notifySuccess).toHaveBeenCalledWith('已恢复为默认样式');
    expect(wrapper.vm.savedOutfits).toEqual([]);

    wrapper.vm.onOpenSaveOutfit();
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.outfitSheet).toBe(true);
    expect(wrapper.text()).toContain('将当前全局主题与局部装扮保存为一套方案');
    wrapper.vm.outfitForm.name = '川渝市井全套';
    wrapper.vm.onConfirmOutfitSheet();
    expect(notifySuccess).toHaveBeenCalledWith('已保存这套装扮搭配');
    expect(wrapper.vm.savedOutfits[0].name).toBe('川渝市井全套');

    await wrapper.vm.onApplyOutfit(wrapper.vm.savedOutfits[0]);
    expect(confirmDialog).toHaveBeenCalledWith(expect.objectContaining({
      title: '是否一键应用这套历史搭配？',
      content: '注意：将会覆盖当前全局主题与局部装扮配置。',
    }));
    expect(notifySuccess).toHaveBeenCalledWith('已应用历史搭配方案');
  });

  it('marks native dress as inactive on the mini program mine tab', async () => {
    isWechatMiniProgram.mockReturnValue(true);
    uni.getStorageSync.mockImplementation((key) => {
      if (key === 'ui_local_dress') return { navbar: 'navbar-plain' };
      if (key === 'ui_theme_overlay_local') return '0';
      return '';
    });
    const wrapper = mountPage();
    wrapper.vm.refreshOutfit();
    await wrapper.findAll('.tab').at(3).trigger('tap');
    const nativeRow = wrapper.vm.appliedDress.find((entry) => entry.group.id === 'navbar');
    expect(wrapper.vm.dressStatus(nativeRow)).toBe('当前环境不生效');
    expect(wrapper.text()).toContain('当前环境不生效');
    wrapper.vm.openPreview();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('⚠️微信小程序原生组件无法自定义，该部分样式不会生效');
    expect(wrapper.text()).toContain('该装扮当前环境不生效');
    wrapper.vm.openDetail(GLOBAL_THEMES[0]);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('⚠️小程序部分原生组件为系统默认样式');
    await wrapper.vm.onConfirmPreview();
    expect(notifySuccess).toHaveBeenCalledWith('装扮已生效');
    expect(notify).toHaveBeenCalledWith({ title: '部分装扮当前环境无法生效，已跳过' });
  });

  it('searches hot keywords, greys upcoming hits, and keeps filter state', async () => {
    const store = {};
    uni.getStorageSync.mockImplementation((key) => store[key] ?? '');
    uni.setStorageSync.mockImplementation((key, value) => {
      store[key] = value;
    });
    const wrapper = mountPage();
    await wrapper.vm.onHotKeyword('川渝烟火');
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.searching).toBe(true);
    expect(wrapper.vm.searchRows.map((row) => row.item.id)).toContain('chuankiang');
    expect(wrapper.vm.searchActionDisabled(
      wrapper.vm.searchRows.find((row) => row.item.id === 'chuankiang'),
    )).toBe(true);
    expect(wrapper.text()).toContain('敬请期待');

    wrapper.vm.searchForm.keyword = 'xyz-not-a-skin';
    wrapper.vm.submitThemeSearch();
    await wrapper.vm.$nextTick();
    expect(notify).toHaveBeenCalledWith({ title: '没有匹配的主题装扮，请更换关键词' });
    expect(wrapper.text()).toContain('没有找到相关主题或装扮，换个关键词试试');

    wrapper.vm.exitSearch();
    wrapper.vm.searchForm.keyword = '<script></script>';
    wrapper.vm.submitThemeSearch();
    expect(wrapper.vm.searching).toBe(false);

    wrapper.vm.openFilterSheet();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('权限筛选');
    expect(wrapper.text()).toContain('地域方言标签');
    expect(wrapper.text()).toContain('可多选家乡风格');
    expect(wrapper.text()).not.toContain('装扮组件');
    expect(wrapper.text()).not.toContain('作品卡片');
    expect(wrapper.text()).not.toContain('短视频');
    wrapper.vm.filterDraft.status = 'ended';
    wrapper.vm.onConfirmFilter();
    expect(wrapper.vm.statusFilter).toBe('ended');
    expect(wrapper.vm.visibleThemes.map((item) => item.id)).toContain('event-spring');
    expect(wrapper.vm.hasExtraFilters).toBe(true);
  });

  it('summarizes only filters that belong to the active catalog context', async () => {
    const wrapper = mountPage();
    wrapper.vm.category = 'dialect';
    wrapper.vm.regions = ['chuankiang'];
    wrapper.vm.themeSort = 'heat';
    expect(wrapper.vm.filterContext).toBe('global');
    expect(wrapper.vm.filterSummary).toContain('地域方言风');
    expect(wrapper.vm.filterSummary).toContain('川渝');
    expect(wrapper.vm.filterSummary).toContain('热度最高');
    expect(wrapper.vm.hasExtraFilters).toBe(true);

    wrapper.vm.tab = 'local';
    expect(wrapper.vm.filterContext).toBe('local');
    expect(wrapper.vm.filterSummary).not.toContain('地域方言风');
    expect(wrapper.vm.filterSummary).not.toContain('川渝');
    expect(wrapper.vm.hasExtraFilters).toBe(false);

    wrapper.vm.dressCategory = 'cards';
    expect(wrapper.vm.filterSummary).toContain('录音卡片');
    expect(wrapper.vm.hasExtraFilters).toBe(true);

    wrapper.vm.searching = true;
    expect(wrapper.vm.filterContext).toBe('search');
    expect(wrapper.vm.filterSummary).toContain('地域方言风');
    expect(wrapper.vm.filterSummary).toContain('川渝');
    expect(wrapper.vm.filterSummary).toContain('录音卡片');
  });

  it('favorites, likes, and shares live packs but blocks upcoming placeholders', async () => {
    const store = {};
    uni.getStorageSync.mockImplementation((key) => store[key] ?? '');
    uni.setStorageSync.mockImplementation((key, value) => {
      store[key] = value;
    });
    const wrapper = mountPage();
    expect(wrapper.text()).toContain('我的收藏');
    wrapper.vm.tab = 'favorites';
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('你还没有收藏任何主题装扮，快去挑选喜欢的吧');

    await wrapper.vm.onToggleFavorite('theme', GLOBAL_THEMES[0]);
    expect(notifySuccess).toHaveBeenCalledWith('已收藏该主题');
    wrapper.vm.tab = 'favorites';
    wrapper.vm.refreshOutfit();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('默认方言主题');

    await wrapper.vm.onToggleLike('theme', GLOBAL_THEMES[0]);
    expect(wrapper.vm.statsOf('theme', GLOBAL_THEMES[0]).liked).toBe(true);

    await wrapper.vm.onShare('theme', GLOBAL_THEMES[0]);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('分享这个主题');
    expect(wrapper.text()).toContain('快来看看这个【默认方言主题】方言主题，太有家乡味道了！');
    expect(wrapper.text()).toContain('分享给好友');
    expect(wrapper.text()).toContain('复制链接');

    await wrapper.vm.onToggleFavorite('theme', GLOBAL_THEMES.find((item) => item.id === 'chuankiang'));
    expect(notify).toHaveBeenCalledWith({ title: '待上线装扮暂不支持收藏' });
    await wrapper.vm.onShare('theme', GLOBAL_THEMES.find((item) => item.id === 'chuankiang'));
    expect(notify).toHaveBeenCalledWith({ title: '待上线装扮暂不支持分享' });
    expect(wrapper.text()).not.toContain('短视频');
    expect(wrapper.text()).not.toContain('作品');
  });

  it('keeps ended skins collectable and uses catalog heat when counts exist', () => {
    memoryStore();
    const ended = GLOBAL_THEMES.find((item) => item.id === 'event-spring');
    expect(toggleFavorite('theme', ended).ok).toBe(true);
    expect(isFavorited('theme', 'event-spring')).toBe(true);
    expect(toggleFavorite('theme', GLOBAL_THEMES.find((item) => item.id === 'chuankiang')).ok).toBe(false);
    expect(socialStats('theme', {
      id: 'default',
      collect_count: 10,
      share_count: 2,
      like_count: 1,
    }).likes).toBe(13);
    expect(themeShareCopy({ name: '川渝烟火', region: 'chuankiang' }, 'theme'))
      .toBe('巴适得很，这个川渝乡音主题来看哈！');
    expect(themeShareCopy(GLOBAL_THEMES[0], 'theme')).toContain('默认方言主题');
    expect(cleanThemeShareQuery('default"><img src=x>')).toBe('defaultimgsrcx');
  });

  it('rolls back a local favorite when the server rejects coming collect', async () => {
    memoryStore({ token: 'token' });
    vi.spyOn(themeApi, 'collectThemeRemote').mockRejectedValueOnce({
      statusCode: 409,
      data: { reason: 'coming' },
    });
    const live = GLOBAL_THEMES.find((item) => item.id === 'default');
    const result = await toggleFavorite('theme', live);
    expect(result).toEqual({ ok: false, reason: 'upcoming', favorited: false });
    expect(isFavorited('theme', 'default')).toBe(false);
  });

  it('keeps missing catalog ids in the favorite list as retired rows', () => {
    memoryStore();
    hydrateFavoriteMap([
      { item_type: 'theme', item_id: 'gone-theme' },
      { item_type: 'theme', item_id: 'default' },
    ]);
    const rows = listFavorites('theme');
    expect(rows.map((row) => row.item.id)).toEqual(['gone-theme', 'default']);
    expect(rows[0].item.name).toBe('装扮已下架');
    expect(rows[0].item.removed).toBe(true);
    expect(uni.setStorageSync).toHaveBeenCalledWith(
      THEME_FAVORITE_STORAGE_KEY,
      expect.objectContaining({ themes: ['gone-theme', 'default'] }),
    );
  });

  it('reports enter, tab, detail, search and apply analytics', async () => {
    const wrapper = mountPage();
    wrapper.vm.reportThemeCenterEnter();
    expect(getThemeAnalyticsQueue().some((row) => (
      row.event === 'theme_center_enter'
      && row.params.theme_id === 'default'
      && row.params.logged_in === 'guest'
    ))).toBe(true);

    wrapper.vm.onTabSwitch('local');
    expect(getThemeAnalyticsQueue().some((row) => (
      row.event === 'theme_tab_switch' && row.params.tab === '局部装扮'
    ))).toBe(true);

    const upcoming = GLOBAL_THEMES.find((item) => item.id === 'chuankiang');
    wrapper.vm.openDetail(upcoming);
    await wrapper.vm.$nextTick();
    expect(getThemeAnalyticsQueue().some((row) => (
      row.event === 'theme_item_enter_detail'
      && row.params.item_id === 'chuankiang'
      && row.params.catalog_status === 'upcoming'
    ))).toBe(true);
    expect(getThemeAnalyticsQueue().some((row) => (
      row.event === 'theme_preview_click' && row.params.preview_type === '大图预览'
    ))).toBe(true);

    await wrapper.vm.onCardEnable(upcoming);
    expect(getThemeAnalyticsQueue().some((row) => (
      row.event === 'theme_apply_invalid_item'
      && row.params.item_status === '已下架'
    ))).toBe(true);

    await wrapper.vm.onHotKeyword('川渝烟火');
    expect(getThemeAnalyticsQueue().some((row) => (
      row.event === 'theme_hot_search_click' && row.params.keyword === '川渝烟火'
    ))).toBe(true);
    expect(getThemeAnalyticsQueue().some((row) => (
      row.event === 'theme_search' && Number(row.params.result_count) > 0
    ))).toBe(true);

    wrapper.vm.filterDraft = {
      ...wrapper.vm.catalogQuery,
      access: 'member',
      regions: ['chuankiang'],
      sort: 'heat',
    };
    wrapper.vm.onConfirmFilter();
    expect(getThemeAnalyticsQueue().some((row) => (
      row.event === 'theme_filter_click'
      && row.params.access_filter === '会员专属'
      && row.params.region_tags === '川渝'
    ))).toBe(true);

    await wrapper.vm.onToggleFavorite('theme', GLOBAL_THEMES[0]);
    expect(getThemeAnalyticsQueue().some((row) => (
      row.event === 'theme_collect_click' && row.params.collect_state === '收藏'
    ))).toBe(true);

    wrapper.vm.onOverlayChange(false);
    expect(getThemeAnalyticsQueue().some((row) => (
      row.event === 'theme_switch_conflict' && row.params.overlay === '关闭'
    ))).toBe(true);

    await wrapper.vm.onResetDress();
    expect(getThemeAnalyticsQueue().some((row) => row.event === 'theme_reset_all')).toBe(true);

    wrapper.vm.reportThemeListScroll(88);
    expect(getThemeAnalyticsQueue().some((row) => (
      row.event === 'theme_list_scroll' && row.params.scroll_top === '88'
    ))).toBe(true);
  });

  it('shows a retry empty state when the catalog request fails', async () => {
    const wrapper = mountPage();
    wrapper.vm.catalogFail = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('装扮列表加载失败，请检查网络后重试');
  });

  it('clears applied filters from the empty-state action', async () => {
    const wrapper = mountPage();
    wrapper.vm.accessFilter = 'member';
    wrapper.vm.regions = ['chuankiang'];
    wrapper.vm.onClearAppliedFilters();
    expect(wrapper.vm.accessFilter).toBe('all');
    expect(wrapper.vm.regions).toEqual([]);
    expect(wrapper.vm.themeListEmptyScene).toBe('catalog');
  });

  it('asks before turning overlay on when local dress exists', async () => {
    memoryStore({
      [THEME_OVERLAY_STORAGE_KEY]: '0',
      ui_local_dress: { cards: 'cards-plain' },
    });
    const wrapper = mountPage();
    wrapper.vm.refreshOutfit();
    confirmDialog.mockResolvedValueOnce(false);
    await wrapper.vm.onOverlayChange(true);
    expect(confirmDialog).toHaveBeenCalledWith(expect.objectContaining({
      content: '开启全局主题覆盖局部装扮后，自定义局部装扮将不会生效，是否继续？',
      confirmText: '确认开启',
      cancelText: '取消',
    }));
    expect(wrapper.vm.overlay).toBe(false);
  });

  it('opens a dialog when saved outfits hit the cap', async () => {
    const store = memoryStore({ [THEME_OVERLAY_STORAGE_KEY]: '0' });
    store[THEME_OUTFIT_STORAGE_KEY] = Array.from({ length: THEME_OUTFIT_LIMIT }, (_, index) => ({
      id: `outfit-${index}`,
      name: `方案${index}`,
      themeId: 'default',
      localDress: {},
      savedAt: index,
    }));
    const wrapper = mountPage();
    wrapper.vm.refreshOutfit();
    wrapper.vm.onOpenSaveOutfit();
    wrapper.vm.outfitForm.name = '新搭配';
    await wrapper.vm.onConfirmOutfitSheet();
    expect(confirmDialog).toHaveBeenCalledWith(expect.objectContaining({
      content: '已达到最大保存数量，请删除旧搭配方案后再保存',
    }));
  });

  it('skips removed dresses when applying a saved mix', async () => {
    memoryStore({ [THEME_OVERLAY_STORAGE_KEY]: '0' });
    const wrapper = mountPage();
    await wrapper.vm.onApplyOutfit({
      themeId: 'event-spring',
      localDress: { avatar: 'gone-id' },
      overlay: true,
    });
    expect(notify).toHaveBeenCalledWith({ title: THEME_FAULT_TOAST.mixEmpty });
    expect(getOverlayLocalDress()).toBe(true);
  });

  it('hydrates saved mixes from cloud decoration maps', () => {
    memoryStore();
    hydrateSavedOutfits([
      {
        mix_id: 'mix-home',
        mix_name: '巷口搭配',
        global_theme_id: 'default',
        decoration_map: { card: 'cards-plain' },
        is_cover_local_decoration: false,
        create_time: '2026-08-31T00:00:00.000Z',
      },
    ]);
    expect(getSavedOutfits()[0]).toMatchObject({
      id: 'mix-home',
      name: '巷口搭配',
      themeId: 'default',
      localDress: { cards: 'cards-plain' },
      overlay: false,
    });
  });

  it('previews a mix in the sandbox without writing the live outfit', () => {
    memoryStore({
      [THEME_PACK_STORAGE_KEY]: 'default',
      ui_local_dress: { cards: 'cards-plain' },
      [THEME_OVERLAY_STORAGE_KEY]: '1',
    });
    const preview = composePreviewOutfit({
      themeId: 'paper',
      localDress: { avatar: 'avatar-plain' },
      overlay: false,
      isMiniProgram: false,
    });
    expect(preview.theme.id).toBe('paper');
    expect(preview.vars).toMatchObject({
      '--dress-card-border-radius': '4px',
      '--dress-card-background': 'var(--page-color)',
    });
    expect(getActiveTheme().id).toBe('default');
    expect(getLocalDressMap()).toEqual({ cards: 'cards-plain' });
    expect(getOverlayLocalDress()).toBe(true);
  });

  it('shows the login merge sheet', async () => {
    const wrapper = mountPage();
    wrapper.vm.mergeSheet = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('检测到本地存在装扮配置，是否合并到账号？');
    expect(wrapper.text()).toContain('使用云端配置');
    expect(wrapper.text()).toContain('使用本地配置');
    expect(wrapper.text()).toContain('合并两者');
  });

  it('treats outfit tab and search as in-page subpages on back', async () => {
    const wrapper = mountPage();
    wrapper.vm.tab = 'mine';
    wrapper.vm.onThemeNavBack();
    expect(wrapper.vm.tab).toBe('global');

    wrapper.vm.searching = true;
    wrapper.vm.searchForm.keyword = '川渝';
    wrapper.vm.onThemeNavBack();
    expect(wrapper.vm.searching).toBe(false);
  });

  it('maps outfit and search helpers onto theme-center query', () => {
    goThemeOutfit();
    expect(uni.navigateTo).toHaveBeenCalledWith({
      url: `${ROUTES.themeCenter}?tab=mine`,
    });
    goThemeSearch('川渝');
    expect(uni.navigateTo).toHaveBeenCalledWith({
      url: `${ROUTES.themeCenter}?searching=1&q=${encodeURIComponent('川渝')}`,
    });
  });

  it('reports shell scroll and toasts a broken cover only once', () => {
    vi.useFakeTimers();
    const wrapper = mountPage();
    const spy = vi.spyOn(wrapper.vm, 'reportThemeListScroll');
    wrapper.vm.onShellScroll({ scrollTop: 160 });
    vi.advanceTimersByTime(400);
    expect(spy).toHaveBeenCalledWith(160);
    wrapper.vm.onPreviewImgError('paper');
    wrapper.vm.onPreviewImgError('nightferry');
    expect(notify).toHaveBeenCalledWith({ title: THEME_FAULT_TOAST.resource });
    expect(notify.mock.calls.filter((call) => (
      call[0]?.title === THEME_FAULT_TOAST.resource
    ))).toHaveLength(1);
    vi.useRealTimers();
  });
});
