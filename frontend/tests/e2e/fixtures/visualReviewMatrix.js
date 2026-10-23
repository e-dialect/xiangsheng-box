export const ROUTE_VISUAL_MATRIX = Object.freeze([
  { route: '/pages/curation/entry-review', target: '/pages/curation/entry-review?entry_id=21', slug: 'entry-review', issues: [], plan: 'docs/plans/2026-10-17-stage-2-ui.md', persona: 'member' },
  { route: '/pages/curation/action-detail', target: '/pages/curation/action-detail?id=91', slug: 'curation-action-detail', issues: [], plan: 'docs/plans/2026-10-17-stage-2-ui.md', persona: 'member' },
  { route: '/pages/recordings/details', target: '/pages/recordings/details?id=41', slug: 'recording-detail', issues: [], plan: 'docs/plans/2026-09-06-v2-restoration.md', persona: 'guest' },
  { route: '/pages/recordings/drafts', target: '/pages/recordings/drafts', slug: 'recording-drafts', issues: [], plan: 'docs/plans/2026-09-06-v2-restoration.md', persona: 'member' },
  { route: '/pages/collections/index', target: '/pages/collections/index', slug: 'collections', issues: [], plan: 'docs/plans/2026-09-06-v2-restoration.md', persona: 'guest' },
  { route: '/pages/collections/details', target: '/pages/collections/details?id=1', slug: 'collection-detail', issues: [], plan: 'docs/plans/2026-09-06-v2-restoration.md', persona: 'guest' },
  {
    route: '/pages/index', target: '/', expectedPath: '/', slug: 'listen', issues: [341], persona: 'guest',
  },
  {
    route: '/pages/search', target: '/pages/search', slug: 'search', issues: [342], persona: 'guest',
  },
  {
    route: '/pages/recordings/create', target: '/pages/recordings/create?dialect_id=3', slug: 'record', issues: [343], persona: 'member',
  },
  {
    route: '/pages/entries/details', target: '/pages/entries/details?id=21', slug: 'entry-detail', issues: [342], persona: 'guest',
  },
  {
    route: '/pages/circles/index', target: '/pages/circles/index', slug: 'circle-index', issues: [355], persona: 'guest',
  },
  {
    route: '/pages/circles/details', target: '/pages/circles/details?id=3', slug: 'circle-detail', issues: [355], persona: 'guest',
  },
  {
    route: '/pages/users/me', target: '/pages/users/me', slug: 'mine', issues: [344, 376, 379, 393, 394], persona: 'member', avatarState: 'missing',
  },
  {
    route: '/pages/users/onboarding', target: '/pages/users/onboarding?reason=new_user', slug: 'onboarding', issues: [344], persona: 'member',
  },
  {
    route: '/pages/users/recommend-follow', target: '/pages/users/recommend-follow', slug: 'recommend-follow', issues: [344], persona: 'member',
  },
  {
    route: '/pages/users/details', target: '/pages/users/details?id=12', slug: 'public-profile', issues: [355], persona: 'guest',
  },
  {
    route: '/pages/users/contributions', target: '/pages/users/contributions', slug: 'contributions', issues: [361], persona: 'member',
  },
  {
    route: '/pages/users/bookmarks', target: '/pages/users/bookmarks', slug: 'bookmarks', issues: [361], persona: 'member',
  },
  {
    route: '/pages/curation/index', target: '/pages/curation/index', slug: 'curation-workbench', issues: [360], persona: 'member',
  },
  {
    route: '/pages/curation/apply', target: '/pages/curation/apply', slug: 'curation-apply', issues: [360], persona: 'member',
  },
  {
    route: '/pages/users/settings/information', target: '/pages/users/settings/information', slug: 'settings-information', issues: [344], persona: 'member',
  },
  {
    route: '/pages/users/settings/username', target: '/pages/users/settings/username', slug: 'settings-username', issues: [344], persona: 'member',
  },
  {
    route: '/pages/users/settings/nickname', target: '/pages/users/settings/nickname', slug: 'settings-nickname', issues: [344], persona: 'member',
  },
  {
    route: '/pages/users/settings/email', target: '/pages/users/settings/email', slug: 'settings-email', issues: [344], persona: 'member',
  },
  {
    route: '/pages/users/settings/password', target: '/pages/users/settings/password', slug: 'settings-password', issues: [344], persona: 'member',
  },
  {
    route: '/pages/users/settings/telephone', target: '/pages/users/settings/telephone', slug: 'settings-telephone', issues: [344], persona: 'member',
  },
  {
    route: '/pages/users/theme-center', target: '/pages/users/theme-center', slug: 'theme-center', issues: [262, 264], persona: 'member',
  },
  {
    route: '/pages/users/theme-dress', target: '/pages/users/theme-dress?group=navbar', slug: 'theme-dress', issues: [262, 264, 371], persona: 'member',
  },
  {
    route: '/pages/users/theme-acquire', target: '/pages/users/theme-acquire', slug: 'theme-acquire', issues: [262, 264, 371], persona: 'member',
  },
  {
    route: '/pages/users/theme-member', target: '/pages/users/theme-member', slug: 'theme-member', issues: [262, 264, 371], persona: 'member',
  },
  {
    route: '/pages/users/theme-event', target: '/pages/users/theme-event?id=event-lantern', slug: 'theme-event', issues: [262, 264, 371], persona: 'member',
  },
  {
    route: '/pages/mails/index', target: '/pages/mails/index', slug: 'mail-index', issues: [356], persona: 'member',
  },
  {
    route: '/pages/mails/details', target: '/pages/mails/details?id=31', slug: 'mail-detail', issues: [356], persona: 'member',
  },
  {
    route: '/pages/mails/send', target: '/pages/mails/send?recipient=12&title=%E4%B9%A1%E9%9F%B3%E5%9B%9E%E5%A4%8D', slug: 'mail-send', issues: [356, 398], persona: 'member',
  },
  {
    route: '/pages/login/login', target: '/pages/login/login', slug: 'login', issues: [344], persona: 'guest',
  },
  {
    route: '/pages/login/register', target: '/pages/login/register', slug: 'register', issues: [344], persona: 'guest',
  },
  {
    route: '/pages/login/register/wechat', target: '/pages/login/register/wechat', slug: 'wechat-register', issues: [344], persona: 'guest',
  },
  {
    route: '/pages/login/forget', target: '/pages/login/forget', slug: 'forget-password', issues: [344], persona: 'guest',
  },
  {
    route: '/pages/error/not-found', target: '/pages/error/not-found', slug: 'not-found', issues: [362], persona: 'guest',
  },
]);

export const CORE_VISUAL_MATRIX = Object.freeze([
  { surface: 'listen', target: '/', issues: [341] },
  { surface: 'search', target: '/pages/search', issues: [342] },
  { surface: 'record', target: '/pages/recordings/create?dialect_id=3', issues: [343] },
  { surface: 'mine', target: '/pages/users/me', issues: [344] },
]);

export const STATE_VISUAL_MATRIX = Object.freeze([
  {
    state: 'loading', surface: 'listen', target: '/', issues: [341], focus: 'recordings',
  },
  {
    state: 'empty', surface: 'listen', target: '/', issues: [341], focus: 'recordings',
  },
  {
    state: 'error', surface: 'listen', target: '/', issues: [341], focus: 'recordings',
  },
  {
    state: 'success', surface: 'listen', target: '/', issues: [341], focus: 'recordings',
  },
]);

export const THEME_JOURNEY_VISUAL_MATRIX = Object.freeze([
  {
    name: '局部装扮暗色目录',
    target: '/pages/users/theme-dress?group=navbar',
    slug: 'theme-dress-dark-member',
    issues: [371],
    persona: 'member',
    theme: 'dark',
    checkSoonLabel: true,
  },
  {
    name: '装扮获取暗色路径',
    target: '/pages/users/theme-acquire',
    slug: 'theme-acquire-dark-member',
    issues: [371],
    persona: 'member',
    theme: 'dark',
  },
  {
    name: '会员权益暗色状态',
    target: '/pages/users/theme-member',
    slug: 'theme-member-dark-member',
    issues: [371],
    persona: 'member',
    theme: 'dark',
  },
  {
    name: '进行中活动暗色状态',
    target: '/pages/users/theme-event?id=event-lantern',
    slug: 'theme-event-active-dark-member',
    issues: [371],
    persona: 'member',
    theme: 'dark',
  },
  {
    name: '已结束活动',
    target: '/pages/users/theme-event?id=event-spring',
    slug: 'theme-event-ended-light-member',
    issues: [371],
    persona: 'member',
    theme: 'light',
  },
  {
    name: '无效活动入口',
    target: '/pages/users/theme-event?id=missing-theme',
    slug: 'theme-event-missing-light-member',
    issues: [371],
    persona: 'member',
    theme: 'light',
  },
]);

export function issueLabel(issues = []) {
  return issues.map((issue) => `#${issue}`).join(' + ');
}
