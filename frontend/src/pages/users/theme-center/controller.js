import confirmDialog from '@/components/ConfirmDialog';
import { isLoggedIn } from '@/services/authGuard';
import { notify, notifySuccess } from '@/services/feedback';
import {
  goThemeAcquire,
  goThemeDress,
  goThemeEvent,
  goThemeMember,
  ROUTES,
} from '@/services/navigation';
import { isWechatMiniProgram } from '@/services/platform';
import {
  getThemePreference,
  setThemePreference,
  THEME_OPTIONS,
} from '@/services/theme';
import { pullThemeCloudState } from '@/services/themeApi';
import {
  trackThemeApply,
  trackThemeApplyInvalid,
  trackThemeApplyMix,
  trackThemeCenterEnter,
  trackThemeCenterLeave,
  trackThemeCollect,
  trackThemeFault,
  trackThemeFilterClick,
  trackThemeGet,
  trackThemeHotSearch,
  trackThemeItemDetail,
  trackThemeListScroll,
  trackThemeMixManage,
  trackThemePreview,
  trackThemeResetAll,
  trackThemeSaveMix,
  trackThemeSearch,
  trackThemeSwitchConflict,
  trackThemeTabSwitch,
  trackThemeUnsupportedEnv,
  trackThemePerfListReady,
} from '@/services/themeAnalytics';
import {
  accessActionLabel,
  accessTagClass,
  applyRecent,
  applySavedOutfit,
  canLivePreview,
  catalogStatus,
  claimSkin,
  cleanSearchKeyword,
  clearLocalDress,
  cloneCatalogItem,
  composePreviewOutfit,
  defaultThemeQuery,
  deleteSavedOutfit,
  describeAccess,
  DIALECT_REGIONS,
  DRESS_CATEGORIES,
  dressDisplayTags,
  FAVORITE_FILTERS,
  getActiveTheme,
  getDressGroup,
  getDressItem,
  getLocalDressMap,
  getOverlayLocalDress,
  getSavedOutfits,
  getThemeById,
  getThemeQuery,
  isFavorited,
  isRemotePreviewSrc,
  listAcquireOffers,
  listDressGroupsByCategory,
  listFavorites,
  listOutfitHubDress,
  listOwnedUnused,
  listRecentUses,
  listThemesByCategory,
  mergeRemoteCatalog,
  persistActiveTheme,
  persistCurrentOutfit,
  persistLocalDress,
  persistThemeQuery,
  previewCoverOf,
  previewDetailOf,
  queryThemeCatalog,
  renameSavedOutfit,
  resetAllDress,
  saveCurrentOutfit,
  searchThemeCatalog,
  setOverlayLocalDress,
  socialStats,
  themeDisplayTags,
  themePreviewShotClass,
  themePreviewVars,
  THEME_ACCESS_FILTERS,
  THEME_ACCESS_FOOTER,
  THEME_CATEGORIES,
  THEME_FEATURE_ITEMS,
  THEME_FILTER_FOOTER,
  THEME_GUEST_FOOTER,
  THEME_HISTORY_FOOTER,
  THEME_HOT_KEYWORDS,
  THEME_PREVIEW_FOOTER,
  THEME_PREVIEW_ZOOM_HINT,
  THEME_SEARCH_TABS,
  THEME_SOCIAL_FOOTER,
  THEME_SORTS,
  THEME_STATUS_FILTERS,
  toggleFavorite,
  toggleLike,
} from '@/services/themeCenter';
import {
  abortThemePreview,
  applyThemeMergeChoice,
  beginThemeApply,
  beginThemePreview,
  bindThemeNetworkFlush,
  guestThemeSnapshot,
  handleThemeAccountLogin,
  isThemeSdkSupported,
  loadThemeCatalog,
  refreshThemeMemberStatus,
  THEME_FAULT_TOAST,
} from '@/services/themeFault';
import { cleanThemeShareQuery, themeSharePayload } from '@/utils/themeShare';

export default {
  data() {
    return {
      ROUTES,
      tab: 'global',
      category: 'all',
      dialectRegion: 'all',
      dressCategory: 'all',
      themeSort: 'newest',
      accessFilter: 'all',
      statusFilter: 'all',
      regions: [],
      searching: false,
      resultTab: 'all',
      searchForm: { keyword: '' },
      searchResult: { themes: [], dresses: [], all: [] },
      filterSheet: false,
      filterDraft: defaultThemeQuery(),
      favoriteFilter: 'all',
      categories: THEME_CATEGORIES,
      dialectRegions: DIALECT_REGIONS,
      dressCategories: DRESS_CATEGORIES,
      sortOptions: THEME_SORTS,
      accessFilters: THEME_ACCESS_FILTERS,
      statusFilters: THEME_STATUS_FILTERS,
      searchTabs: THEME_SEARCH_TABS,
      hotKeywords: THEME_HOT_KEYWORDS,
      favoriteFilters: FAVORITE_FILTERS,
      themeFeatures: THEME_FEATURE_ITEMS,
      appearanceOptions: THEME_OPTIONS,
      appearance: getThemePreference(),
      isMiniProgram: isWechatMiniProgram(),
      activeTheme: getActiveTheme(),
      overlay: getOverlayLocalDress(),
      appliedDress: [],
      ownedUnused: { themes: [], dresses: [] },
      acquireOffers: { themes: [], dresses: [] },
      favoriteEntries: [],
      accessFooter: THEME_ACCESS_FOOTER,
      socialFooter: THEME_SOCIAL_FOOTER,
      historyFooter: THEME_HISTORY_FOOTER,
      filterFooter: THEME_FILTER_FOOTER,
      previewFooter: THEME_PREVIEW_FOOTER,
      zoomHint: THEME_PREVIEW_ZOOM_HINT,
      socialTick: 0,
      detailTheme: null,
      shareTarget: null,
      previewOpen: false,
      zoomOpen: false,
      coverFailed: {},
      previewMode: 'outfit',
      previewItem: null,
      previewOutfit: null,
      previewModel: null,
      scrollTimer: 0,
      recentThemes: [],
      recentDresses: [],
      savedOutfits: [],
      outfitSheet: false,
      outfitMode: 'save',
      outfitTargetId: '',
      outfitForm: { name: '' },
      outfitError: '',
      outfitRules: {
        name: [{ required: true, message: '请输入搭配名称' }],
      },
      catalogFail: false,
      catalogLoading: false,
      catalogStale: false,
      memberSyncing: false,
      sdkSupported: true,
      mergeSheet: false,
      mergeSnapshot: null,
    };
  },
  computed: {
    recentRows() {
      return this.tab === 'local' ? this.recentDresses : this.recentThemes;
    },
    navInterceptBack() {
      return this.searching || this.tab === 'mine';
    },
    showFilterBar() {
      return this.searching || this.tab === 'global' || this.tab === 'local';
    },
    filterContext() {
      if (this.searching) return 'search';
      return this.tab === 'local' ? 'local' : 'global';
    },
    hasExtraFilters() {
      const shared = this.accessFilter !== 'all' || this.statusFilter !== 'all';
      const global = this.category !== 'all' || this.regions.length > 0;
      const local = this.dressCategory !== 'all';
      if (this.filterContext === 'search') return shared || global || local;
      return shared || (this.filterContext === 'local' ? local : global);
    },
    showDressItems() {
      return this.hasExtraFilters;
    },
    themeListEmptyScene() {
      return this.hasExtraFilters ? 'filter' : 'catalog';
    },
    filterSummary() {
      const bits = [];
      if (this.filterContext !== 'local' && this.category !== 'all') {
        bits.push(this.categories.find((item) => item.value === this.category)?.label);
      }
      if (this.accessFilter !== 'all') {
        bits.push(this.accessFilters.find((item) => item.value === this.accessFilter)?.label);
      }
      if (this.statusFilter !== 'all') {
        bits.push(this.statusFilters.find((item) => item.value === this.statusFilter)?.label);
      }
      if (this.filterContext !== 'local' && this.regions.length) {
        bits.push(this.regions.map((value) => (
          this.dialectRegions.find((item) => item.value === value)?.label
        )).filter(Boolean).join('、'));
      }
      if (this.filterContext !== 'global' && this.dressCategory !== 'all') {
        bits.push(this.dressCategories.find((item) => item.value === this.dressCategory)?.label);
      }
      bits.push(this.sortOptions.find((item) => item.value === this.themeSort)?.label || '最新上架');
      return bits.filter(Boolean).join(' · ');
    },
    catalogQuery() {
      return {
        keyword: this.searching ? this.searchForm.keyword : '',
        access: this.accessFilter,
        category: this.category,
        dressCategory: this.dressCategory,
        regions: this.regions,
        status: this.statusFilter,
        sort: this.themeSort,
      };
    },
    visibleThemes() {
      return queryThemeCatalog({
        ...this.catalogQuery,
        dressCategory: 'all',
        keyword: '',
      }, { isMiniProgram: this.isMiniProgram }).themes.map((row) => row.item);
    },
    visibleDressItems() {
      return queryThemeCatalog({
        ...this.catalogQuery,
        category: 'all',
        keyword: '',
      }, { isMiniProgram: this.isMiniProgram }).dresses;
    },
    searchRows() {
      if (this.resultTab === 'theme') return this.searchResult.themes;
      if (this.resultTab === 'dress') return this.searchResult.dresses;
      return this.searchResult.all;
    },
    dressGroups() {
      return listDressGroupsByCategory(this.dressCategory, {
        isMiniProgram: this.isMiniProgram,
      }).map((group) => ({
        ...group,
        blocked: group.mpBlocked && this.isMiniProgram,
      }));
    },
    enableConfirmCopy() {
      if (this.overlay) {
        return '确认后立即套用整套配色。已开启覆盖，局部装扮暂时不会生效，配置仍保留。小程序里原生导航栏和底栏无法完全自定义。';
      }
      return '确认后立即套用整套配色，已装扮的部件会优先显示。小程序里原生导航栏和底栏无法完全自定义。';
    },
    hasAppliedDress() {
      return this.appliedDress.some((entry) => Boolean(entry.item));
    },
    previewShotClass() {
      const classes = themePreviewShotClass(this.activeTheme);
      this.appliedDress.forEach((entry) => {
        if (entry.effective) classes.push(`dress-${entry.group.id}`);
      });
      return classes;
    },
    previewTitle() {
      return this.previewMode === 'outfit' || this.previewMode === 'mix'
        ? '装扮效果预览'
        : '实时预览';
    },
    livePreviewModel() {
      return this.previewModel || composePreviewOutfit({
        isMiniProgram: this.isMiniProgram,
      });
    },
    accountSyncNote() {
      if (!isLoggedIn()) return THEME_GUEST_FOOTER[0].replace(/^提示：/, '');
      return '装扮配置登录账号后会同步至云端，更换设备可继承。';
    },
    globalFooterLines() {
      return [
        ...this.accessFooter,
        ...this.socialFooter,
        ...this.historyFooter,
        ...this.filterFooter,
        ...this.previewFooter,
      ];
    },
  },
  async onLoad(options) {
    bindThemeNetworkFlush();
    this.sdkSupported = isThemeSdkSupported();
    if (!this.sdkSupported) {
      await confirmDialog({
        title: '需要更新小程序',
        content: THEME_FAULT_TOAST.sdk,
        confirmText: '知道了',
        cancelText: '关闭',
      });
    }
    await this.bootThemeCenter();
    this.applySavedQuery(getThemeQuery());
    if (options?.tab === 'global') this.tab = 'global';
    if (options?.tab === 'local') this.tab = 'local';
    if (options?.tab === 'mine') this.tab = 'mine';
    if (options?.tab === 'favorites') this.tab = 'favorites';
    const routeKeyword = String(options?.q || options?.keyword || '').trim();
    if (routeKeyword) this.searchForm.keyword = routeKeyword;
    const wantSearch = options?.searching === '1'
      || options?.searching === 1
      || options?.searching === true;
    this.refreshOutfit();
    if (wantSearch) {
      if (this.searchForm.keyword) this.runSearch({ toast: false });
      else this.searching = true;
    } else if (this.searching && this.searchForm.keyword) {
      this.runSearch({ toast: false });
    }
    if (options?.kind === 'theme' && options?.id) {
      const shareId = cleanThemeShareQuery(options.id);
      const match = shareId && (
        this.visibleThemes.find((item) => item.id === shareId)
        || listThemesByCategory('all', 'all', 'newest').find((item) => item.id === shareId)
      );
      if (match) this.openDetail(match);
    }
  },
  async onShow() {
    await this.syncAccountAndMember();
    this.refreshOutfit();
    this.reportThemeCenterEnter();
  },
  onHide() {
    trackThemeCenterLeave();
  },
  watch: {
    favoriteFilter() {
      this.favoriteEntries = listFavorites(this.favoriteFilter);
    },
  },
  onShareAppMessage() {
    if (this.shareTarget?.item?.available) {
      return themeSharePayload(this.shareTarget.kind, this.shareTarget.item);
    }
    return themeSharePayload('theme', this.activeTheme);
  },
  methods: {
    themePreviewVars,
    themePreviewShotClass,
    onFilterDraftUpdate({ field, value } = {}) {
      if (!['access', 'category', 'dressCategory', 'sort', 'status'].includes(field)) return;
      this.filterDraft = { ...this.filterDraft, [field]: value };
    },
    onOutfitNameUpdate(value) {
      this.outfitForm = { ...this.outfitForm, name: value };
    },
    onSearchKeywordUpdate(value) {
      this.searchForm = { ...this.searchForm, keyword: value };
    },
    onFavoriteFilterUpdate(value) {
      this.favoriteFilter = value;
    },
    outfitPreviewVars(outfit) {
      return themePreviewVars(getThemeById(outfit?.themeId));
    },
    outfitPreviewShotClass(outfit) {
      return themePreviewShotClass(getThemeById(outfit?.themeId));
    },
    async bootThemeCenter() {
      await this.retryCatalog();
      await this.syncAccountAndMember();
    },
    async retryCatalog() {
      this.catalogLoading = true;
      const started = Date.now();
      try {
        const catalog = await loadThemeCatalog();
        this.catalogStale = Boolean(catalog.stale);
        this.catalogFail = !catalog.ok && !catalog.stale;
        if (catalog.ok && catalog.data) {
          mergeRemoteCatalog(catalog.data);
        }
        if (this.catalogStale) {
          notify({ title: THEME_FAULT_TOAST.catalogCache });
        }
        trackThemePerfListReady({
          readyMs: Date.now() - started,
          fromCache: catalog.source === 'cache' || catalog.stale,
          itemCount: (catalog.data?.themes?.length || 0) + (catalog.data?.dresses?.length || 0),
        });
      } finally {
        this.catalogLoading = false;
      }
    },
    async syncAccountAndMember() {
      if (isLoggedIn()) {
        this.memberSyncing = true;
        await refreshThemeMemberStatus();
        this.memberSyncing = false;
        const login = await handleThemeAccountLogin(uni.getStorageSync('id'));
        if (login.merge && !this.mergeSheet) {
          this.mergeSnapshot = login.merge;
          this.mergeSheet = true;
        } else if (login.switched) {
          try {
            await pullThemeCloudState();
            this.refreshOutfit();
          } catch {
            // Keep the local default pack until the next successful pull.
          }
        }
        return;
      }
      this.memberSyncing = false;
      if (guestThemeSnapshot() && !this.mergeSheet) {
        this.mergeSnapshot = guestThemeSnapshot();
      }
    },
    async onMergeChoice(choice) {
      const snapshot = this.mergeSnapshot;
      this.mergeSheet = false;
      this.mergeSnapshot = null;
      await applyThemeMergeChoice(choice, snapshot);
      this.refreshOutfit();
    },
    catalogBadge(item) {
      const info = describeAccess(item, item?.group ? 'dress' : 'theme', {
        group: item?.group ? getDressGroup(item.group) : null,
        isMiniProgram: this.isMiniProgram,
      });
      if (info.action === 'removed') return '装扮已下架';
      if (info.action === 'broken') return '装扮资源加载异常';
      if (info.action === 'ended') return '已绝版';
      if (!item?.available) return '敬请期待';
      if (info.action === 'mp-block') return '拥有权限，但小程序环境暂不支持该装扮';
      return '';
    },
    guardApply(key = 'apply') {
      return beginThemeApply(key).ok;
    },
    notifyPersist(result, { social = false } = {}) {
      if (!result) return;
      if (result.reason === 'rate') {
        notify({ title: THEME_FAULT_TOAST.rate });
        trackThemeFault('rate');
        return;
      }
      if (result.reason === 'quota' || result.persisted === false) {
        notify({ title: THEME_FAULT_TOAST.quota });
        return;
      }
      if (result.reason === 'style') {
        notify({ title: THEME_FAULT_TOAST.style });
        return;
      }
      if (result.reason === 'resource' || result.reason === 'removed') {
        notify({ title: THEME_FAULT_TOAST.resource });
      }
      if (social && result.syncFailed) {
        notify({ title: THEME_FAULT_TOAST.socialSyncFail });
      }
    },
    refreshOutfit() {
      this.activeTheme = getActiveTheme();
      this.overlay = getOverlayLocalDress();
      this.appliedDress = listOutfitHubDress({ isMiniProgram: this.isMiniProgram });
      this.ownedUnused = listOwnedUnused({ isMiniProgram: this.isMiniProgram });
      this.acquireOffers = listAcquireOffers();
      this.favoriteEntries = listFavorites(this.favoriteFilter);
      this.recentThemes = listRecentUses({
        isMiniProgram: this.isMiniProgram,
        kind: 'theme',
      });
      this.recentDresses = listRecentUses({
        isMiniProgram: this.isMiniProgram,
        kind: 'dress',
      });
      this.savedOutfits = getSavedOutfits();
      this.socialTick += 1;
    },
    statsOf(kind, item) {
      return socialStats(kind, item, this.socialTick);
    },
    browseItemIds() {
      if (this.searching) {
        return this.searchRows.map((row) => row.item.id);
      }
      if (this.tab === 'local') {
        return this.visibleDressItems.map((row) => row.item.id);
      }
      if (this.tab === 'favorites') {
        return this.favoriteEntries.map((row) => row.item.id);
      }
      if (this.tab === 'global') {
        return this.visibleThemes.map((item) => item.id);
      }
      return [];
    },
    onTabSwitch(tab) {
      if (this.tab === tab) return;
      this.tab = tab;
      trackThemeTabSwitch(tab);
    },
    reportThemeCenterEnter() {
      trackThemeCenterEnter({ themeId: this.activeTheme.id });
    },
    reportThemeListScroll(scrollTop = 0) {
      trackThemeListScroll({
        itemIds: this.browseItemIds(),
        scrollTop,
        query: this.catalogQuery,
      });
    },
    onShellScroll(event) {
      const top = event?.scrollTop || 0;
      if (this.scrollTimer) clearTimeout(this.scrollTimer);
      this.scrollTimer = setTimeout(() => {
        this.reportThemeListScroll(top);
      }, 400);
    },
    isItemFav(kind, id) {
      return this.socialTick >= 0 && isFavorited(kind, id);
    },
    async onToggleFavorite(kind, item) {
      if (!this.guardApply(`fav:${kind}:${item?.id}`)) return;
      const already = isFavorited(kind, item?.id);
      if (!item?.available && !already) {
        notify({ title: '待上线装扮暂不支持收藏' });
        return;
      }
      const result = await Promise.resolve(toggleFavorite(kind, item));
      if (!result?.ok) {
        if (result?.reason === 'upcoming') {
          notify({ title: '待上线装扮暂不支持收藏' });
        } else if (result?.reason === 'rate') {
          notify({ title: THEME_FAULT_TOAST.rate });
        }
        return;
      }
      this.refreshOutfit();
      trackThemeCollect(kind, item, result.favorited);
      if (result.queued) {
        notify({ title: THEME_FAULT_TOAST.socialSyncFail });
        return;
      }
      let title = '已取消收藏';
      if (result.favorited) {
        title = kind === 'theme' ? '已收藏该主题' : '已收藏该装扮';
      }
      notifySuccess(title);
    },
    onToggleLike(kind, item) {
      if (!item?.available) return;
      toggleLike(kind, item);
      this.refreshOutfit();
    },
    onShare(kind, item) {
      if (!this.guardApply(`share:${kind}:${item?.id}`)) return;
      if (!item?.available) {
        notify({ title: '待上线装扮暂不支持分享' });
        return;
      }
      this.shareTarget = { kind, item };
    },
    onOpenFavorite(entry) {
      if (entry.kind === 'theme') {
        this.openDetail(entry.item);
        return;
      }
      goThemeDress(entry.item.group, { id: entry.item.id });
    },
    onFavoriteEnable(entry) {
      if (entry.kind === 'theme') {
        this.onCardEnable(entry.item);
        return;
      }
      this.onDressOffer(entry.item);
    },
    favoriteActionLabel(entry) {
      if (entry.kind === 'theme') return this.themeActionLabel(entry.item);
      return accessActionLabel(this.dressAccess(entry.item), { kind: 'dress' });
    },
    favoriteVariant(entry) {
      if (entry.kind === 'theme') return this.themeActionVariant(entry.item);
      return this.dressActionVariant(entry.item);
    },
    favoriteDisabled(entry) {
      if (entry.kind === 'theme') return this.themeActionDisabled(entry.item);
      return this.dressActionDisabled(entry.item);
    },
    themeAccess(theme) {
      return describeAccess(theme, 'theme', { isMiniProgram: this.isMiniProgram });
    },
    dressAccess(item, group) {
      return describeAccess(item, 'dress', {
        group: group || getDressGroup(item.group),
        isMiniProgram: this.isMiniProgram,
      });
    },
    tagClass(item) {
      return accessTagClass(item);
    },
    themeTags(theme) {
      return themeDisplayTags(theme, {
        applied: theme?.id === this.activeTheme.id,
      });
    },
    isGreyTheme(theme) {
      const info = this.themeAccess(theme);
      return !theme.available
        || info.action === 'ended'
        || info.action === 'removed'
        || info.action === 'broken';
    },
    themeActionLabel(theme) {
      return accessActionLabel(this.themeAccess(theme), {
        applied: theme.id === this.activeTheme.id,
        kind: 'theme',
      });
    },
    themeActionDisabled(theme) {
      const info = this.themeAccess(theme);
      if (!this.sdkSupported) return true;
      if (theme.id === this.activeTheme.id) return true;
      return info.disabled
        || info.action === 'soon'
        || info.action === 'ended'
        || info.action === 'removed'
        || info.action === 'broken'
        || info.action === 'mp-block';
    },
    themeActionVariant(theme) {
      if (this.themeActionDisabled(theme)) return 'ghost';
      return 'primary';
    },
    dressActionDisabled(item) {
      const info = this.dressAccess(item);
      if (!this.sdkSupported) return true;
      return info.disabled
        || info.action === 'soon'
        || info.action === 'ended'
        || info.action === 'removed'
        || info.action === 'broken'
        || info.action === 'mp-block';
    },
    dressActionVariant(item) {
      if (this.dressActionDisabled(item)) return 'ghost';
      return 'primary';
    },
    onAppearance(preference) {
      const next = setThemePreference(preference);
      this.appearance = next.preference;
    },
    onThemeNavBack() {
      if (this.searching) {
        this.exitSearch();
        return;
      }
      if (this.tab === 'mine') this.onTabSwitch('global');
    },
    applySavedQuery(query) {
      const next = { ...defaultThemeQuery(), ...query };
      this.category = next.category;
      this.dressCategory = next.dressCategory;
      this.themeSort = next.sort;
      this.accessFilter = next.access;
      this.statusFilter = next.status;
      this.regions = [...(next.regions || [])];
      this.dialectRegion = this.regions[0] || 'all';
      this.searchForm = { keyword: next.keyword || '' };
      this.resultTab = next.resultTab || 'all';
      this.searching = Boolean(next.searching && next.keyword);
    },
    persistBrowseQuery() {
      persistThemeQuery({
        ...this.catalogQuery,
        keyword: this.searchForm.keyword,
        resultTab: this.resultTab,
        searching: this.searching,
      });
    },
    runSearch({ toast = true } = {}) {
      const result = searchThemeCatalog(
        this.searchForm.keyword,
        this.catalogQuery,
        { isMiniProgram: this.isMiniProgram },
      );
      this.searchResult = result;
      this.searching = true;
      if (toast && !result.all.length) {
        notify({ title: '没有匹配的主题装扮，请更换关键词' });
      }
    },
    submitThemeSearch() {
      const keyword = cleanSearchKeyword(this.searchForm.keyword);
      this.searchForm.keyword = keyword;
      if (!keyword) {
        this.searching = false;
        this.persistBrowseQuery();
        return;
      }
      this.runSearch({ toast: true });
      trackThemeSearch(keyword, this.searchResult.all.length);
    },
    onHotKeyword(tag) {
      trackThemeHotSearch(tag);
      this.searchForm.keyword = tag;
      this.submitThemeSearch();
    },
    onResultTab(value) {
      this.resultTab = value;
      this.persistBrowseQuery();
    },
    exitSearch() {
      this.searching = false;
      this.persistBrowseQuery();
    },
    openFilterSheet() {
      this.filterDraft = {
        ...defaultThemeQuery(),
        ...this.catalogQuery,
        keyword: this.searchForm.keyword,
        resultTab: this.resultTab,
        searching: this.searching,
        regions: [...this.regions],
      };
      this.filterSheet = true;
    },
    closeFilterSheet() {
      this.filterSheet = false;
    },
    isDraftRegionOn(value) {
      if (value === 'all') return !this.filterDraft.regions.length;
      return this.filterDraft.regions.includes(value);
    },
    isRegionChipOn(value) {
      if (value === 'all') return !this.regions.length;
      return this.regions.includes(value);
    },
    onToggleDraftRegion(value) {
      if (value === 'all') {
        this.filterDraft.regions = [];
        return;
      }
      const current = this.filterDraft.regions.filter((item) => item !== 'all');
      this.filterDraft.regions = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
    },
    onResetFilter() {
      this.filterDraft = {
        ...defaultThemeQuery(),
        keyword: this.searchForm.keyword,
        searching: this.searching,
        resultTab: this.resultTab,
      };
    },
    onClearAppliedFilters() {
      const next = defaultThemeQuery();
      this.accessFilter = next.access;
      this.statusFilter = next.status;
      this.category = next.category;
      this.dressCategory = next.dressCategory;
      this.themeSort = next.sort;
      this.regions = [];
      this.dialectRegion = 'all';
      this.filterDraft = {
        ...next,
        keyword: this.searchForm.keyword,
        searching: this.searching,
        resultTab: this.resultTab,
      };
      this.persistBrowseQuery();
    },
    onThemeListEmptyAction() {
      if (this.themeListEmptyScene === 'filter') this.onClearAppliedFilters();
    },
    onFavoriteEmptyAction() {
      this.onTabSwitch('global');
    },
    onDressAppliedEmptyAction() {
      this.onTabSwitch('local');
    },
    onConfirmFilter() {
      this.accessFilter = this.filterDraft.access;
      this.statusFilter = this.filterDraft.status;
      this.category = this.filterDraft.category;
      this.dressCategory = this.filterDraft.dressCategory;
      this.themeSort = this.filterDraft.sort;
      this.regions = [...(this.filterDraft.regions || [])];
      this.dialectRegion = this.regions[0] || 'all';
      this.filterSheet = false;
      this.persistBrowseQuery();
      trackThemeFilterClick(this.catalogQuery);
      if (this.searching) {
        this.runSearch({ toast: true });
        return;
      }
      const empty = this.tab === 'local'
        ? this.hasExtraFilters && !this.visibleDressItems.length
        : !this.visibleThemes.length && this.hasExtraFilters;
      if (empty) {
        notify({ title: '当前筛选条件下暂无可用装扮' });
      }
    },
    onThemeRegion(value) {
      this.dialectRegion = value;
      this.regions = !value || value === 'all' ? [] : [value];
      this.persistBrowseQuery();
    },
    onThemeSort(value) {
      this.themeSort = value;
      this.persistBrowseQuery();
    },
    onDressCategory(value) {
      this.dressCategory = value;
      this.persistBrowseQuery();
    },
    isGreyEntry(entry) {
      if (entry?.blocked) return true;
      const item = entry?.item;
      if (!item) return true;
      return this.isGreyTheme(item) || Boolean(this.catalogBadge(item));
    },
    searchActionLabel(entry) {
      if (entry.kind === 'theme') return this.themeActionLabel(entry.item);
      return accessActionLabel(this.dressAccess(entry.item, entry.group), { kind: 'dress' });
    },
    searchActionDisabled(entry) {
      if (entry.blocked) return true;
      if (entry.kind === 'theme') return this.themeActionDisabled(entry.item);
      return this.dressActionDisabled(entry.item);
    },
    searchActionVariant(entry) {
      if (this.searchActionDisabled(entry)) return 'ghost';
      return 'primary';
    },
    onOpenSearchEntry(entry) {
      if (entry.kind === 'theme') {
        this.openDetail(entry.item);
        return;
      }
      if (entry.blocked) {
        trackThemeUnsupportedEnv('dress', entry.item);
        notify({ title: '当前小程序环境暂不支持该装扮' });
        return;
      }
      goThemeDress(entry.item.group, { id: entry.item.id });
    },
    onSearchEnable(entry) {
      this.onFavoriteEnable(entry);
    },
    onAcquire() {
      goThemeAcquire();
    },
    onThemeCategory(value) {
      this.category = value;
      if (value !== 'dialect') this.dialectRegion = 'all';
      this.persistBrowseQuery();
    },
    openDetail(theme) {
      this.detailTheme = theme;
      this.zoomOpen = false;
      trackThemeItemDetail('theme', theme);
      trackThemePreview('theme', theme, 'detail');
    },
    closeDetail() {
      this.zoomOpen = false;
      this.detailTheme = null;
    },
    themeCoverSrc(item) {
      const src = previewCoverOf(item);
      if (!item?.id || !isRemotePreviewSrc(src) || this.coverFailed[item.id]) return '';
      return src;
    },
    themeDetailSrc(item) {
      const src = previewDetailOf(item);
      const key = `detail:${item?.id}`;
      if (!item?.id || !isRemotePreviewSrc(src) || this.coverFailed[key]) return '';
      return src;
    },
    onPreviewImgError(key) {
      if (this.coverFailed[key]) return;
      const firstFail = !Object.keys(this.coverFailed).length;
      this.coverFailed = { ...this.coverFailed, [key]: true };
      if (firstFail) notify({ title: THEME_FAULT_TOAST.resource });
    },
    openZoom() {
      if (!this.detailTheme) return;
      if (!this.guardApply('preview-zoom')) return;
      this.zoomOpen = true;
    },
    closeZoom() {
      this.zoomOpen = false;
    },
    async onCardEnable(theme) {
      const info = this.themeAccess(theme);
      if (info.action === 'removed') {
        notify({ title: '装扮已下架' });
        return;
      }
      if (info.action === 'broken') {
        notify({ title: THEME_FAULT_TOAST.resource });
        return;
      }
      if (!this.sdkSupported) {
        notify({ title: THEME_FAULT_TOAST.sdk });
        return;
      }
      if (info.action === 'soon') {
        trackThemeApplyInvalid('theme', theme, '已下架');
        notify({ title: '该主题暂未开放，敬请期待' });
        return;
      }
      if (info.action === 'ended') {
        trackThemeApplyInvalid('theme', theme, '已绝版');
        notify({ title: '该限定装扮活动已结束，无法获取' });
        return;
      }
      if (info.action === 'member') {
        trackThemeApply({
          kind: 'theme',
          item: theme,
          result: 'no_permission',
          permission: 'member',
        });
        await this.openMemberGate('theme', theme);
        return;
      }
      if (info.action === 'event') {
        trackThemeApply({
          kind: 'theme',
          item: theme,
          result: 'no_permission',
          permission: 'event',
        });
        trackThemeGet('theme', theme, 'event');
        goThemeEvent({ id: theme.id, kind: 'theme' });
        return;
      }
      if (info.action === 'creator-lock') {
        trackThemeApply({
          kind: 'theme',
          item: theme,
          result: 'no_permission',
          permission: 'creator',
        });
        trackThemeGet('theme', theme, 'creator');
        notify({ title: '暂未满足解锁条件，请完成方言创作任务' });
        goThemeAcquire({ focus: 'creator' });
        return;
      }
      if (info.action === 'claim') {
        const claimed = await Promise.resolve(claimSkin('theme', theme.id));
        if (!claimed?.ok) {
          notify({ title: '暂无权限使用该装扮' });
          return;
        }
        trackThemeGet('theme', theme, theme.access);
        this.refreshOutfit();
        notifySuccess('恭喜，已获得该装扮，可前往我的装扮使用');
        return;
      }
      if (theme.id === this.activeTheme.id) return;
      const confirmed = await confirmDialog({
        title: '启用这套主题？',
        content: this.enableConfirmCopy,
        confirmText: '立即启用',
      });
      if (!confirmed) return;
      if (!this.guardApply(`theme:${theme.id}`)) return;
      const result = await persistActiveTheme(theme.id);
      if (!result.ok) {
        this.notifyPersist(result);
        if (!['quota', 'style', 'resource', 'removed'].includes(result.reason)) {
          notify({ title: this.persistFailTitle(result.reason) });
        }
        return;
      }
      this.notifyPersist(result);
      if (result.reason === 'rate') {
        this.refreshOutfit();
        this.closeDetail();
        return;
      }
      trackThemeApply({ kind: 'theme', item: theme, result: 'success' });
      this.refreshOutfit();
      this.closeDetail();
      notifySuccess('全局主题已应用');
    },
    persistFailTitle(reason) {
      if (reason === 'upcoming') return '该主题暂未开放，敬请期待';
      if (reason === 'member') return '该装扮为会员专属，请先开通会员';
      if (reason === 'event') return '该限定装扮活动已结束，无法获取';
      if (reason === 'ended') return '该限定装扮活动已结束，无法获取';
      if (reason === 'creator') return '暂未满足解锁条件，请完成方言创作任务';
      if (reason === 'privilege') return '暂无权限使用该装扮';
      if (reason === 'terminal') return '当前环境暂不支持该装扮';
      if (reason === 'rate') return THEME_FAULT_TOAST.rate;
      if (reason === 'quota') return THEME_FAULT_TOAST.quota;
      if (reason === 'style') return THEME_FAULT_TOAST.style;
      if (reason === 'resource' || reason === 'removed') return THEME_FAULT_TOAST.resource;
      if (reason === 'busy') return '';
      return '该主题暂未开放，敬请期待';
    },
    async openMemberGate(kind, item) {
      const go = await confirmDialog({
        title: '开通会员',
        content: '该装扮为会员专属，开通会员即可解锁全部会员主题与装扮。开通后可解锁全部会员全局主题、会员局部装扮。',
        confirmText: '开通会员',
        cancelText: '取消',
      });
      if (go) {
        trackThemeGet(kind, item, 'member');
        goThemeMember();
      }
    },
    async onDressOffer(item) {
      const info = this.dressAccess(item);
      if (info.action === 'removed') {
        notify({ title: '装扮已下架' });
        return;
      }
      if (info.action === 'broken') {
        notify({ title: THEME_FAULT_TOAST.resource });
        return;
      }
      if (info.action === 'ended') {
        trackThemeApplyInvalid('dress', item, '已绝版');
        notify({ title: '该限定装扮活动已结束，无法获取' });
        return;
      }
      if (info.action === 'member') {
        trackThemeApply({
          kind: 'dress',
          item,
          result: 'no_permission',
          permission: 'member',
        });
        await this.openMemberGate('dress', item);
        return;
      }
      if (info.action === 'event') {
        trackThemeApply({
          kind: 'dress',
          item,
          result: 'no_permission',
          permission: 'event',
        });
        trackThemeGet('dress', item, 'event');
        goThemeEvent({ id: item.id, kind: 'dress' });
        return;
      }
      if (info.action === 'creator-lock') {
        trackThemeApply({
          kind: 'dress',
          item,
          result: 'no_permission',
          permission: 'creator',
        });
        trackThemeGet('dress', item, 'creator');
        notify({ title: '暂未满足解锁条件，请完成方言创作任务' });
        goThemeAcquire({ focus: 'creator' });
        return;
      }
      if (info.action === 'claim') {
        const claimed = await Promise.resolve(claimSkin('dress', item.id));
        if (!claimed?.ok) {
          notify({ title: '暂无权限使用该装扮' });
          return;
        }
        trackThemeGet('dress', item, item.access);
        this.refreshOutfit();
        notifySuccess('恭喜，已获得该装扮，可前往我的装扮使用');
        return;
      }
      goThemeDress(item.group);
    },
    async onApplyOwnedDress(entry) {
      if (entry.blocked) {
        trackThemeUnsupportedEnv('dress', entry.item);
        trackThemeApply({
          kind: 'dress',
          item: entry.item,
          result: 'unsupported_env',
        });
        notify({ title: '拥有权限，但小程序环境暂不支持该装扮' });
        return;
      }
      if (!this.guardApply(`dress:${entry.item.id}`)) return;
      const result = await persistLocalDress(entry.group.id, entry.item.id);
      if (!result.ok) {
        this.notifyPersist(result);
        notify({ title: result.reason === 'upcoming' ? '装扮素材即将上线' : this.persistFailTitle(result.reason) });
        return;
      }
      this.notifyPersist(result);
      if (result.reason === 'rate') {
        this.refreshOutfit();
        return;
      }
      trackThemeApply({ kind: 'dress', item: entry.item, result: 'success' });
      this.refreshOutfit();
      notifySuccess('装扮已生效');
    },
    onOpenDress(group) {
      if (group.blocked) {
        trackThemeUnsupportedEnv('dress', { id: group.id, group: group.id });
        notify({ title: '当前小程序环境暂不支持该装扮' });
        return;
      }
      goThemeDress(group.id);
    },
    onEditDress(group, entry) {
      if (entry?.blocked) {
        notify({ title: '当前小程序环境暂不支持该装扮' });
        return;
      }
      goThemeDress(group.id);
    },
    onClearDress(entry) {
      if (!entry?.item) return;
      const result = clearLocalDress(entry.group.id);
      this.notifyPersist(result);
      this.refreshOutfit();
      notifySuccess('已恢复跟随全局主题');
    },
    onChangeTheme() {
      this.onTabSwitch('global');
    },
    recentTagClass(row) {
      if (row?.status === 'ended') return 'tag-ended';
      if (row?.status === 'blocked') return 'tag-soon';
      if (row?.status === 'retired') return 'tag-soon';
      if (row?.status === 'gated') return accessTagClass(row.item);
      return 'tag-free';
    },
    onRecentTap(row) {
      if (row.status === 'blocked') {
        trackThemeUnsupportedEnv(row.kind, { id: row.id });
        notify({ title: row.hint || '当前环境暂不支持该装扮' });
        return;
      }
      if (row.kind === 'theme') {
        const theme = getThemeById(row.id);
        if (!theme) {
          notify({ title: row.hint || '装扮已下架' });
          return;
        }
        this.openDetail(theme);
        return;
      }
      const item = getDressItem(row.id);
      if (!item) {
        notify({ title: row.hint || '装扮已下架' });
        return;
      }
      goThemeDress(item.group, { id: item.id });
    },
    async onApplyRecent(row) {
      if (row.disabled) {
        if (row.status === 'ended') {
          trackThemeApplyInvalid(row.kind, { id: row.id }, '已绝版');
        } else if (row.status === 'blocked') {
          trackThemeUnsupportedEnv(row.kind, { id: row.id });
        } else if (row.status === 'gated') {
          trackThemeApply({
            kind: row.kind,
            item: {
              id: row.id,
              access: row.access,
              region: row.region,
              group: row.group,
            },
            fromHistory: true,
            result: 'no_permission',
            permission: row.access,
          });
        }
        notify({ title: row.hint || '当前暂无使用权限' });
        return;
      }
      if (!this.guardApply(`recent:${row.kind}:${row.id}`)) return;
      const result = await applyRecent(row, { isMiniProgram: this.isMiniProgram });
      if (!result.ok) {
        notify({ title: result.hint || '装扮已下架' });
        return;
      }
      trackThemeApply({
        kind: row.kind,
        item: {
          id: row.id,
          access: row.access,
          region: row.region,
          group: row.group,
        },
        fromHistory: true,
        result: 'success',
      });
      this.refreshOutfit();
      notifySuccess(row.kind === 'theme' ? '全局主题已应用' : '装扮已生效');
    },
    outfitSummary(outfit) {
      const theme = getThemeById(outfit.themeId);
      const count = Object.keys(outfit.localDress || {}).length;
      const themeName = theme?.name || '默认方言主题';
      return `${themeName} · ${count} 件局部装扮`;
    },
    onOpenSaveOutfit() {
      this.outfitMode = 'save';
      this.outfitTargetId = '';
      this.outfitForm = { name: '' };
      this.outfitError = '';
      this.outfitSheet = true;
    },
    onOpenRenameOutfit(outfit) {
      this.outfitMode = 'rename';
      this.outfitTargetId = outfit.id;
      this.outfitForm = { name: outfit.name };
      this.outfitError = '';
      this.outfitSheet = true;
    },
    closeOutfitSheet() {
      this.outfitSheet = false;
      this.outfitError = '';
    },
    async onConfirmOutfitSheet() {
      const name = String(this.outfitForm.name || '').trim();
      if (!name) {
        this.outfitError = '请输入搭配名称';
        return;
      }
      if (!this.guardApply(`outfit-save:${this.outfitMode}`)) return;
      this.outfitError = '';
      if (this.outfitMode === 'rename') {
        renameSavedOutfit(this.outfitTargetId, name);
        trackThemeMixManage('rename', this.outfitTargetId);
        this.closeOutfitSheet();
        this.refreshOutfit();
        notifySuccess('已保存这套装扮搭配');
        return;
      }
      const result = saveCurrentOutfit(name);
      if (!result.ok && result.reason === 'limit') {
        await confirmDialog({
          title: '无法保存',
          content: '已达到最大保存数量，请删除旧搭配方案后再保存',
          confirmText: '知道了',
          cancelText: '关闭',
        });
        trackThemeFault('mix_cap');
        return;
      }
      if (!result.ok && result.reason === 'duplicate') {
        notify({ title: THEME_FAULT_TOAST.mixDuplicate });
        return;
      }
      if (!result.ok) {
        this.notifyPersist(result);
        return;
      }
      trackThemeSaveMix(result.outfit);
      this.closeOutfitSheet();
      this.refreshOutfit();
      notifySuccess('已保存这套装扮搭配');
    },
    async onApplyOutfit(outfit) {
      const confirmed = await confirmDialog({
        title: '是否一键应用这套历史搭配？',
        content: '注意：将会覆盖当前全局主题与局部装扮配置。',
        confirmText: '立即应用',
      });
      if (!confirmed) return;
      if (!this.guardApply(`outfit:${outfit.id || outfit.name || 'mix'}`)) return;
      const result = applySavedOutfit(outfit, { isMiniProgram: this.isMiniProgram });
      if (!result.ok) {
        notify({ title: THEME_FAULT_TOAST.mixBroken });
        return;
      }
      trackThemeApplyMix(outfit, { hasUnavailable: Boolean(result.skipped) });
      trackThemeApply({
        kind: 'theme',
        item: getThemeById(outfit.themeId),
        fromHistory: true,
        isMix: true,
        result: 'success',
      });
      this.refreshOutfit();
      this.notifyApplyMix(result);
    },
    notifyApplyMix(result) {
      notifySuccess('已应用历史搭配方案');
      if (result.empty) {
        notify({ title: THEME_FAULT_TOAST.mixEmpty });
        return;
      }
      if (result.skipped) {
        notify({ title: THEME_FAULT_TOAST.skippedRemoved });
      }
    },
    async onDeleteOutfit(outfit) {
      const confirmed = await confirmDialog({
        title: '删除这套搭配方案？',
        content: '删除后无法恢复。',
        danger: true,
        confirmText: '删除',
      });
      if (!confirmed) return;
      if (!this.guardApply(`outfit-delete:${outfit.id || 'mix'}`)) return;
      deleteSavedOutfit(outfit.id);
      trackThemeMixManage('delete', outfit.id);
      this.refreshOutfit();
    },
    dressTags(entry) {
      if (!entry?.item) return [];
      return dressDisplayTags(entry.item, entry.group, { applied: true });
    },
    dressStatus(entry) {
      if (entry.empty || !entry.item) return '暂未设置该组件装扮';
      if (entry.blocked) return '当前环境不生效';
      const status = catalogStatus(entry.item);
      if (status === 'removed') return '已下架';
      if (status === 'ended') return '已绝版';
      if (entry.suppressed) return '已被全局主题覆盖';
      return '当前生效';
    },
    outfitThemePreview(outfit) {
      return getThemeById(outfit?.themeId)?.preview || 'default';
    },
    openPreview() {
      if (this.previewOpen) return;
      if (!this.guardApply('preview-open')) return;
      beginThemePreview();
      this.previewMode = 'outfit';
      this.previewItem = null;
      this.previewModel = composePreviewOutfit({
        isMiniProgram: this.isMiniProgram,
      });
      this.previewOpen = true;
      trackThemePreview('theme', this.activeTheme, 'live');
    },
    onPreviewOutfit(outfit) {
      if (this.previewOpen) return;
      if (!this.guardApply('preview-open')) return;
      beginThemePreview();
      this.previewMode = 'mix';
      this.previewItem = null;
      this.previewOutfit = outfit;
      this.previewModel = composePreviewOutfit({
        themeId: outfit?.themeId,
        localDress: outfit?.localDress,
        overlay: outfit?.overlay,
        isMiniProgram: this.isMiniProgram,
      });
      this.previewOpen = true;
      trackThemePreview('theme', getThemeById(outfit?.themeId), 'live');
    },
    onSkinCardPreview(theme) {
      if (!theme) return;
      if (canLivePreview(theme)) {
        this.openLivePreview('theme', theme);
        return;
      }
      this.openDetail(theme);
    },
    openLivePreview(kind, item) {
      if (!canLivePreview(item)) {
        notify({ title: '该主题暂未开放，敬请期待' });
        return;
      }
      if (this.previewOpen) return;
      if (!this.guardApply('preview-open')) return;
      const snapshot = cloneCatalogItem(item);
      if (!snapshot) return;
      this.previewMode = kind;
      this.previewItem = snapshot;
      beginThemePreview();
      this.previewModel = composePreviewOutfit({
        themeId: kind === 'theme' ? snapshot.id : this.activeTheme.id,
        extraDress: kind === 'dress' ? snapshot : null,
        isMiniProgram: this.isMiniProgram,
      });
      this.previewOpen = true;
      trackThemePreview(kind, snapshot, 'live');
    },
    canLivePreviewItem(item) {
      return canLivePreview(item);
    },
    closePreview() {
      abortThemePreview();
      this.previewOpen = false;
      this.previewItem = null;
      this.previewOutfit = null;
      this.previewModel = null;
    },
    async onConfirmPreview() {
      if (!this.guardApply(`preview:${this.previewMode}`)) return;
      const skipped = this.livePreviewModel.skipped || [];
      if (this.previewMode === 'theme' && this.previewItem) {
        const result = await persistActiveTheme(this.previewItem.id);
        if (!result.ok) {
          this.notifyPersist(result);
          notify({ title: this.persistFailTitle(result.reason) });
          return;
        }
        this.notifyPersist(result);
        if (result.reason === 'rate') {
          this.closePreview();
          this.closeDetail();
          this.refreshOutfit();
          return;
        }
        trackThemeApply({
          kind: 'theme',
          item: this.previewItem,
          result: 'success',
        });
      } else if (this.previewMode === 'dress' && this.previewItem) {
        const result = await persistLocalDress(this.previewItem.group, this.previewItem.id);
        if (!result.ok) {
          this.notifyPersist(result);
          notify({
            title: result.reason === 'upcoming'
              ? '装扮素材即将上线'
              : this.persistFailTitle(result.reason),
          });
          return;
        }
        this.notifyPersist(result);
        if (result.reason === 'rate') {
          this.closePreview();
          this.closeDetail();
          this.refreshOutfit();
          return;
        }
        trackThemeApply({
          kind: 'dress',
          item: this.previewItem,
          result: 'success',
        });
      } else if (this.previewMode === 'mix' && this.previewOutfit) {
        const result = applySavedOutfit(this.previewOutfit, { isMiniProgram: this.isMiniProgram });
        if (!result.ok) {
          notify({ title: THEME_FAULT_TOAST.mixBroken });
          return;
        }
        trackThemeApplyMix(this.previewOutfit, { hasUnavailable: Boolean(result.skipped) });
        this.closePreview();
        this.refreshOutfit();
        this.notifyApplyMix(result);
        return;
      } else {
        await persistCurrentOutfit();
        trackThemeApply({
          kind: 'theme',
          item: this.activeTheme,
          isMix: true,
          result: 'success',
        });
      }
      this.closePreview();
      this.closeDetail();
      this.refreshOutfit();
      notifySuccess('装扮已生效');
      if (skipped.some((row) => row.blocked)) {
        notify({ title: '部分装扮当前环境无法生效，已跳过' });
      }
    },
    async onResetDress() {
      const confirmed = await confirmDialog({
        title: '重置全部装扮？',
        content: '确定重置所有装扮？将恢复系统默认样式，已保存的搭配方案不会删除',
        confirmText: '确定重置',
        danger: true,
      });
      if (!confirmed) return;
      if (!this.guardApply('reset-all')) return;
      trackThemeResetAll({
        themeId: this.activeTheme.id,
        dressCount: this.appliedDress.filter((entry) => entry.item).length,
      });
      await resetAllDress();
      this.closePreview();
      this.refreshOutfit();
      notifySuccess('已恢复为默认样式');
    },
    async onOverlayChange(value) {
      const enabled = typeof value === 'object' ? Boolean(value?.value) : Boolean(value);
      if (enabled === this.overlay) return;
      if (enabled && Object.keys(getLocalDressMap()).length > 0) {
        const confirmed = await confirmDialog({
          title: '开启全局主题覆盖？',
          content: '开启全局主题覆盖局部装扮后，自定义局部装扮将不会生效，是否继续？',
          confirmText: '确认开启',
          cancelText: '取消',
        });
        if (!confirmed) {
          this.overlay = false;
          return;
        }
      }
      setOverlayLocalDress(enabled);
      trackThemeSwitchConflict(enabled);
      this.refreshOutfit();
    },
  },
};
