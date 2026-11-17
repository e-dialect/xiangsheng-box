import { reactive } from 'vue';
import { APP_NAME } from '@/const/branding';
import { BASE_URL } from '@/const/urls';
import { appRoutePath, ROUTES } from '@/services/navigation';

const endpoint = '/site-settings/product-profile';
const localDialect = '闽.莆仙';
const homeSectionKeys = ['tools', 'featured', 'entries', 'recordings', 'collections'];
const defaultHomeSections = ['tools', 'featured'];

export const LOCAL_TOOL_OPTIONS = Object.freeze([
  { id: 'pinyin', label: '拼音方案' },
  { id: 'quiz', label: '聪明花开' },
  { id: 'kinship', label: '亲戚计算器' },
]);

const toolIds = LOCAL_TOOL_OPTIONS.map(({ id }) => id);

function orderedKeys(value, fallback, known) {
  if (!Array.isArray(value)) return [...fallback];
  return [...new Set(value.filter((key) => known.includes(key)))];
}
const profileKey = /^[a-z][a-z0-9-]{0,39}$/;

const betaHosts = new Map([
  ['box.test.edialect.top', 'box'],
  ['pxm.test.edialect.top', 'pxm'],
]);

const betaFallbacks = {
  box: { name: '乡声集盒内测版', local_tools_dialect: localDialect },
  pxm: {
    name: '兴化语记 2.0 内测版',
    credit: 'powered by 乡声集盒',
    default_dialect: localDialect,
    local_tools_dialect: localDialect,
  },
};

export function fallbackProductProfile(hostname = '', compiledKey = '') {
  const key = betaHosts.get(hostname.toLowerCase()) ?? compiledKey;
  const beta = Object.prototype.hasOwnProperty.call(betaFallbacks, key) ? betaFallbacks[key] : null;
  return {
    key: beta ? key : 'general',
    name: APP_NAME,
    credit: '',
    default_dialect: '',
    local_tools_dialect: '',
    home_sections: [...defaultHomeSections],
    enabled_tools: [...toolIds],
    featured: [],
    version: null,
    switchTargets: [],
    ...beta,
  };
}

function configuredClientKey() {
  let key = '';
  // #ifdef MP-WEIXIN
  if (typeof window === 'undefined') key = import.meta.env.VITE_BOX_PRODUCT_PROFILE || '';
  // #endif
  return profileKey.test(key) ? key : '';
}

export const productProfile = reactive(fallbackProductProfile(
  typeof window === 'undefined' ? '' : window.location.hostname,
  configuredClientKey(),
));

export function enabledLocalTools() {
  return productProfile.enabled_tools
    .map((id) => LOCAL_TOOL_OPTIONS.find((item) => item.id === id))
    .filter(Boolean);
}

export function currentProductName() {
  return productProfile.name;
}

export function productShareTitle(title) {
  return productProfile.key === 'general' ? title : `${title} · ${currentProductName()}`;
}

export function syncProductTitle() {
  // #ifdef H5
  if (typeof document !== 'undefined') document.title = currentProductName();
  // #endif
}

function validTarget(target) {
  if (typeof target?.key !== 'string' || !profileKey.test(target.key)
    || typeof target.origin !== 'string' || typeof target.name !== 'string' || !target.name) return false;
  try {
    const url = new URL(target.origin);
    const local = url.hostname === '127.0.0.1'
      || url.hostname === 'localhost'
      || url.hostname.endsWith('.localhost');
    return url.origin === target.origin && (url.protocol === 'https:' || (local && url.protocol === 'http:'));
  } catch {
    return false;
  }
}

let requestInFlight;
let loaded = false;

export async function loadProductProfile() {
  if (loaded) return productProfile;
  if (requestInFlight) return requestInFlight;
  const h5 = typeof window !== 'undefined';
  const configuredKey = configuredClientKey();
  if (!h5 && !configuredKey) return productProfile;

  requestInFlight = (async () => {
    try {
      const response = await uni.request({
        method: 'GET',
        url: `${BASE_URL}${endpoint}${h5 ? '' : `/${configuredKey}`}`,
        dataType: 'json',
        timeout: 3500,
      });
      const profile = response?.data?.profile;
      if (response?.statusCode === 200 && typeof profile?.key === 'string'
        && profileKey.test(profile.key) && typeof profile.name === 'string' && profile.name) {
        const targets = response.data.switch_targets;
        Object.assign(productProfile, {
          key: profile.key,
          name: profile.name,
          credit: profile.credit || '',
          default_dialect: profile.default_dialect || '',
          local_tools_dialect: profile.local_tools_dialect || '',
          home_sections: orderedKeys(profile.home_sections, defaultHomeSections, homeSectionKeys),
          enabled_tools: orderedKeys(profile.enabled_tools, toolIds, toolIds),
          featured: Array.isArray(profile.featured) ? profile.featured : [],
          version: profile.version,
          switchTargets: h5 && Array.isArray(targets) ? targets.filter(validTarget) : [],
        });
        loaded = true;
        syncProductTitle();
      }
    } catch {
      // The registered beta hosts keep their built-in identities if the API is down.
    }
    return productProfile;
  })();
  try {
    return await requestInFlight;
  } finally {
    requestInFlight = null;
  }
}

export const LOCAL_TOOLS_ROUTE = '/pages/tools/local';

function publicQueryKeys(path) {
  const keys = {
    [ROUTES.search]: [
      'keywords', 'key', 'q', 'dialect', 'usage_dialect_id', 'dialect_scope', 'scope',
      'recorded', 'has_recording', 'has_evidence', 'status', 'sort',
      'writing_type', 'source_type', 'ipa', 'romanization', 'source', 'concept',
    ],
    [ROUTES.entryDetail]: ['id'],
    [ROUTES.recordingDetail]: ['id'],
    [ROUTES.collectionDetail]: ['id'],
    [ROUTES.record]: ['entry_id', 'sense_id'],
    [ROUTES.collections]: ['search'],
    [ROUTES.circleDetail]: ['id'],
    [ROUTES.userDetail]: ['id'],
    [LOCAL_TOOLS_ROUTE]: ['dialect', 'tool'],
  };
  return keys[path] || [];
}

export function productSwitchUrl(target, location, base = '/', params = null) {
  if (!validTarget(target)) return null;
  const path = appRoutePath(location.pathname, base);
  if (path !== '/' && path !== LOCAL_TOOLS_ROUTE && !Object.values(ROUTES).includes(path)) {
    return new URL(base, target.origin).href;
  }
  const safePath = path === ROUTES.notFound || path.startsWith('/pages/login/') ? '/' : path;
  const url = new URL(`${base.replace(/\/$/, '')}${safePath}`, target.origin);
  const query = params
    ? new URLSearchParams(Object.entries(params).filter(([, value]) => (
      value !== undefined && value !== null && value !== ''
    )))
    : new URLSearchParams(location.search);
  publicQueryKeys(safePath).forEach((key) => {
    query.getAll(key).forEach((value) => url.searchParams.append(key, value));
  });
  return url.href;
}

export function switchProductProfile(targetKey, params = null) {
  if (typeof window === 'undefined') return;
  const target = productProfile.switchTargets.find(({ key }) => key === targetKey);
  if (!target) return;
  const url = productSwitchUrl(target, window.location, import.meta.env.BASE_URL, params);
  if (url) window.location.assign(url);
}
