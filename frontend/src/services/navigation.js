export const ROUTES = Object.freeze({
  home: '/pages/index',
  search: '/pages/search',
  record: '/pages/recordings/create',
  recordingDetail: '/pages/recordings/details',
  recordingDrafts: '/pages/recordings/drafts',
  collections: '/pages/collections/index',
  collectionDetail: '/pages/collections/details',
  entryDetail: '/pages/entries/details',
  mine: '/pages/users/me',
  login: '/pages/login/login',
  circleList: '/pages/circles/index',
  circleDetail: '/pages/circles/details',
  userDetail: '/pages/users/details',
  onboarding: '/pages/users/onboarding',
  recommendFollow: '/pages/users/recommend-follow',
  contributionHistory: '/pages/users/contributions',
  entryBookmarks: '/pages/users/bookmarks',
  curationWorkbench: '/pages/curation/index',
  entryReview: '/pages/curation/entry-review',
  curationActionDetail: '/pages/curation/action-detail',
  curatorApplication: '/pages/curation/apply',
  loginRegister: '/pages/login/register',
  loginWechatRegister: '/pages/login/register/wechat',
  loginForget: '/pages/login/forget',
  notFound: '/pages/error/not-found',
  mails: '/pages/mails/index',
  mailDetail: '/pages/mails/details',
  mailSend: '/pages/mails/send',
  userInformation: '/pages/users/settings/information',
  userNickname: '/pages/users/settings/nickname',
  userUsername: '/pages/users/settings/username',
  userEmail: '/pages/users/settings/email',
  userPhone: '/pages/users/settings/telephone',
  userPassword: '/pages/users/settings/password',
  themeCenter: '/pages/users/theme-center',
  themeDress: '/pages/users/theme-dress',
  themeAcquire: '/pages/users/theme-acquire',
  themeMember: '/pages/users/theme-member',
  themeEvent: '/pages/users/theme-event',
});

function queryString(params = {}) {
  const pairs = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
}

export function pageUrl(path, params = {}) {
  return `${path}${queryString(params)}`;
}

export function routeDestination(path, params = {}) {
  // 登录恢复只消费由本白名单生成的目的地，不能执行存储中的任意路径。
  if (!Object.values(ROUTES).includes(path)) return null;
  return {
    kind: 'url',
    route: path.slice(1),
    url: pageUrl(path, params),
  };
}

export function currentRoute() {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  const page = pages.length ? pages[pages.length - 1] : null;
  return String(page?.route || '').replace(/^\//, '');
}

let pageTransitionTimer = null;

// 在 H5 端标记一次真实页面导航，让新插入的页面容器播放进入动画。
// 只在 openPage / goBack 中调用，首屏加载与硬刷新不会触发，从而满足
// #203/#217 的「首屏无劣化」验收要求：仅前进/返回导航启用动画。
function markPageTransition() {
  // #ifdef H5
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.add('page-transitioning');
  if (pageTransitionTimer) clearTimeout(pageTransitionTimer);
  pageTransitionTimer = setTimeout(() => {
    root.classList.remove('page-transitioning');
  }, 300);
  // #endif
}

export function openPage(path, params = {}, options = {}) {
  const url = pageUrl(path, params);
  markPageTransition();
  if (options.reset) {
    uni.reLaunch({ url });
  } else if (options.replace) {
    uni.redirectTo({ url });
  } else {
    uni.navigateTo({ url });
  }
  return url;
}

export function goBack(fallback = ROUTES.home) {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  if (pages.length > 1) {
    markPageTransition();
    uni.navigateBack({ delta: 1 });
    return;
  }
  openPage(fallback, {}, { reset: true });
}

export const goHome = (reset = false, params = {}) => openPage(ROUTES.home, params, { reset });
export const goSearch = (options = {}) => openPage(ROUTES.search, {}, options);
export const goRecord = (params = {}, options = {}) => openPage(ROUTES.record, params, options);
export const goEntryDetail = (id, options = {}) => openPage(
  ROUTES.entryDetail,
  { id },
  options,
);
export const goMine = (reset = false) => openPage(ROUTES.mine, {}, { reset });
export const goLogin = (params = {}, options = {}) => {
  if (currentRoute() !== ROUTES.login.slice(1)) openPage(ROUTES.login, params, options);
};
export const goCircleList = () => openPage(ROUTES.circleList);
export const goCircleDetail = (id) => openPage(ROUTES.circleDetail, { id });
export const goUserDetail = (id) => openPage(ROUTES.userDetail, { id });
export const goOnboarding = (params = {}, options = {}) => openPage(
  ROUTES.onboarding,
  params,
  options,
);
export const goRecommendFollow = (reset = false) => openPage(
  ROUTES.recommendFollow,
  {},
  { reset },
);
export const goContributionHistory = () => openPage(ROUTES.contributionHistory);
export const goEntryBookmarks = () => openPage(ROUTES.entryBookmarks);
export const goCurationWorkbench = () => openPage(ROUTES.curationWorkbench);
export const goCuratorApplication = () => openPage(ROUTES.curatorApplication);
export const goLoginRegister = () => openPage(ROUTES.loginRegister);
export const goLoginWechatRegister = () => openPage(ROUTES.loginWechatRegister);
export const goLoginForget = (params = {}) => openPage(ROUTES.loginForget, params);
export const goNotFound = () => openPage(ROUTES.notFound);
export const goMails = () => openPage(ROUTES.mails);
export const goMailDetail = (id) => openPage(ROUTES.mailDetail, { id });
export const goMailSend = (recipientId, query = {}, options = {}) => openPage(
  ROUTES.mailSend,
  {
    ...(recipientId ? { id: recipientId } : {}),
    ...query,
  },
  options,
);
export const goUserInformation = () => openPage(ROUTES.userInformation);
export const goUserNickname = () => openPage(ROUTES.userNickname);
export const goUserUsername = () => openPage(ROUTES.userUsername);
export const goUserEmail = () => openPage(ROUTES.userEmail);
export const goUserPhone = () => openPage(ROUTES.userPhone);
export const goUserPassword = () => openPage(ROUTES.userPassword);
export const goThemeCenter = (params = {}) => openPage(ROUTES.themeCenter, params);
export const goThemeDress = (group, params = {}) => openPage(ROUTES.themeDress, {
  group,
  ...params,
});
/** 我的装扮汇总：规划独立子页；当前入主题中心 ?tab=mine。 */
export const goThemeOutfit = () => openPage(ROUTES.themeCenter, { tab: 'mine' });
/** 搜索结果：规划独立子页；当前入主题中心搜索态。 */
export const goThemeSearch = (keyword = '') => openPage(ROUTES.themeCenter, {
  searching: 1,
  q: keyword,
});
export const goThemeAcquire = (params = {}) => openPage(ROUTES.themeAcquire, params);
export const goThemeMember = (params = {}) => openPage(ROUTES.themeMember, params);
export const goThemeEvent = (params = {}) => openPage(ROUTES.themeEvent, params);
export default {
  ROUTES,
  currentRoute,
  goBack,
  goCircleDetail,
  goCircleList,
  goContributionHistory,
  goCurationWorkbench,
  goCuratorApplication,
  goEntryDetail,
  goEntryBookmarks,
  goHome,
  goLogin,
  goLoginForget,
  goLoginRegister,
  goLoginWechatRegister,
  goMailDetail,
  goMailSend,
  goMails,
  goMine,
  goNotFound,
  goOnboarding,
  goRecord,
  goRecommendFollow,
  goSearch,
  goUserDetail,
  goUserEmail,
  goUserInformation,
  goUserNickname,
  goUserPassword,
  goUserPhone,
  goUserUsername,
  goThemeAcquire,
  goThemeCenter,
  goThemeDress,
  goThemeEvent,
  goThemeMember,
  goThemeOutfit,
  goThemeSearch,
  openPage,
  pageUrl,
  routeDestination,
};

export function goRecordingDetail(id, options = {}) {
  return openPage(ROUTES.recordingDetail, { id }, options);
}
export const goRecordingDrafts = () => openPage(ROUTES.recordingDrafts);
export const goCollections = (params = {}) => openPage(ROUTES.collections, params);
export const goCollectionDetail = (id) => openPage(ROUTES.collectionDetail, { id });
