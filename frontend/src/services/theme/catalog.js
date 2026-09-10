/** Theme catalog data, discovery and access rules. */
import { bindThemeCatalogPort } from '@/services/theme/catalogPort';
import {
  ACCESS_CREATOR,
  ACCESS_EVENT,
  ACCESS_FREE,
  ACCESS_MEMBER,
  DEFAULT_THEME_ID,
} from '@/services/theme/contracts';
import { themeResourceHealth } from '@/services/themeFault';
import {
  cloneSkinStyle,
  componentTypeOf,
  defaultSupportTerminal,
  supportsTerminal,
} from '@/services/themeSchema';
import {
  THEME_QUERY_STORAGE_KEY,
  THEME_SEARCH_CACHE_KEY,
  THEME_SEARCH_KEYWORD_MAX,
  creatorUnlocked,
  getMemberStatus,
  getStoredThemeId,
  isFavorited,
  isLiked,
  isOwned,
  readJsonObject,
} from '@/services/theme/store';

export const THEME_CATEGORIES = [
  { value: 'all', label: '全部' },
  { value: 'simple', label: '简约' },
  { value: 'dialect', label: '地域方言风' },
  { value: 'retro', label: '复古' },
  { value: 'cyber', label: '赛博' },
  { value: 'guofeng', label: '国风' },
  { value: 'street', label: '市井烟火' },
  { value: 'festival', label: '节日限定' },
  { value: 'folk', label: '节日风俗' },
  { value: 'season', label: '季节时令' },
  { value: 'anime', label: '二次元' },
  { value: 'dark', label: '极简暗色' },
];

export const DIALECT_REGIONS = [
  { value: 'all', label: '全部地域' },
  { value: 'chuankiang', label: '川渝' },
  { value: 'wuyu', label: '江南吴语' },
  { value: 'yue', label: '岭南粤韵' },
  { value: 'minnan', label: '闽台闽南' },
  { value: 'jinshan', label: '北方晋陕' },
  { value: 'xiangchu', label: '湘楚潇湘' },
  { value: 'yungui', label: '云贵滇黔' },
];

export const THEME_FEATURE_ITEMS = [
  '导航栏配色',
  '按钮样式',
  '卡片背景',
  '页面底色',
  '图标色调',
  '轻微地域纹理',
];

export const THEME_ACCESS_FOOTER = [
  '提示：部分限定装扮为限时活动产出，活动结束后将绝版；',
  '会员装扮权益在H5、小程序两端同步；',
  '部分装扮受小程序系统限制，即使拥有也无法生效。',
];

export const THEME_SOCIAL_FOOTER = [
  '提示：收藏仅为个人标记，不会自动解锁装扮；',
  '分享的装扮，好友需要满足对应权限才能使用。',
];

export const THEME_HISTORY_FOOTER = [
  '提示：最近使用记录仅记录你启用过的装扮；保存搭配可一键还原整套界面组合；',
  '已绝版、下架的装扮无法再次启用。',
];

export const THEME_FILTER_FOOTER = [
  '提示：可以通过方言地域标签快速筛选家乡风格装扮；筛选条件会临时保留。',
];

export const THEME_PREVIEW_FOOTER = [
  '提示：实时预览仅模拟展示效果；微信小程序部分系统原生组件不支持自定义装扮。',
];

export const THEME_GUEST_FOOTER = [
  '提示：未登录状态，装扮仅保存在本地，登录后可同步到云端。',
];

export const THEME_PREVIEW_HINT = '预览仅为模拟效果，不会修改你的界面';

export const THEME_PREVIEW_ZOOM_HINT = '双指缩放查看细节，点空白关闭';

export const THEME_PREVIEW_SAMPLE = {
  nickname: '乡音阿宁',
  dialectTag: '川渝',
  recordings: [
    { title: '巷口夜市', caption: '示例录音占位' },
    { title: '渡口晚风', caption: '示例录音占位' },
  ],
  comments: [
    { name: '阿茶', text: '这罐乡音听着亲切' },
    { name: '阿宁', text: '方言标签也搭得上' },
  ],
  topics: ['市井烟火', '江南吴语'],
};

export const THEME_SORTS = [
  { value: 'newest', label: '最新上架' },
  { value: 'heat', label: '热度最高' },
  { value: 'free', label: '免费优先' },
  { value: 'name', label: '名称A-Z' },
];

export const THEME_ACCESS_FILTERS = [
  { value: 'all', label: '全部' },
  { value: ACCESS_FREE, label: '免费' },
  { value: ACCESS_MEMBER, label: '会员专属' },
  { value: ACCESS_EVENT, label: '活动限定' },
  { value: ACCESS_CREATOR, label: '方言创作者专属' },
];

export const THEME_STATUS_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'usable', label: '可直接使用' },
  { value: 'upcoming', label: '待上线' },
  { value: 'ended', label: '已绝版' },
];

export const THEME_SEARCH_TABS = [
  { value: 'all', label: '全部' },
  { value: 'theme', label: '全局主题' },
  { value: 'dress', label: '局部装扮' },
];

export const THEME_HOT_KEYWORDS = [
  '川渝烟火',
  '江南吴语',
  '方言头像框',
  '岭南粤韵',
  '复古国风',
  '节日风俗',
  '季节时令',
];

export const FAVORITE_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'theme', label: '全局主题' },
  { value: 'dress', label: '局部装扮' },
];

function freeTheme({
  id,
  name,
  description,
  blurb,
  category,
  preview,
  accent,
  primaryLook,
  ghostLook,
  effect,
  region,
}) {
  return {
    id,
    name,
    description,
    blurb,
    category,
    preview: preview || category,
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    ...(region ? { region } : {}),
    style_json: {
      accent,
      primaryLook,
      ghostLook,
      effect,
    },
  };
}

const EXTRA_FREE_THEMES = [
  freeTheme({
    id: 'inkline',
    name: '青墨细栏',
    description: '青墨栏线｜细线克制',
    blurb: '像一栏青墨笔记。细描边实底克制，不改录音播放。',
    category: 'simple',
    preview: 'simple',
    accent: 'ink',
    primaryLook: 'outline',
    ghostLook: 'line',
    effect: 'none',
  }),
  freeTheme({
    id: 'claypad',
    name: '陶土浅笺',
    description: '陶土便签｜浅底留白',
    blurb: '像一张陶土浅笺。软按钮素净描边，不改录音播放。',
    category: 'simple',
    preview: 'simple',
    accent: 'clay',
    primaryLook: 'soft',
    ghostLook: 'quiet',
    effect: 'none',
  }),
  freeTheme({
    id: 'teanote',
    name: '茶雾便条',
    description: '茶褐薄雾｜浅底便签',
    blurb: '像一页泡过茶的便条。浅底雾面键，不改录音播放。',
    category: 'simple',
    preview: 'simple',
    accent: 'tea',
    primaryLook: 'soft',
    ghostLook: 'fog',
    effect: 'none',
  }),
  freeTheme({
    id: 'fieldfresh',
    name: '田野清新',
    description: '松绿清透｜微微浮起',
    blurb: '像刚下过雨的田埂。松绿清新键微浮，不改录音播放。',
    category: 'simple',
    preview: 'simple',
    accent: 'pine',
    primaryLook: 'fresh',
    ghostLook: 'fresh',
    effect: 'lift',
  }),
  freeTheme({
    id: 'mistfill',
    name: '雾青实心',
    description: '雾青实键｜细线辅色',
    blurb: '雾青实心键配细线辅色，不改录音播放。',
    category: 'simple',
    preview: 'simple',
    accent: 'mist',
    primaryLook: 'fill',
    ghostLook: 'line',
    effect: 'none',
  }),
  freeTheme({
    id: 'giltedge',
    name: '桂金细线',
    description: '桂金描边｜克制金边',
    blurb: '像一页桂金细栏。描边带金框，不改录音播放。',
    category: 'simple',
    preview: 'simple',
    accent: 'osmanthus',
    primaryLook: 'outline',
    ghostLook: 'gilt',
    effect: 'none',
  }),
  freeTheme({
    id: 'wuyubridge',
    name: '吴语石桥',
    description: '石桥苔痕｜浅底水洗',
    blurb: '像一座吴语石桥。雾青浅底水洗键，不改录音播放。',
    category: 'dialect',
    region: 'wuyu',
    preview: 'simple',
    accent: 'mist',
    primaryLook: 'soft',
    ghostLook: 'wash',
    effect: 'none',
  }),
  freeTheme({
    id: 'wuyurain',
    name: '吴语夜雨',
    description: '夜雨晕墨｜青墨水洗',
    blurb: '像一场吴语夜雨。青墨水洗键带晕墨，不改录音播放。',
    category: 'dialect',
    region: 'wuyu',
    preview: 'simple',
    accent: 'ink',
    primaryLook: 'wash',
    ghostLook: 'fog',
    effect: 'ink',
  }),
  freeTheme({
    id: 'yueporch',
    name: '粤韵廊檐',
    description: '廊檐细线｜陶土印框',
    blurb: '像岭南廊檐。陶土细描边印框，不改录音播放。',
    category: 'dialect',
    region: 'yue',
    preview: 'festival',
    accent: 'clay',
    primaryLook: 'outline',
    ghostLook: 'seal',
    effect: 'none',
  }),
  freeTheme({
    id: 'yuewindow',
    name: '满洲金窗',
    description: '满洲窗金｜朱印浅光',
    blurb: '像一扇满洲金窗。桂金朱印键带光晕，不改录音播放。',
    category: 'dialect',
    region: 'yue',
    preview: 'festival',
    accent: 'osmanthus',
    primaryLook: 'seal',
    ghostLook: 'gilt',
    effect: 'glow',
  }),
  freeTheme({
    id: 'minnanharbor',
    name: '闽南渡口',
    description: '渡口清透｜雾青实心',
    blurb: '像闽南渡口清晨。雾青实心清透键，不改录音播放。',
    category: 'dialect',
    region: 'minnan',
    preview: 'dialect',
    accent: 'mist',
    primaryLook: 'fill',
    ghostLook: 'fresh',
    effect: 'none',
  }),
  freeTheme({
    id: 'minnantemple',
    name: '闽南庙金',
    description: '庙宇金线｜陶土古风',
    blurb: '像闽南庙宇金线。陶土古风键带金边，不改录音播放。',
    category: 'dialect',
    region: 'minnan',
    preview: 'dialect',
    accent: 'clay',
    primaryLook: 'classic',
    ghostLook: 'seal',
    effect: 'gilt',
  }),
  freeTheme({
    id: 'oldnews',
    name: '旧报栏',
    description: '旧报栏线｜青墨古风',
    blurb: '像一份旧报纸栏。青墨古风键，不改录音播放。',
    category: 'retro',
    preview: 'retro',
    accent: 'ink',
    primaryLook: 'classic',
    ghostLook: 'classic',
    effect: 'none',
  }),
  freeTheme({
    id: 'kilnslip',
    name: '窑褐笺',
    description: '窑褐细线｜深沉留白',
    blurb: '像一页窑褐笺。陶土细描边深沉框，不改录音播放。',
    category: 'retro',
    preview: 'retro',
    accent: 'clay',
    primaryLook: 'outline',
    ghostLook: 'solemn',
    effect: 'none',
  }),
  freeTheme({
    id: 'teapress',
    name: '茶印旧刊',
    description: '茶褐实心｜按压旧刊',
    blurb: '像一本茶印旧刊。茶褐实心键按下会弹，不改录音播放。',
    category: 'retro',
    preview: 'retro',
    accent: 'tea',
    primaryLook: 'fill',
    ghostLook: 'classic',
    effect: 'press',
  }),
  freeTheme({
    id: 'rustwash',
    name: '锈迹水洗',
    description: '锈褐水洗｜晕墨旧痕',
    blurb: '像一层锈迹水洗。茶褐水洗键带晕墨，不改录音播放。',
    category: 'retro',
    preview: 'retro',
    accent: 'tea',
    primaryLook: 'wash',
    ghostLook: 'quiet',
    effect: 'ink',
  }),
  freeTheme({
    id: 'ledgergold',
    name: '账册金线',
    description: '账册深沉｜桂金细框',
    blurb: '像一本描金乡账。陶土深沉键配金框，不改录音播放。',
    category: 'retro',
    preview: 'retro',
    accent: 'osmanthus',
    primaryLook: 'solemn',
    ghostLook: 'gilt',
    effect: 'none',
  }),
  freeTheme({
    id: 'mistclassic',
    name: '青灰旧栏',
    description: '青灰古风｜细线旧栏',
    blurb: '像一栏青灰旧刊。雾青古风细线，不改录音播放。',
    category: 'retro',
    preview: 'retro',
    accent: 'mist',
    primaryLook: 'classic',
    ghostLook: 'line',
    effect: 'none',
  }),
  freeTheme({
    id: 'nightgrid',
    name: '夜网岗',
    description: '夜网实心｜呼吸指示灯',
    blurb: '像一座夜网岗亭。青墨实心键带呼吸灯，不改录音播放。',
    category: 'cyber',
    preview: 'cyber',
    accent: 'ink',
    primaryLook: 'fill',
    ghostLook: 'quiet',
    effect: 'pulse',
  }),
  freeTheme({
    id: 'coldlamp',
    name: '冷青航灯',
    description: '冷青描边｜航灯光晕',
    blurb: '像一盏冷青航灯。雾青描边带光晕，不改录音播放。',
    category: 'cyber',
    preview: 'cyber',
    accent: 'mist',
    primaryLook: 'outline',
    ghostLook: 'gilt',
    effect: 'glow',
  }),
  freeTheme({
    id: 'coppernet',
    name: '铜网讯号',
    description: '铜网对比｜散光讯号',
    blurb: '像一张铜网讯号板。陶土墨色对比键带散光，不改录音播放。',
    category: 'cyber',
    preview: 'cyber',
    accent: 'clay',
    primaryLook: 'contrast',
    ghostLook: 'filled',
    effect: 'bloom',
  }),
  freeTheme({
    id: 'teaterminal',
    name: '茶褐终端',
    description: '茶褐对比｜呼吸终端',
    blurb: '像一台茶褐终端。墨色对比键带呼吸灯，不改录音播放。',
    category: 'cyber',
    preview: 'cyber',
    accent: 'tea',
    primaryLook: 'contrast',
    ghostLook: 'quiet',
    effect: 'pulse',
  }),
  freeTheme({
    id: 'goldwire',
    name: '金丝网格',
    description: '金丝描边｜金框网格',
    blurb: '像金丝织成的网格。桂金描边带金边，不改录音播放。',
    category: 'cyber',
    preview: 'cyber',
    accent: 'osmanthus',
    primaryLook: 'outline',
    ghostLook: 'gilt',
    effect: 'gilt',
  }),
  freeTheme({
    id: 'voidpulse',
    name: '暗舱散光',
    description: '暗舱浅底｜散光指示',
    blurb: '像一间暗舱。青墨浅底键带散光，不改录音播放。',
    category: 'cyber',
    preview: 'cyber',
    accent: 'ink',
    primaryLook: 'soft',
    ghostLook: 'quiet',
    effect: 'bloom',
  }),
  freeTheme({
    id: 'pinewash',
    name: '松绿泼墨',
    description: '松绿水洗｜晕墨层峦',
    blurb: '像一层松绿泼墨。水洗键带晕墨，不改录音播放。',
    category: 'guofeng',
    preview: 'guofeng',
    accent: 'pine',
    primaryLook: 'wash',
    ghostLook: 'wash',
    effect: 'ink',
  }),
  freeTheme({
    id: 'inkseal',
    name: '青墨方印',
    description: '青墨朱印｜方印光晕',
    blurb: '像一枚青墨方印。朱印键带浅光晕，不改录音播放。',
    category: 'guofeng',
    preview: 'guofeng',
    accent: 'ink',
    primaryLook: 'seal',
    ghostLook: 'seal',
    effect: 'glow',
  }),
  freeTheme({
    id: 'claywash',
    name: '陶土水墨',
    description: '陶土水洗｜素净留白',
    blurb: '像一页陶土水墨。水洗键素净框，不改录音播放。',
    category: 'guofeng',
    preview: 'guofeng',
    accent: 'clay',
    primaryLook: 'wash',
    ghostLook: 'quiet',
    effect: 'none',
  }),
  freeTheme({
    id: 'giltfan',
    name: '金扇细线',
    description: '金扇古风｜金框留白',
    blurb: '像一把金扇细骨。桂金古风键带金边，不改录音播放。',
    category: 'guofeng',
    preview: 'guofeng',
    accent: 'osmanthus',
    primaryLook: 'classic',
    ghostLook: 'gilt',
    effect: 'gilt',
  }),
  freeTheme({
    id: 'teascroll',
    name: '茶褐长卷',
    description: '茶褐水洗｜古风晕墨',
    blurb: '像一轴茶褐长卷。水洗古风键带晕墨，不改录音播放。',
    category: 'guofeng',
    preview: 'guofeng',
    accent: 'tea',
    primaryLook: 'wash',
    ghostLook: 'classic',
    effect: 'ink',
  }),
  freeTheme({
    id: 'mistshan',
    name: '远山淡墨',
    description: '远山描边｜淡墨留白',
    blurb: '像远山淡墨。雾青细描边水洗框，不改录音播放。',
    category: 'guofeng',
    preview: 'guofeng',
    accent: 'mist',
    primaryLook: 'outline',
    ghostLook: 'wash',
    effect: 'none',
  }),
  freeTheme({
    id: 'stalltea',
    name: '茶摊灯火',
    description: '茶摊实心｜灯火光晕',
    blurb: '像一盏茶摊灯。茶褐实心键带灯火光晕，不改录音播放。',
    category: 'street',
    preview: 'street',
    accent: 'tea',
    primaryLook: 'fill',
    ghostLook: 'ardent',
    effect: 'glow',
  }),
  freeTheme({
    id: 'alleyink',
    name: '巷墨暖边',
    description: '巷墨热烈｜暖边微浮',
    blurb: '像一条墨色暖巷。青墨热烈键微浮，不改录音播放。',
    category: 'street',
    preview: 'street',
    accent: 'ink',
    primaryLook: 'ardent',
    ghostLook: 'quiet',
    effect: 'lift',
  }),
  freeTheme({
    id: 'bricklamp',
    name: '砖巷浅灯',
    description: '砖巷浅底｜暖边灯火',
    blurb: '像砖巷里的浅灯。陶土浅底暖边键，不改录音播放。',
    category: 'street',
    preview: 'street',
    accent: 'clay',
    primaryLook: 'soft',
    ghostLook: 'ardent',
    effect: 'none',
  }),
  freeTheme({
    id: 'pinealley',
    name: '青瓦巷口',
    description: '青瓦热烈｜清新微浮',
    blurb: '像青瓦巷口。松绿热烈键微浮，不改录音播放。',
    category: 'street',
    preview: 'street',
    accent: 'pine',
    primaryLook: 'ardent',
    ghostLook: 'fresh',
    effect: 'lift',
  }),
  freeTheme({
    id: 'miststall',
    name: '雾夜摊牌',
    description: '雾夜实心｜薄雾灯火',
    blurb: '像雾夜里的摊牌。雾青实心键带灯火光晕，不改录音播放。',
    category: 'street',
    preview: 'street',
    accent: 'mist',
    primaryLook: 'fill',
    ghostLook: 'fog',
    effect: 'glow',
  }),
  freeTheme({
    id: 'goldstall',
    name: '金幌按压',
    description: '金幌热烈｜按压弹跳',
    blurb: '像一块金幌。桂金热烈键按下会弹，不改录音播放。',
    category: 'street',
    preview: 'street',
    accent: 'osmanthus',
    primaryLook: 'ardent',
    ghostLook: 'gilt',
    effect: 'press',
  }),
  freeTheme({
    id: 'springpine',
    name: '新岁松金',
    description: '新岁松绿｜金线清新',
    blurb: '像新岁门楣。松绿金线键，不改录音播放。',
    category: 'festival',
    preview: 'festival',
    accent: 'pine',
    primaryLook: 'gilt',
    ghostLook: 'fresh',
    effect: 'gilt',
  }),
  freeTheme({
    id: 'teafest',
    name: '社戏茶印',
    description: '社戏茶褐｜朱印散光',
    blurb: '像一场社戏茶摊。茶褐朱印键带散光，不改录音播放。',
    category: 'festival',
    preview: 'festival',
    accent: 'tea',
    primaryLook: 'seal',
    ghostLook: 'classic',
    effect: 'bloom',
  }),
  freeTheme({
    id: 'mistlantern',
    name: '纱灯雾金',
    description: '纱灯浅底｜雾金光晕',
    blurb: '像一盏纱灯。雾青浅底金框带光晕，不改录音播放。',
    category: 'festival',
    preview: 'festival',
    accent: 'mist',
    primaryLook: 'soft',
    ghostLook: 'gilt',
    effect: 'glow',
  }),
  freeTheme({
    id: 'inkyear',
    name: '岁墨朱印',
    description: '岁墨方印｜素净散光',
    blurb: '像岁夜里的朱印。青墨方印键带散光，不改录音播放。',
    category: 'festival',
    preview: 'festival',
    accent: 'ink',
    primaryLook: 'seal',
    ghostLook: 'quiet',
    effect: 'bloom',
  }),
  freeTheme({
    id: 'clayfresh',
    name: '节庆陶土',
    description: '节庆陶土｜清新暖边',
    blurb: '像节庆陶土灯。清新暖边键，不改录音播放。',
    category: 'festival',
    preview: 'festival',
    accent: 'clay',
    primaryLook: 'fresh',
    ghostLook: 'ardent',
    effect: 'none',
  }),
  freeTheme({
    id: 'osmanfill',
    name: '桂花实心',
    description: '桂花实键｜金框微浮',
    blurb: '像一朵桂花实心键。桂金微浮，不改录音播放。',
    category: 'festival',
    preview: 'festival',
    accent: 'osmanthus',
    primaryLook: 'fill',
    ghostLook: 'gilt',
    effect: 'lift',
  }),
  freeTheme({
    id: 'pixelfill',
    name: '像素实心',
    description: '像素实键｜细线按压',
    blurb: '像一格像素实心键。按下会弹，不改录音播放。',
    category: 'anime',
    preview: 'anime',
    accent: 'mist',
    primaryLook: 'fill',
    ghostLook: 'line',
    effect: 'press',
  }),
  freeTheme({
    id: 'starsoft',
    name: '星符浅底',
    description: '星符浅底｜金框呼吸',
    blurb: '像一圈浅底星符。桂金浅底键带呼吸灯，不改录音播放。',
    category: 'anime',
    preview: 'anime',
    accent: 'osmanthus',
    primaryLook: 'soft',
    ghostLook: 'gilt',
    effect: 'pulse',
  }),
  freeTheme({
    id: 'comicoutline',
    name: '漫页描边',
    description: '漫页细线｜浅填分格',
    blurb: '像一页描边漫画格。陶土细线浅填，不改录音播放。',
    category: 'anime',
    preview: 'anime',
    accent: 'clay',
    primaryLook: 'outline',
    ghostLook: 'filled',
    effect: 'none',
  }),
  freeTheme({
    id: 'inkpixel',
    name: '墨格广播',
    description: '墨格清新｜素净呼吸',
    blurb: '像一座墨格广播亭。青墨清新键带呼吸灯，不改录音播放。',
    category: 'anime',
    preview: 'anime',
    accent: 'ink',
    primaryLook: 'fresh',
    ghostLook: 'quiet',
    effect: 'pulse',
  }),
  freeTheme({
    id: 'teacomic',
    name: '茶褐漫格',
    description: '茶褐浅底｜古风按压',
    blurb: '像一页茶褐漫格。浅底古风键按下会弹，不改录音播放。',
    category: 'anime',
    preview: 'anime',
    accent: 'tea',
    primaryLook: 'soft',
    ghostLook: 'classic',
    effect: 'press',
  }),
  freeTheme({
    id: 'pineglyph',
    name: '青瓦星符',
    description: '青瓦金线｜清新光晕',
    blurb: '像青瓦上的星符。松绿金线键带光晕，不改录音播放。',
    category: 'anime',
    preview: 'anime',
    accent: 'pine',
    primaryLook: 'gilt',
    ghostLook: 'fresh',
    effect: 'glow',
  }),
  freeTheme({
    id: 'inkfill',
    name: '墨夜实心',
    description: '墨夜实键｜素净细线',
    blurb: '像夜里的实心墨键。青墨素净，不改录音播放。',
    category: 'dark',
    preview: 'dark',
    accent: 'ink',
    primaryLook: 'fill',
    ghostLook: 'quiet',
    effect: 'none',
  }),
  freeTheme({
    id: 'teacontrast',
    name: '炭火对比',
    description: '炭火墨色｜薄雾对比',
    blurb: '像炭火边的对比键。茶褐墨色雾面，不改录音播放。',
    category: 'dark',
    preview: 'dark',
    accent: 'tea',
    primaryLook: 'contrast',
    ghostLook: 'fog',
    effect: 'none',
  }),
  freeTheme({
    id: 'claydark',
    name: '暗窑深沉',
    description: '暗窑陶土｜深沉素净',
    blurb: '像一座暗窑。陶土深沉键，不改录音播放。',
    category: 'dark',
    preview: 'dark',
    accent: 'clay',
    primaryLook: 'solemn',
    ghostLook: 'quiet',
    effect: 'none',
  }),
  freeTheme({
    id: 'osmandark',
    name: '暗金薄雾',
    description: '暗金雾面｜金框夜色',
    blurb: '像暗夜里的薄金。桂金雾面键，不改录音播放。',
    category: 'dark',
    preview: 'dark',
    accent: 'osmanthus',
    primaryLook: 'fog',
    ghostLook: 'gilt',
    effect: 'none',
  }),
  freeTheme({
    id: 'pinevoid',
    name: '夜田对比',
    description: '夜田松绿｜墨色对比',
    blurb: '像夜田里的对比键。松绿墨色素净，不改录音播放。',
    category: 'dark',
    preview: 'dark',
    accent: 'pine',
    primaryLook: 'contrast',
    ghostLook: 'quiet',
    effect: 'none',
  }),
  freeTheme({
    id: 'mistfog',
    name: '空雾暗角',
    description: '空雾雾面｜薄雾暗角',
    blurb: '像空雾里的暗角。雾青雾面键，不改录音播放。',
    category: 'dark',
    preview: 'dark',
    accent: 'mist',
    primaryLook: 'fog',
    ghostLook: 'fog',
    effect: 'none',
  }),
  freeTheme({
    id: 'templefair',
    name: '庙会灯幡',
    description: '庙会灯幡｜陶土热烈',
    blurb: '像一场乡庙会。陶土热烈键带浅光，不改录音播放。',
    category: 'folk',
    preview: 'folk',
    accent: 'clay',
    primaryLook: 'ardent',
    ghostLook: 'gilt',
    effect: 'glow',
  }),
  freeTheme({
    id: 'paperhorse',
    name: '纸马乡祀',
    description: '纸马乡祀｜茶褐古风',
    blurb: '像一匹纸马。茶褐古风键带晕墨，不改录音播放。',
    category: 'folk',
    preview: 'folk',
    accent: 'tea',
    primaryLook: 'classic',
    ghostLook: 'classic',
    effect: 'ink',
  }),
  freeTheme({
    id: 'drumlane',
    name: '社鼓巷口',
    description: '社鼓巷口｜松绿清新',
    blurb: '像巷口社鼓。松绿清新键微浮，不改录音播放。',
    category: 'folk',
    preview: 'folk',
    accent: 'pine',
    primaryLook: 'fill',
    ghostLook: 'fresh',
    effect: 'lift',
  }),
  freeTheme({
    id: 'riverlantern',
    name: '河灯夜渡',
    description: '河灯夜渡｜雾青水洗',
    blurb: '像河面上的纸灯。雾青水洗键，不改录音播放。',
    category: 'folk',
    preview: 'folk',
    accent: 'mist',
    primaryLook: 'wash',
    ghostLook: 'fog',
    effect: 'none',
  }),
  freeTheme({
    id: 'wheatrite',
    name: '麦收祭田',
    description: '麦收祭田｜桂金朱印',
    blurb: '像麦收祭田。桂金朱印键带金边，不改录音播放。',
    category: 'folk',
    preview: 'folk',
    accent: 'osmanthus',
    primaryLook: 'gilt',
    ghostLook: 'seal',
    effect: 'gilt',
  }),
  freeTheme({
    id: 'kilnrite',
    name: '窑神香火',
    description: '窑神香火｜陶土深沉',
    blurb: '像窑神香火。陶土深沉键，不改录音播放。',
    category: 'folk',
    preview: 'folk',
    accent: 'clay',
    primaryLook: 'solemn',
    ghostLook: 'quiet',
    effect: 'none',
  }),
  freeTheme({
    id: 'boatbless',
    name: '开船祈风',
    description: '开船祈风｜青墨细线',
    blurb: '像开船祈风。青墨细描边，不改录音播放。',
    category: 'folk',
    preview: 'folk',
    accent: 'ink',
    primaryLook: 'outline',
    ghostLook: 'line',
    effect: 'none',
  }),
  freeTheme({
    id: 'beamred',
    name: '上梁红绸',
    description: '上梁红绸｜茶褐朱印',
    blurb: '像上梁红绸。茶褐朱印键按下会弹，不改录音播放。',
    category: 'folk',
    preview: 'folk',
    accent: 'tea',
    primaryLook: 'seal',
    ghostLook: 'classic',
    effect: 'press',
  }),
  freeTheme({
    id: 'nightwatch',
    name: '打更巷火',
    description: '打更巷火｜松绿对比',
    blurb: '像打更巷火。松绿对比键带散光，不改录音播放。',
    category: 'folk',
    preview: 'folk',
    accent: 'pine',
    primaryLook: 'contrast',
    ghostLook: 'ardent',
    effect: 'bloom',
  }),
  freeTheme({
    id: 'springthaw',
    name: '开春解冻',
    description: '开春解冻｜松绿清新',
    blurb: '像开春解冻。松绿清新水洗键，不改录音播放。',
    category: 'season',
    preview: 'season',
    accent: 'pine',
    primaryLook: 'fresh',
    ghostLook: 'wash',
    effect: 'none',
  }),
  freeTheme({
    id: 'summerlotus',
    name: '夏荷田塘',
    description: '夏荷田塘｜雾青浅底',
    blurb: '像夏荷田塘。雾青浅底清新键微浮，不改录音播放。',
    category: 'season',
    preview: 'season',
    accent: 'mist',
    primaryLook: 'soft',
    ghostLook: 'fresh',
    effect: 'lift',
  }),
  freeTheme({
    id: 'autumngrain',
    name: '秋晒谷场',
    description: '秋晒谷场｜桂金古风',
    blurb: '像秋晒谷场。桂金古风键，不改录音播放。',
    category: 'season',
    preview: 'season',
    accent: 'osmanthus',
    primaryLook: 'classic',
    ghostLook: 'gilt',
    effect: 'none',
  }),
  freeTheme({
    id: 'winterhearth',
    name: '冬夜炭火',
    description: '冬夜炭火｜茶褐薄雾',
    blurb: '像冬夜炭火。茶褐薄雾键，不改录音播放。',
    category: 'season',
    preview: 'season',
    accent: 'tea',
    primaryLook: 'fog',
    ghostLook: 'quiet',
    effect: 'none',
  }),
  freeTheme({
    id: 'rainstart',
    name: '清明雨丝',
    description: '清明雨丝｜青墨水洗',
    blurb: '像清明雨丝。青墨水洗键带晕墨，不改录音播放。',
    category: 'season',
    preview: 'season',
    accent: 'ink',
    primaryLook: 'wash',
    ghostLook: 'wash',
    effect: 'ink',
  }),
  freeTheme({
    id: 'grainrain',
    name: '谷雨茶芽',
    description: '谷雨茶芽｜松绿实心',
    blurb: '像谷雨茶芽。松绿实心雾面键，不改录音播放。',
    category: 'season',
    preview: 'season',
    accent: 'pine',
    primaryLook: 'fill',
    ghostLook: 'fog',
    effect: 'none',
  }),
  freeTheme({
    id: 'heatwave',
    name: '大暑蝉鸣',
    description: '大暑蝉鸣｜陶土热烈',
    blurb: '像大暑蝉鸣。陶土热烈清新键带光晕，不改录音播放。',
    category: 'season',
    preview: 'season',
    accent: 'clay',
    primaryLook: 'ardent',
    ghostLook: 'fresh',
    effect: 'glow',
  }),
  freeTheme({
    id: 'frostfall',
    name: '霜降薄雾',
    description: '霜降薄雾｜雾青细线',
    blurb: '像霜降薄雾。雾青细描边雾面，不改录音播放。',
    category: 'season',
    preview: 'season',
    accent: 'mist',
    primaryLook: 'outline',
    ghostLook: 'fog',
    effect: 'none',
  }),
  freeTheme({
    id: 'snownook',
    name: '小雪窗格',
    description: '小雪窗格｜青墨深沉',
    blurb: '像小雪窗格。青墨深沉金框，不改录音播放。',
    category: 'season',
    preview: 'season',
    accent: 'ink',
    primaryLook: 'solemn',
    ghostLook: 'gilt',
    effect: 'none',
  }),
];

export const GLOBAL_THEMES = [
  {
    id: DEFAULT_THEME_ID,
    name: '默认方言主题',
    description: '乡野松绿｜统一导航、按钮和卡片配色',
    blurb: '乡野松绿实心键。会改导航栏、按钮、卡片、背景和文字色彩，带轻微纹理，不改录音播放画面。',
    category: 'simple',
    preview: 'default',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'pine',
      primaryLook: 'fill',
      ghostLook: 'line',
      effect: 'none',
    },
  },
  {
    id: 'paper',
    name: '素白纸本',
    description: '田野笔记｜浅底细线、留白克制',
    blurb: '像一本方言调查手册。一键换成浅底细线，不改录音播放。',
    category: 'simple',
    preview: 'simple',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'pine',
      primaryLook: 'outline',
      ghostLook: 'line',
      effect: 'none',
    },
  },
  {
    id: 'mistpad',
    name: '雾青便笺',
    description: '浅雾便签｜软底清透',
    blurb: '像一张雾青便笺。浅底软按钮、淡雾描边，不改录音播放。',
    category: 'simple',
    preview: 'simple',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'mist',
      primaryLook: 'soft',
      ghostLook: 'fog',
      effect: 'none',
    },
  },
  {
    id: 'member-pine',
    name: '松风会员',
    description: '会员专属｜松绿细纹',
    blurb: '开通会员后可启用。解锁后改导航、按钮和卡片，不改录音播放。',
    category: 'simple',
    preview: 'simple',
    available: true,
    access: ACCESS_MEMBER,
    tag: '会员专属',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'pine',
      primaryLook: 'fill',
    },
  },
  {
    id: 'event-lantern',
    name: '同乡灯会',
    description: '活动限定｜同乡灯火',
    blurb: '限时同乡灯会产出。完成后领取，活动结束会绝版。',
    category: 'street',
    preview: 'street',
    available: true,
    access: ACCESS_EVENT,
    eventStatus: 'active',
    tag: '活动限定',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'clay',
      effect: 'none',
    },
  },
  {
    id: 'event-spring',
    name: '开春乡音',
    description: '活动已结束｜已绝版',
    blurb: '开春乡音活动已结束，新用户无法再获取。',
    category: 'festival',
    preview: 'festival',
    available: true,
    access: ACCESS_EVENT,
    eventStatus: 'ended',
    tag: '已绝版',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'clay',
    },
  },
  {
    id: 'creator-tile',
    name: '方言达人青瓦',
    description: '创作者专属｜青瓦细纹',
    blurb: '完成方言创作任务后领取，永久可用。',
    category: 'guofeng',
    preview: 'guofeng',
    available: true,
    access: ACCESS_CREATOR,
    tag: '方言创作者专属',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'pine',
    },
  },
  {
    id: 'chuankiang',
    name: '川渝烟火',
    description: '巴蜀市井热辣风格',
    blurb: '巴蜀市井热辣。上线后换暖色灯火和浅辣椒纹，不改录音播放。',
    category: 'dialect',
    region: 'chuankiang',
    preview: 'dialect',
    available: false,
    tag: '敬请期待',
  },
  {
    id: 'wuyu',
    name: '江南吴语',
    description: '水乡青墨｜浅波纹与雾青水洗',
    blurb: '像一场江南梅雨。整套换成雾青水墨、淡雾描边，不改录音播放。',
    category: 'dialect',
    region: 'wuyu',
    preview: 'simple',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'mist',
      primaryLook: 'wash',
      ghostLook: 'fog',
      effect: 'none',
    },
  },
  {
    id: 'yue',
    name: '岭南粤韵',
    description: '骑楼朱印｜砖红满洲窗',
    blurb: '像走进岭南骑楼。陶土朱印键、浅光晕，不改录音播放。',
    category: 'dialect',
    region: 'yue',
    preview: 'festival',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'clay',
      primaryLook: 'seal',
      ghostLook: 'seal',
      effect: 'glow',
    },
  },
  {
    id: 'minnan',
    name: '闽台闽南',
    description: '盐田暖金｜海岛桂色',
    blurb: '像闽南盐田午后。桂金实心键微微浮起，不改录音播放。',
    category: 'dialect',
    region: 'minnan',
    preview: 'dialect',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'osmanthus',
      primaryLook: 'fill',
      ghostLook: 'fresh',
      effect: 'lift',
    },
  },
  {
    id: 'jinshan',
    name: '北方晋陕',
    description: '黄土厚重质朴风格',
    blurb: '黄土质朴。上线后换土色与浅窑纹，不改录音播放。',
    category: 'dialect',
    region: 'jinshan',
    preview: 'retro',
    available: false,
    tag: '敬请期待',
  },
  {
    id: 'xiangchu',
    name: '湘楚潇湘',
    description: '湘楚热烈氛围感',
    blurb: '湘楚热烈。上线后换朱红与浅辣纹，不改录音播放。',
    category: 'dialect',
    region: 'xiangchu',
    preview: 'festival',
    available: false,
    tag: '敬请期待',
  },
  {
    id: 'yungui',
    name: '云贵滇黔',
    description: '云贵高原民族风',
    blurb: '云贵高原。上线后换靛蓝与浅织纹，不改录音播放。',
    category: 'dialect',
    region: 'yungui',
    preview: 'guofeng',
    available: false,
    tag: '敬请期待',
  },
  {
    id: 'mimeograph',
    name: '油印乡刊',
    description: '旧刊栏线｜茶褐油墨与纸边',
    blurb: '像一份油印乡刊。整套换成茶褐古风栏线，字迹带晕墨，不改录音播放。',
    category: 'retro',
    preview: 'retro',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'tea',
      primaryLook: 'classic',
      ghostLook: 'classic',
      effect: 'ink',
    },
  },
  {
    id: 'teaslip',
    name: '茶褐笺',
    description: '书房茶渍｜细线笺纸',
    blurb: '像一页泡过茶的笺纸。茶褐细描边、素净留白，不改录音播放。',
    category: 'retro',
    preview: 'retro',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'tea',
      primaryLook: 'outline',
      ghostLook: 'quiet',
      effect: 'none',
    },
  },
  {
    id: 'ledger',
    name: '乡账旧册',
    description: '账册栏线｜陶土深沉',
    blurb: '像一本乡账旧册。陶土深沉方键，不改录音播放。',
    category: 'retro',
    preview: 'retro',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'clay',
      primaryLook: 'solemn',
      ghostLook: 'solemn',
      effect: 'none',
    },
  },
  {
    id: 'nightferry',
    name: '夜航电台',
    description: '夜航网格｜青墨指示灯',
    blurb: '像一间夜航播音室。深底青墨、金线描边、按钮带光晕，不改录音播放。',
    category: 'cyber',
    preview: 'cyber',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'ink',
      primaryLook: 'contrast',
      ghostLook: 'gilt',
      effect: 'glow',
    },
  },
  {
    id: 'signalbooth',
    name: '讯号亭',
    description: '冷青指示灯｜赛博岗亭',
    blurb: '像一座夜航讯号亭。雾青实心键带呼吸灯，不改录音播放。',
    category: 'cyber',
    preview: 'cyber',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'mist',
      primaryLook: 'fill',
      ghostLook: 'filled',
      effect: 'pulse',
    },
  },
  {
    id: 'gridlamp',
    name: '网格航灯',
    description: '航灯散光｜金线网格',
    blurb: '像网格上的航灯。桂金描边带散光，不改录音播放。',
    category: 'cyber',
    preview: 'cyber',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'osmanthus',
      primaryLook: 'gilt',
      ghostLook: 'gilt',
      effect: 'bloom',
    },
  },
  {
    id: 'qingshan',
    name: '青绿山水',
    description: '青绿层峦｜松绿描边留白',
    blurb: '像一卷青绿山水。松绿细描边、水墨浅底，不改录音播放。',
    category: 'guofeng',
    preview: 'guofeng',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'pine',
      primaryLook: 'outline',
      ghostLook: 'wash',
      effect: 'none',
    },
  },
  {
    id: 'sealpaper',
    name: '朱印宣纸',
    description: '朱印方章｜宣纸栏',
    blurb: '像盖过朱印的宣纸。陶土方印键带浅光晕，不改录音播放。',
    category: 'guofeng',
    preview: 'guofeng',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'clay',
      primaryLook: 'seal',
      ghostLook: 'seal',
      effect: 'glow',
    },
  },
  {
    id: 'inkscroll',
    name: '水墨长卷',
    description: '墨洗长卷｜晕墨留白',
    blurb: '像一轴水墨长卷。青墨水洗键带晕墨，不改录音播放。',
    category: 'guofeng',
    preview: 'guofeng',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'ink',
      primaryLook: 'wash',
      ghostLook: 'wash',
      effect: 'ink',
    },
  },
  {
    id: 'nightstall',
    name: '夜市灯牌',
    description: '街沿灯火｜暖牌光晕',
    blurb: '像巷口夜市灯牌。陶土实心键带灯火光晕，不改录音播放。',
    category: 'street',
    preview: 'street',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'clay',
      primaryLook: 'fill',
      ghostLook: 'ardent',
      effect: 'glow',
    },
  },
  {
    id: 'teahouse',
    name: '茶馆木栏',
    description: '木栏茶座｜茶褐热络',
    blurb: '像坐进一间茶馆。茶褐实心键、暖边微浮，不改录音播放。',
    category: 'street',
    preview: 'street',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'tea',
      primaryLook: 'ardent',
      ghostLook: 'ardent',
      effect: 'lift',
    },
  },
  {
    id: 'lanternalley',
    name: '巷口灯笼',
    description: '灯笼散光｜桂金巷口',
    blurb: '像巷口挂着灯笼。桂金浅底键带散光，不改录音播放。',
    category: 'street',
    preview: 'street',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'osmanthus',
      primaryLook: 'soft',
      ghostLook: 'ardent',
      effect: 'bloom',
    },
  },
  {
    id: 'duanwu',
    name: '端午蒲艾',
    description: '蒲艾青绿｜清新时节',
    blurb: '像门楣上的蒲叶艾草。松绿清新键，不改录音播放。',
    category: 'festival',
    preview: 'festival',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'pine',
      primaryLook: 'fresh',
      ghostLook: 'fresh',
      effect: 'none',
    },
  },
  {
    id: 'midautumn',
    name: '中秋桂影',
    description: '桂金圆窗｜中秋听乡音',
    blurb: '像桂花夜里的圆窗。整套换成桂金色金线按钮，不改录音播放。',
    category: 'festival',
    preview: 'festival',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'osmanthus',
      primaryLook: 'gilt',
      ghostLook: 'gilt',
      effect: 'gilt',
    },
  },
  {
    id: 'lanternyear',
    name: '岁灯',
    description: '年节灯火｜朱印散光',
    blurb: '像岁夜里的一盏灯。陶土朱印键带散光，不改录音播放。',
    category: 'festival',
    preview: 'festival',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'clay',
      primaryLook: 'seal',
      ghostLook: 'seal',
      effect: 'bloom',
    },
  },
  {
    id: 'pixelbooth',
    name: '像素广播亭',
    description: '像素格子｜清新播音亭',
    blurb: '像一座像素广播亭。雾青浅底按钮带呼吸灯，不改录音播放。',
    category: 'anime',
    preview: 'anime',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'mist',
      primaryLook: 'fresh',
      ghostLook: 'filled',
      effect: 'pulse',
    },
  },
  {
    id: 'starglyph',
    name: '星符乡音',
    description: '星符金边｜浅星点',
    blurb: '像一圈星符边框。桂金描边带光晕，不改录音播放。',
    category: 'anime',
    preview: 'anime',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'osmanthus',
      primaryLook: 'gilt',
      ghostLook: 'gilt',
      effect: 'glow',
    },
  },
  {
    id: 'comicstrip',
    name: '格子漫页',
    description: '漫画分格｜按压弹跳',
    blurb: '像一页格子漫画。陶土实心键按下会弹，不改录音播放。',
    category: 'anime',
    preview: 'anime',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'clay',
      primaryLook: 'fill',
      ghostLook: 'filled',
      effect: 'press',
    },
  },
  {
    id: 'inknight',
    name: '墨夜极简',
    description: '深底细线｜极简暗色',
    blurb: '像夜里的田野笔记。青墨深沉键、素净细线，不改录音播放。',
    category: 'dark',
    preview: 'dark',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'ink',
      primaryLook: 'solemn',
      ghostLook: 'quiet',
      effect: 'none',
    },
  },
  {
    id: 'voidgrid',
    name: '空格暗网',
    description: '暗网细格｜雾青对比',
    blurb: '像一张空格暗网。雾青墨色对比键，不改录音播放。',
    category: 'dark',
    preview: 'dark',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'mist',
      primaryLook: 'contrast',
      ghostLook: 'quiet',
      effect: 'none',
    },
  },
  {
    id: 'coalnook',
    name: '炭火暗角',
    description: '暖暗炭火｜薄雾茶褐',
    blurb: '像炭火边的暗角。茶褐雾面键，不改录音播放。',
    category: 'dark',
    preview: 'dark',
    available: true,
    access: ACCESS_FREE,
    tag: '免费',
    support_terminal: ['h5', 'miniprogram'],
    style_json: {
      accent: 'tea',
      primaryLook: 'fog',
      ghostLook: 'fog',
      effect: 'none',
    },
  },
  ...EXTRA_FREE_THEMES,
];

const GRAIN_KINDS = {
  dot: { image: 'var(--grain-dot)', size: '46rpx 46rpx' },
  paper: { image: 'var(--grain-paper)', size: '14rpx 14rpx' },
  fiber: { image: 'var(--grain-fiber)', size: '18rpx 18rpx' },
  grid: { image: 'var(--grain-grid)', size: '24rpx 24rpx' },
  rain: { image: 'var(--grain-rain)', size: '16rpx 16rpx' },
  mist: { image: 'var(--grain-mist)', size: '32rpx 32rpx' },
  seal: { image: 'var(--grain-seal)', size: '36rpx 36rpx' },
  glow: { image: 'var(--grain-glow)', size: '28rpx 28rpx' },
  ink: { image: 'var(--grain-ink)', size: '22rpx 22rpx' },
};

function packSurface(overrides = {}) {
  const out = {};
  if (overrides.grainKind) {
    const grain = GRAIN_KINDS[overrides.grainKind];
    if (grain) {
      out.grainImage = grain.image;
      out.grainSize = grain.size;
    }
  }
  if (overrides.radius != null) out.cardBorderRadius = overrides.radius;
  if (overrides.cardBg != null) out.cardBackground = overrides.cardBg;
  if (overrides.cardBorder != null) out.cardBorderColor = overrides.cardBorder;
  if (overrides.cardWidth != null) out.cardBorderWidth = overrides.cardWidth;
  if (overrides.cardShadow != null) out.cardShadow = overrides.cardShadow;
  if (overrides.cardPad != null) out.cardPadding = overrides.cardPad;
  if (overrides.profileBg != null) out.profileBackground = overrides.profileBg;
  if (overrides.profileColor != null) out.profileColor = overrides.profileColor;
  if (overrides.avatarWidth != null) out.avatarBorderWidth = overrides.avatarWidth;
  if (overrides.avatarColor != null) out.avatarBorderColor = overrides.avatarColor;
  if (overrides.commentRadius != null) out.commentBorderRadius = overrides.commentRadius;
  if (overrides.commentBg != null) out.commentBackground = overrides.commentBg;
  if (overrides.commentBorder != null) out.commentBorderColor = overrides.commentBorder;
  if (overrides.commentWidth != null) out.commentBorderWidth = overrides.commentWidth;
  if (overrides.navBg != null) out.navBackground = overrides.navBg;
  if (overrides.navColor != null) out.navColor = overrides.navColor;
  if (overrides.navBorder != null) out.navBorder = overrides.navBorder;
  if (overrides.tabBg != null) out.tabBackground = overrides.tabBg;
  if (overrides.tabColor != null) out.tabColor = overrides.tabColor;
  if (overrides.tabAccent != null) out.tabAccent = overrides.tabAccent;
  if (overrides.tabOnAccent != null) out.tabOnAccent = overrides.tabOnAccent;
  if (overrides.tabEmphasis != null) out.tabEmphasis = overrides.tabEmphasis;
  if (overrides.tabBorder != null) out.tabBorder = overrides.tabBorder;
  if (overrides.grain != null) out.grainOpacity = overrides.grain;
  if (overrides.grainImage != null) out.grainImage = overrides.grainImage;
  if (overrides.grainSize != null) out.grainSize = overrides.grainSize;
  if (overrides.inputBg != null) out.inputBackground = overrides.inputBg;
  if (overrides.inputRadius != null) out.inputBorderRadius = overrides.inputRadius;
  if (overrides.inputBorder != null) out.inputBorderColor = overrides.inputBorder;
  if (overrides.inputWidth != null) out.inputBorderWidth = overrides.inputWidth;
  if (overrides.topicBg != null) out.topicBackground = overrides.topicBg;
  if (overrides.topicRadius != null) out.topicBorderRadius = overrides.topicRadius;
  if (overrides.topicBorder != null) out.topicBorderColor = overrides.topicBorder;
  if (overrides.topicWidth != null) out.topicBorderWidth = overrides.topicWidth;
  if (overrides.buttonRadius != null) out.buttonRadius = overrides.buttonRadius;
  if (overrides.letter != null) out.letterSpacing = overrides.letter;
  return out;
}

function styleFamily(overrides = {}) {
  return {
    cardBorderRadius: '12px',
    cardBackground: 'var(--surface-color)',
    cardBorderColor: 'var(--border-color)',
    cardBorderWidth: '1px',
    cardShadow: 'none',
    cardPadding: '24rpx',
    profileBackground: 'transparent',
    profileColor: 'var(--text-color)',
    avatarBorderWidth: '2px',
    avatarBorderColor: 'var(--accent-color)',
    commentBorderRadius: '12px',
    commentBackground: 'var(--surface-subtle-color)',
    commentBorderColor: 'transparent',
    commentBorderWidth: '0px',
    navBackground: 'var(--accent-subtle-color)',
    navColor: 'var(--text-color)',
    navBorder: 'var(--accent-color)',
    tabBackground: 'var(--immersive-veil-color)',
    tabColor: 'var(--on-immersive-muted-color)',
    tabAccent: 'var(--immersive-accent-color)',
    tabOnAccent: 'var(--immersive-bg-strong-color)',
    tabEmphasis: 'var(--on-immersive-color)',
    tabBorder: 'var(--immersive-border-color)',
    grainOpacity: '0.14',
    grainImage: 'var(--grain-dot)',
    grainSize: '46rpx 46rpx',
    inputBackground: 'var(--surface-color)',
    inputBorderRadius: '12px',
    inputBorderColor: 'var(--border-color)',
    inputBorderWidth: '1px',
    topicBackground: 'var(--surface-subtle-color)',
    topicBorderRadius: '12px',
    topicBorderColor: 'var(--border-color)',
    topicBorderWidth: '1px',
    buttonRadius: '999rpx',
    letterSpacing: '0em',
    ...packSurface(overrides),
  };
}

export const DEFAULT_FAMILY_STYLE = cloneSkinStyle(styleFamily());

const STYLE_FAMILIES = {
  simple: styleFamily({
    radius: '12px',
    cardWidth: '1px',
    grain: '0.1',
    grainKind: 'dot',
    letter: '0em',
    buttonRadius: '14px',
    commentWidth: '0px',
    inputRadius: '12px',
    topicRadius: '12px',
    cardPad: '24rpx',
  }),
  dialect: styleFamily({
    radius: '14px',
    cardBg: 'var(--page-color)',
    cardWidth: '0px',
    commentRadius: '16px',
    avatarWidth: '0px',
    grain: '0.16',
    grainKind: 'mist',
    letter: '0.02em',
    buttonRadius: '16px',
    navBg: 'var(--page-color)',
    inputBg: 'var(--page-color)',
    inputWidth: '0px',
    topicBg: 'var(--page-color)',
    topicWidth: '0px',
    cardPad: '28rpx',
  }),
  retro: styleFamily({
    radius: '2px',
    cardWidth: '1px',
    cardBorder: 'var(--text-color)',
    commentRadius: '2px',
    avatarWidth: '1px',
    grain: '0.18',
    grainKind: 'paper',
    letter: '0.08em',
    buttonRadius: '2px',
    commentWidth: '1px',
    commentBorder: 'var(--text-color)',
    navBg: 'var(--page-color)',
    navBorder: 'var(--text-color)',
    inputRadius: '2px',
    inputBorder: 'var(--text-color)',
    topicRadius: '2px',
    topicBorder: 'var(--text-color)',
    cardPad: '20rpx',
  }),
  cyber: styleFamily({
    radius: '0px',
    cardWidth: '1px',
    cardBorder: 'var(--accent-color)',
    cardShadow: '0 0 22rpx var(--accent-subtle-color)',
    commentRadius: '0px',
    grain: '0.2',
    grainKind: 'grid',
    letter: '0.1em',
    buttonRadius: '0px',
    commentWidth: '1px',
    commentBorder: 'var(--accent-color)',
    navBg: 'var(--page-color)',
    tabBg: 'var(--page-color)',
    tabColor: 'var(--muted-color)',
    tabAccent: 'var(--accent-color)',
    tabOnAccent: 'var(--on-accent-color)',
    tabEmphasis: 'var(--text-color)',
    tabBorder: 'var(--border-color)',
    inputRadius: '0px',
    inputBorder: 'var(--accent-color)',
    topicRadius: '0px',
    topicBorder: 'var(--accent-color)',
    cardPad: '18rpx',
  }),
  guofeng: styleFamily({
    radius: '8px',
    cardWidth: '2px',
    cardBorder: 'var(--gilt-color)',
    commentRadius: '6px',
    avatarWidth: '3px',
    avatarColor: 'var(--gilt-color)',
    grain: '0.12',
    grainKind: 'seal',
    letter: '0.14em',
    buttonRadius: '8px',
    commentWidth: '1px',
    commentBorder: 'var(--gilt-color)',
    navBorder: 'var(--gilt-color)',
    inputBorder: 'var(--gilt-color)',
    topicBorder: 'var(--gilt-color)',
    cardPad: '22rpx',
  }),
  street: styleFamily({
    radius: '10px',
    cardShadow: '0 10rpx 24rpx var(--border-color)',
    commentRadius: '10px',
    grain: '0.14',
    grainKind: 'fiber',
    letter: '0.04em',
    buttonRadius: '10px',
    navBg: 'var(--accent-subtle-color)',
    inputBg: 'var(--surface-subtle-color)',
    topicBg: 'var(--accent-subtle-color)',
    cardPad: '24rpx',
  }),
  festival: styleFamily({
    radius: '16px',
    cardBorder: 'var(--gilt-color)',
    cardShadow: '0 0 18rpx var(--accent-subtle-color)',
    commentRadius: '16px',
    avatarColor: 'var(--gilt-color)',
    grain: '0.1',
    grainKind: 'glow',
    letter: '0.1em',
    buttonRadius: '16px',
    commentWidth: '1px',
    commentBorder: 'var(--gilt-color)',
    tabBg: 'var(--accent-subtle-color)',
    tabColor: 'var(--muted-color)',
    tabAccent: 'var(--accent-color)',
    tabOnAccent: 'var(--on-accent-color)',
    tabEmphasis: 'var(--text-color)',
    tabBorder: 'var(--border-color)',
    topicBorder: 'var(--gilt-color)',
    cardPad: '26rpx',
  }),
  folk: styleFamily({
    radius: '12px',
    cardWidth: '2px',
    cardBorder: 'var(--accent-color)',
    cardShadow: '0 8rpx 20rpx var(--accent-subtle-color)',
    commentRadius: '12px',
    grain: '0.15',
    grainKind: 'paper',
    letter: '0.06em',
    buttonRadius: '8px',
    commentWidth: '2px',
    commentBorder: 'var(--accent-color)',
    inputWidth: '2px',
    inputBorder: 'var(--accent-color)',
    topicWidth: '2px',
    topicBorder: 'var(--accent-color)',
    cardPad: '22rpx',
  }),
  season: styleFamily({
    radius: '18px',
    cardBg: 'var(--page-color)',
    cardWidth: '0px',
    commentRadius: '18px',
    avatarWidth: '1px',
    grain: '0.13',
    grainKind: 'mist',
    letter: '0.04em',
    buttonRadius: '18px',
    inputBg: 'var(--page-color)',
    inputWidth: '0px',
    topicBg: 'var(--page-color)',
    topicWidth: '0px',
    cardPad: '28rpx',
  }),
  anime: styleFamily({
    radius: '6px',
    cardWidth: '2px',
    cardBorder: 'var(--text-color)',
    commentRadius: '8px',
    avatarWidth: '3px',
    grain: '0.12',
    grainKind: 'dot',
    grainSize: '20rpx 20rpx',
    letter: '0.08em',
    buttonRadius: '8px',
    commentWidth: '2px',
    commentBorder: 'var(--text-color)',
    inputWidth: '2px',
    topicWidth: '2px',
    topicBorder: 'var(--text-color)',
    cardPad: '20rpx',
  }),
  dark: styleFamily({
    radius: '8px',
    cardBg: 'var(--page-color)',
    cardWidth: '1px',
    commentRadius: '8px',
    grain: '0.18',
    grainKind: 'ink',
    letter: '0.06em',
    buttonRadius: '8px',
    commentWidth: '1px',
    commentBorder: 'var(--border-color)',
    navBg: 'var(--page-color)',
    inputBg: 'var(--page-color)',
    topicBg: 'var(--page-color)',
    cardPad: '22rpx',
  }),
};

const PACK_SURFACES = {
  default: packSurface({
    cardShadow: '0 8rpx 22rpx var(--border-color)',
    grain: '0.12',
  }),
  paper: packSurface({
    radius: '4px',
    cardBg: 'var(--page-color)',
    commentRadius: '4px',
    avatarWidth: '1px',
    grain: '0.08',
  }),
  mistpad: packSurface({
    radius: '16px',
    cardBg: 'var(--surface-subtle-color)',
    cardWidth: '0px',
    commentRadius: '16px',
    avatarWidth: '0px',
    grain: '0.1',
  }),
  inkline: packSurface({
    radius: '8px',
    cardWidth: '1px',
    cardBorder: 'var(--text-color)',
    commentRadius: '6px',
    commentBorder: 'var(--border-color)',
    grain: '0.09',
  }),
  claypad: packSurface({
    radius: '14px',
    cardBg: 'var(--page-color)',
    commentRadius: '14px',
    grain: '0.11',
  }),
  teanote: packSurface({
    radius: '12px',
    cardBg: 'var(--surface-subtle-color)',
    commentBg: 'var(--page-color)',
    grain: '0.13',
  }),
  fieldfresh: packSurface({
    radius: '20px',
    cardShadow: '0 12rpx 28rpx var(--border-color)',
    commentRadius: '20px',
    grain: '0.1',
  }),
  mistfill: packSurface({
    radius: '12px',
    cardWidth: '1px',
    commentBorder: 'var(--border-color)',
    grain: '0.12',
  }),
  giltedge: packSurface({
    radius: '8px',
    cardBorder: 'var(--gilt-color)',
    commentBorder: 'var(--gilt-color)',
    avatarColor: 'var(--gilt-color)',
    grain: '0.09',
  }),
  wuyu: packSurface({
    radius: '12px',
    cardBg: 'var(--page-color)',
    cardWidth: '0px',
    commentRadius: '14px',
    grain: '0.15',
  }),
  yue: packSurface({
    radius: '4px',
    cardWidth: '3px',
    cardBorder: 'var(--accent-color)',
    commentRadius: '4px',
    avatarWidth: '4px',
    grain: '0.11',
  }),
  minnan: packSurface({
    radius: '16px',
    cardBorder: 'var(--gilt-color)',
    cardShadow: '0 10rpx 24rpx var(--border-color)',
    commentRadius: '16px',
    grain: '0.1',
  }),
  wuyubridge: packSurface({
    radius: '14px',
    cardBg: 'var(--surface-subtle-color)',
    cardWidth: '0px',
    grain: '0.14',
  }),
  wuyurain: packSurface({
    radius: '10px',
    cardBg: 'var(--page-color)',
    cardShadow: '0 8rpx 20rpx var(--border-color)',
    grain: '0.18',
  }),
  yueporch: packSurface({
    radius: '6px',
    cardWidth: '2px',
    cardBorder: 'var(--accent-color)',
    commentRadius: '6px',
    grain: '0.1',
  }),
  yuewindow: packSurface({
    radius: '4px',
    cardBorder: 'var(--gilt-color)',
    cardWidth: '2px',
    avatarColor: 'var(--gilt-color)',
    grain: '0.09',
  }),
  minnanharbor: packSurface({
    radius: '18px',
    cardShadow: '0 10rpx 24rpx var(--border-color)',
    commentRadius: '18px',
    grain: '0.11',
  }),
  minnantemple: packSurface({
    radius: '2px',
    cardWidth: '2px',
    cardBorder: 'var(--gilt-color)',
    commentRadius: '2px',
    grain: '0.1',
  }),
  mimeograph: packSurface({
    radius: '2px',
    cardWidth: '1px',
    cardBorder: 'var(--text-color)',
    commentRadius: '2px',
    grain: '0.2',
  }),
  teaslip: packSurface({
    radius: '8px',
    cardBg: 'var(--page-color)',
    grain: '0.12',
  }),
  ledger: packSurface({
    radius: '0px',
    cardWidth: '2px',
    cardBorder: 'var(--text-color)',
    commentRadius: '0px',
    grain: '0.16',
  }),
  oldnews: packSurface({
    radius: '0px',
    cardWidth: '1px',
    commentRadius: '0px',
    grain: '0.19',
  }),
  kilnslip: packSurface({
    radius: '6px',
    cardBg: 'var(--page-color)',
    grain: '0.13',
  }),
  teapress: packSurface({
    radius: '4px',
    cardWidth: '2px',
    cardBorder: 'var(--accent-color)',
    grain: '0.15',
  }),
  rustwash: packSurface({
    radius: '10px',
    cardBg: 'var(--page-color)',
    cardWidth: '0px',
    grain: '0.17',
  }),
  ledgergold: packSurface({
    radius: '0px',
    cardBorder: 'var(--gilt-color)',
    cardWidth: '1px',
    grain: '0.14',
  }),
  mistclassic: packSurface({
    radius: '8px',
    cardWidth: '1px',
    grain: '0.12',
  }),
  nightferry: packSurface({
    radius: '6px',
    cardWidth: '1px',
    cardBorder: 'var(--text-color)',
    cardShadow: '0 0 24rpx var(--accent-subtle-color)',
    commentRadius: '6px',
    grain: '0.2',
  }),
  signalbooth: packSurface({
    radius: '2px',
    cardWidth: '2px',
    cardBorder: 'var(--accent-color)',
    grain: '0.16',
  }),
  gridlamp: packSurface({
    radius: '0px',
    cardWidth: '1px',
    commentRadius: '0px',
    grain: '0.18',
  }),
  nightgrid: packSurface({
    radius: '0px',
    cardWidth: '1px',
    cardBorder: 'var(--accent-color)',
    grain: '0.19',
  }),
  coldlamp: packSurface({
    radius: '8px',
    cardShadow: '0 0 20rpx var(--accent-subtle-color)',
    grain: '0.14',
  }),
  coppernet: packSurface({
    radius: '4px',
    cardWidth: '2px',
    grain: '0.15',
  }),
  teaterminal: packSurface({
    radius: '2px',
    cardWidth: '1px',
    cardBorder: 'var(--text-color)',
    grain: '0.17',
  }),
  goldwire: packSurface({
    radius: '6px',
    cardBorder: 'var(--gilt-color)',
    grain: '0.12',
  }),
  voidpulse: packSurface({
    radius: '12px',
    cardBg: 'var(--page-color)',
    cardShadow: '0 0 28rpx var(--accent-subtle-color)',
    grain: '0.22',
  }),
  qingshan: packSurface({
    radius: '10px',
    cardBg: 'var(--page-color)',
    cardWidth: '0px',
    grain: '0.11',
  }),
  sealpaper: packSurface({
    radius: '4px',
    cardWidth: '3px',
    cardBorder: 'var(--accent-color)',
    grain: '0.1',
  }),
  inkscroll: packSurface({
    radius: '8px',
    cardBg: 'var(--page-color)',
    grain: '0.16',
  }),
  pinewash: packSurface({
    radius: '12px',
    cardBg: 'var(--page-color)',
    cardWidth: '0px',
    grain: '0.13',
  }),
  inkseal: packSurface({
    radius: '2px',
    cardWidth: '4px',
    cardBorder: 'var(--accent-color)',
    commentRadius: '2px',
    grain: '0.12',
  }),
  claywash: packSurface({
    radius: '10px',
    cardBg: 'var(--surface-subtle-color)',
    grain: '0.11',
  }),
  giltfan: packSurface({
    radius: '8px',
    cardBorder: 'var(--gilt-color)',
    grain: '0.09',
  }),
  teascroll: packSurface({
    radius: '6px',
    cardBg: 'var(--page-color)',
    grain: '0.14',
  }),
  mistshan: packSurface({
    radius: '16px',
    cardWidth: '1px',
    grain: '0.12',
  }),
  teahouse: packSurface({
    radius: '12px',
    cardShadow: '0 10rpx 24rpx var(--border-color)',
    grain: '0.13',
  }),
  nightstall: packSurface({
    radius: '8px',
    cardWidth: '1px',
    cardBorder: 'var(--accent-color)',
    grain: '0.16',
  }),
  lanternalley: packSurface({
    radius: '10px',
    cardShadow: '0 0 18rpx var(--accent-subtle-color)',
    grain: '0.14',
  }),
  stalltea: packSurface({
    radius: '10px',
    cardBg: 'var(--accent-subtle-color)',
    grain: '0.12',
  }),
  alleyink: packSurface({
    radius: '6px',
    cardWidth: '2px',
    grain: '0.15',
  }),
  bricklamp: packSurface({
    radius: '4px',
    cardBg: 'var(--surface-subtle-color)',
    grain: '0.13',
  }),
  pinealley: packSurface({
    radius: '8px',
    cardShadow: '0 8rpx 20rpx var(--border-color)',
    grain: '0.12',
  }),
  miststall: packSurface({
    radius: '14px',
    cardWidth: '0px',
    grain: '0.14',
  }),
  goldstall: packSurface({
    radius: '8px',
    cardBorder: 'var(--gilt-color)',
    grain: '0.11',
  }),
  midautumn: packSurface({
    radius: '16px',
    cardBorder: 'var(--gilt-color)',
    grain: '0.1',
  }),
  duanwu: packSurface({
    radius: '8px',
    cardWidth: '2px',
    cardBorder: 'var(--accent-color)',
    grain: '0.12',
  }),
  lanternyear: packSurface({
    radius: '12px',
    cardShadow: '0 0 20rpx var(--accent-subtle-color)',
    grain: '0.13',
  }),
  springpine: packSurface({
    radius: '14px',
    cardBorder: 'var(--gilt-color)',
    grain: '0.1',
  }),
  teafest: packSurface({
    radius: '6px',
    cardWidth: '3px',
    cardBorder: 'var(--accent-color)',
    grain: '0.11',
  }),
  mistlantern: packSurface({
    radius: '18px',
    cardBg: 'var(--surface-subtle-color)',
    grain: '0.12',
  }),
  inkyear: packSurface({
    radius: '4px',
    cardWidth: '3px',
    grain: '0.14',
  }),
  clayfresh: packSurface({
    radius: '12px',
    cardShadow: '0 8rpx 18rpx var(--border-color)',
    grain: '0.11',
  }),
  osmanfill: packSurface({
    radius: '10px',
    cardBg: 'var(--accent-subtle-color)',
    grain: '0.09',
  }),
  pixelbooth: packSurface({
    radius: '0px',
    cardWidth: '2px',
    commentRadius: '0px',
    grain: '0.22',
  }),
  starglyph: packSurface({
    radius: '20px',
    cardShadow: '0 0 22rpx var(--accent-subtle-color)',
    commentRadius: '20px',
    grain: '0.12',
  }),
  comicstrip: packSurface({
    radius: '2px',
    cardWidth: '2px',
    cardBorder: 'var(--text-color)',
    commentRadius: '2px',
    grain: '0.1',
  }),
  pixelfill: packSurface({
    radius: '0px',
    cardWidth: '2px',
    grain: '0.2',
  }),
  starsoft: packSurface({
    radius: '18px',
    cardBg: 'var(--surface-subtle-color)',
    grain: '0.11',
  }),
  comicoutline: packSurface({
    radius: '4px',
    cardWidth: '2px',
    cardBorder: 'var(--text-color)',
    grain: '0.1',
  }),
  inkpixel: packSurface({
    radius: '0px',
    cardWidth: '1px',
    grain: '0.18',
  }),
  teacomic: packSurface({
    radius: '6px',
    cardBg: 'var(--page-color)',
    grain: '0.12',
  }),
  pineglyph: packSurface({
    radius: '8px',
    cardBorder: 'var(--gilt-color)',
    grain: '0.11',
  }),
  inknight: packSurface({
    radius: '8px',
    cardWidth: '1px',
    cardBorder: 'var(--text-color)',
    grain: '0.2',
  }),
  voidgrid: packSurface({
    radius: '0px',
    cardWidth: '1px',
    grain: '0.21',
  }),
  coalnook: packSurface({
    radius: '12px',
    cardBg: 'var(--surface-subtle-color)',
    grain: '0.17',
  }),
  inkfill: packSurface({
    radius: '8px',
    cardWidth: '1px',
    grain: '0.19',
  }),
  teacontrast: packSurface({
    radius: '6px',
    cardWidth: '2px',
    cardBorder: 'var(--text-color)',
    grain: '0.16',
  }),
  claydark: packSurface({
    radius: '4px',
    cardBg: 'var(--page-color)',
    grain: '0.18',
  }),
  osmandark: packSurface({
    radius: '10px',
    cardBorder: 'var(--gilt-color)',
    grain: '0.15',
  }),
  pinevoid: packSurface({
    radius: '2px',
    cardWidth: '2px',
    grain: '0.2',
  }),
  mistfog: packSurface({
    radius: '16px',
    cardBg: 'var(--page-color)',
    cardWidth: '0px',
    grain: '0.14',
  }),
  templefair: packSurface({
    radius: '12px',
    cardWidth: '2px',
    grain: '0.15',
  }),
  paperhorse: packSurface({
    radius: '8px',
    cardBg: 'var(--page-color)',
    grain: '0.17',
  }),
  drumlane: packSurface({
    radius: '14px',
    cardShadow: '0 12rpx 24rpx var(--border-color)',
    grain: '0.13',
  }),
  riverlantern: packSurface({
    radius: '16px',
    cardWidth: '0px',
    grain: '0.16',
  }),
  wheatrite: packSurface({
    cardBorder: 'var(--gilt-color)',
    avatarColor: 'var(--gilt-color)',
    grain: '0.11',
  }),
  kilnrite: packSurface({
    radius: '6px',
    cardBg: 'var(--page-color)',
    grain: '0.18',
  }),
  boatbless: packSurface({
    radius: '4px',
    cardBorder: 'var(--text-color)',
    grain: '0.14',
  }),
  beamred: packSurface({
    cardWidth: '3px',
    cardBorder: 'var(--accent-color)',
    grain: '0.12',
  }),
  nightwatch: packSurface({
    cardShadow: '0 0 24rpx var(--accent-subtle-color)',
    grain: '0.19',
  }),
  springthaw: packSurface({
    radius: '20px',
    grain: '0.11',
  }),
  summerlotus: packSurface({
    radius: '18px',
    cardBg: 'var(--surface-subtle-color)',
    grain: '0.12',
  }),
  autumngrain: packSurface({
    radius: '10px',
    cardBorder: 'var(--gilt-color)',
    grain: '0.13',
  }),
  winterhearth: packSurface({
    radius: '14px',
    cardBg: 'var(--page-color)',
    grain: '0.17',
  }),
  rainstart: packSurface({
    cardWidth: '0px',
    grain: '0.18',
  }),
  grainrain: packSurface({
    radius: '16px',
    cardShadow: '0 10rpx 22rpx var(--border-color)',
    grain: '0.1',
  }),
  heatwave: packSurface({
    cardWidth: '2px',
    cardBorder: 'var(--accent-color)',
    grain: '0.14',
  }),
  frostfall: packSurface({
    radius: '22px',
    cardWidth: '0px',
    grain: '0.15',
  }),
  snownook: packSurface({
    radius: '8px',
    cardWidth: '1px',
    cardBorder: 'var(--text-color)',
    grain: '0.16',
  }),
  'member-pine': packSurface({
    radius: '10px',
    cardWidth: '2px',
    cardBorder: 'var(--accent-color)',
    grain: '0.1',
  }),
  'event-lantern': packSurface({
    radius: '12px',
    cardShadow: '0 0 20rpx var(--accent-subtle-color)',
    grain: '0.13',
  }),
  'event-spring': packSurface({
    radius: '14px',
    cardBorder: 'var(--gilt-color)',
    grain: '0.1',
  }),
  'creator-tile': packSurface({
    radius: '6px',
    cardWidth: '2px',
    grain: '0.11',
  }),
};

const PACK_GRAIN_KIND = {
  paper: 'paper',
  mistpad: 'mist',
  inkline: 'ink',
  claypad: 'fiber',
  teanote: 'paper',
  fieldfresh: 'mist',
  mistfill: 'mist',
  giltedge: 'seal',
  wuyu: 'mist',
  wuyubridge: 'mist',
  wuyurain: 'rain',
  yue: 'seal',
  yueporch: 'fiber',
  yuewindow: 'seal',
  minnan: 'seal',
  minnanharbor: 'mist',
  minnantemple: 'seal',
  mimeograph: 'paper',
  teaslip: 'paper',
  ledger: 'paper',
  oldnews: 'paper',
  kilnslip: 'fiber',
  teapress: 'paper',
  rustwash: 'fiber',
  ledgergold: 'seal',
  mistclassic: 'mist',
  nightferry: 'grid',
  signalbooth: 'grid',
  gridlamp: 'grid',
  nightgrid: 'grid',
  coldlamp: 'glow',
  coppernet: 'grid',
  teaterminal: 'grid',
  goldwire: 'seal',
  voidpulse: 'glow',
  qingshan: 'mist',
  sealpaper: 'seal',
  inkscroll: 'ink',
  pinewash: 'mist',
  inkseal: 'seal',
  claywash: 'fiber',
  giltfan: 'seal',
  teascroll: 'paper',
  mistshan: 'mist',
  teahouse: 'fiber',
  nightstall: 'glow',
  lanternalley: 'glow',
  stalltea: 'fiber',
  alleyink: 'ink',
  bricklamp: 'glow',
  pinealley: 'fiber',
  miststall: 'mist',
  goldstall: 'seal',
  midautumn: 'glow',
  duanwu: 'fiber',
  lanternyear: 'glow',
  springpine: 'seal',
  teafest: 'paper',
  mistlantern: 'mist',
  inkyear: 'ink',
  clayfresh: 'mist',
  osmanfill: 'seal',
  pixelbooth: 'grid',
  starglyph: 'glow',
  comicstrip: 'paper',
  pixelfill: 'grid',
  starsoft: 'mist',
  comicoutline: 'paper',
  inkpixel: 'grid',
  teacomic: 'paper',
  pineglyph: 'seal',
  inknight: 'ink',
  voidgrid: 'grid',
  coalnook: 'ink',
  inkfill: 'ink',
  teacontrast: 'ink',
  claydark: 'ink',
  osmandark: 'seal',
  pinevoid: 'grid',
  mistfog: 'mist',
  templefair: 'paper',
  paperhorse: 'paper',
  drumlane: 'fiber',
  riverlantern: 'glow',
  wheatrite: 'seal',
  kilnrite: 'fiber',
  boatbless: 'paper',
  beamred: 'fiber',
  nightwatch: 'glow',
  springthaw: 'mist',
  summerlotus: 'mist',
  autumngrain: 'seal',
  winterhearth: 'fiber',
  rainstart: 'rain',
  grainrain: 'rain',
  heatwave: 'glow',
  frostfall: 'mist',
  snownook: 'paper',
  'member-pine': 'fiber',
  'event-lantern': 'glow',
  'event-spring': 'seal',
  'creator-tile': 'paper',
};

const PACK_FINISH = {
  paper: packSurface({
    letter: '0.06em',
    commentWidth: '1px',
    commentBorder: 'var(--border-color)',
    inputRadius: '4px',
    topicRadius: '4px',
    navBg: 'var(--page-color)',
    buttonRadius: '4px',
    cardPad: '18rpx',
  }),
  mistpad: packSurface({
    letter: '0.02em',
    inputWidth: '0px',
    inputBg: 'var(--surface-subtle-color)',
    topicWidth: '0px',
    navBg: 'var(--surface-subtle-color)',
    buttonRadius: '16px',
  }),
  inkline: packSurface({
    letter: '0.06em',
    commentWidth: '1px',
    inputBorder: 'var(--text-color)',
    topicBorder: 'var(--text-color)',
    navBorder: 'var(--text-color)',
    buttonRadius: '8px',
  }),
  giltedge: packSurface({
    letter: '0.12em',
    commentWidth: '1px',
    inputBorder: 'var(--gilt-color)',
    topicBorder: 'var(--gilt-color)',
    navBorder: 'var(--gilt-color)',
    buttonRadius: '8px',
  }),
  yue: packSurface({
    letter: '0.08em',
    commentWidth: '2px',
    commentBorder: 'var(--accent-color)',
    inputWidth: '2px',
    inputBorder: 'var(--accent-color)',
    buttonRadius: '4px',
  }),
  wuyurain: packSurface({
    letter: '0.04em',
    inputBg: 'var(--page-color)',
    topicBg: 'var(--page-color)',
    navBg: 'var(--page-color)',
  }),
  nightferry: packSurface({
    letter: '0.12em',
    commentWidth: '1px',
    inputRadius: '0px',
    topicRadius: '0px',
    buttonRadius: '0px',
    navBg: 'var(--page-color)',
  }),
  ledger: packSurface({
    letter: '0.1em',
    commentWidth: '2px',
    inputRadius: '0px',
    topicRadius: '0px',
    buttonRadius: '0px',
    cardPad: '16rpx',
  }),
  pixelbooth: packSurface({
    letter: '0.12em',
    commentWidth: '2px',
    inputRadius: '0px',
    topicRadius: '0px',
    buttonRadius: '0px',
    cardPad: '16rpx',
  }),
  midautumn: packSurface({
    letter: '0.12em',
    commentWidth: '1px',
    commentBorder: 'var(--gilt-color)',
    inputBorder: 'var(--gilt-color)',
    topicBorder: 'var(--gilt-color)',
    buttonRadius: '16px',
  }),
  springthaw: packSurface({
    letter: '0.03em',
    inputWidth: '0px',
    topicWidth: '0px',
    buttonRadius: '20px',
    cardPad: '30rpx',
  }),
};

Object.entries(PACK_GRAIN_KIND).forEach(([id, kind]) => {
  PACK_SURFACES[id] = {
    ...packSurface({ grainKind: kind }),
    ...(PACK_SURFACES[id] || {}),
  };
});

Object.entries(PACK_FINISH).forEach(([id, finish]) => {
  PACK_SURFACES[id] = { ...(PACK_SURFACES[id] || {}), ...finish };
});

GLOBAL_THEMES.forEach((item, index) => {
  const family = STYLE_FAMILIES[item.category] || STYLE_FAMILIES.simple;
  const extra = PACK_SURFACES[item.id] || {};
  GLOBAL_THEMES[index] = {
    ...item,
    style_json: cloneSkinStyle({ ...(item.style_json || {}), ...family, ...extra }),
  };
});

const DRESS_GROUP_DEFS = [
  {
    id: 'navbar',
    name: '导航栏底色与图标',
    hint: '自定义导航栏底色、图标颜色。小程序原生导航栏无法改。',
    feature: '修改顶部导航栏底色和图标颜色。',
    preview: 'navbar',
    category: 'nav',
    mpBlocked: true,
    defaultName: '系统默认顶栏',
    defaultHint: '跟随当前全局主题的顶栏。',
    upcoming: [
      ['navbar-glyph', '方言符号顶栏', '顶栏加一枚方言小符号。'],
      ['navbar-pattern', '地域纹样顶栏', '顶栏衬一层地域纹样。'],
    ],
  },
  {
    id: 'navbar-font',
    name: '导航栏标题字体',
    hint: '自定义顶栏标题字体。小程序原生导航栏无法改。',
    feature: '修改顶部导航栏标题字体样式。',
    preview: 'navbar',
    category: 'nav',
    mpBlocked: true,
    defaultName: '系统默认标题字',
    defaultHint: '跟随当前全局主题的标题字。',
    upcoming: [
      ['navbar-font-kai', '乡刊楷体', '标题换成乡刊楷体。'],
    ],
  },
  {
    id: 'tabbar',
    name: '底部Tab栏样式',
    hint: '自定义 Tab 图标、选中色和底栏背景。小程序原生 tabBar 无法改。',
    feature: '修改底部导航栏图标、选中态和背景。',
    preview: 'tabbar',
    category: 'tabbar',
    mpBlocked: true,
    defaultName: '系统默认底栏',
    defaultHint: '跟随当前全局主题的底栏。',
    upcoming: [
      ['tabbar-pill', '胶囊底栏', '底栏收成一条胶囊。'],
      ['tabbar-dock', '码头灯标', '选中项像码头灯标。'],
    ],
  },
  {
    id: 'tabbar-ornament',
    name: 'Tab栏小装饰',
    hint: '底栏选中态小点缀。小程序原生 tabBar 无法改。',
    feature: '给底部 Tab 加上小装饰点缀。',
    preview: 'tabbar',
    category: 'tabbar',
    mpBlocked: true,
    defaultName: '系统默认点缀',
    defaultHint: '底栏不加额外点缀。',
    upcoming: [
      ['tabbar-dot', '方言圆点', '选中项旁一枚方言小圆点。'],
    ],
  },
  {
    id: 'actions',
    name: '交互按钮样式',
    hint: '点赞、评论、装一罐、转发、收藏的形状、配色和图标。',
    feature: '修改点赞、评论、装一罐、转发、收藏按钮。',
    preview: 'actions',
    category: 'buttons',
    mpBlocked: false,
    defaultName: '系统默认按钮',
    defaultHint: '点赞、评论、装一罐用当前主题色。',
    upcoming: [
      ['actions-seal', '朱印按键', '操作键收成朱印方块。'],
      ['actions-wave', '水纹轻按', '按下去有一圈水纹。'],
    ],
  },
  {
    id: 'actions-dialect',
    name: '方言趣味按钮',
    hint: '方言趣味图标、地域纹样按钮。',
    feature: '把操作键换成方言趣味图标或地域纹样。',
    preview: 'actions',
    category: 'buttons',
    mpBlocked: false,
    defaultName: '系统默认趣味键',
    defaultHint: '操作键不加方言图标。',
    upcoming: [
      ['actions-pepper', '川渝辣标', '点赞键换成一枚小辣椒。'],
      ['actions-tile', '青瓦按键', '操作键带青瓦纹。'],
    ],
  },
  {
    id: 'cards',
    name: '录音卡片背景',
    hint: '录音卡片的背景纹理、圆角和阴影。',
    feature: '修改录音卡片背景、圆角和阴影。',
    preview: 'cards',
    category: 'cards',
    mpBlocked: false,
    defaultName: '系统默认卡片',
    defaultHint: '录音卡片跟随全局圆角和底色。',
    upcoming: [
      ['cards-paper', '宣纸折边', '卡片带宣纸折边。'],
      ['cards-brick', '红砖压纹', '卡片底带浅砖纹。'],
      ['cards-round', '软圆录音卡', '卡片收成更圆的软边。'],
      ['cards-sharp', '方折录音卡', '卡片收成直角折边。'],
      ['cards-wide', '宽影录音卡', '卡片带更宽的浅阴影。'],
      ['cards-thin', '细边录音卡', '卡片只留一圈细边。'],
      ['cards-accent', '浅彩录音卡', '卡片底换成浅强调色。'],
      ['cards-soft', '雾底录音卡', '卡片底换成更软的浅底。'],
      ['cards-ridge', '压线录音卡', '卡片外加一圈加厚压线。'],
      ['cards-folk', '社火折边', '卡片带社火折边和暖边。'],
      ['cards-season', '时令浅卡', '卡片换成时令浅底软边。'],
    ],
  },
  {
    id: 'cards-tag',
    name: '方言标签样式',
    hint: '录音卡片里的方言标签、家乡标签样式。',
    feature: '修改录音卡片上的方言标签和家乡标签。',
    preview: 'cards',
    category: 'cards',
    mpBlocked: false,
    defaultName: '系统默认标签',
    defaultHint: '标签跟随当前主题色。',
    upcoming: [
      ['cards-tag-chip', '乡音胶囊', '方言标签收成一粒胶囊。'],
    ],
  },
  {
    id: 'cards-badge',
    name: '卡片角标装饰',
    hint: '方言达人、本地土著等角标装饰。',
    feature: '给录音卡片加上方言达人或本地土著角标。',
    preview: 'cards',
    category: 'cards',
    mpBlocked: false,
    defaultName: '系统默认角标',
    defaultHint: '卡片不加额外角标。',
    upcoming: [
      ['cards-badge-local', '本地土著章', '卡片角上一枚本地土著章。'],
      ['cards-badge-voice', '方言达人章', '卡片角上一枚方言达人章。'],
    ],
  },
  {
    id: 'profile',
    name: '个人主页背景',
    hint: '个人中心底图和纹理，不改录音播放画面。',
    feature: '修改个人中心页面背景和纹理。',
    preview: 'profile',
    category: 'profile',
    mpBlocked: false,
    defaultName: '系统默认主页底',
    defaultHint: '个人中心用当前页面底色。',
    upcoming: [
      ['profile-mist', '江雾纹理', '主页衬一层淡雾。'],
      ['profile-night', '夜航网格', '主页底换成夜航网格。'],
      ['profile-grain', '田野浅纹', '主页底带一层浅田野纹。'],
      ['profile-wash', '水墨浅底', '主页底换成一层水墨浅色。'],
      ['profile-line', '栏线主页', '主页底带一圈浅栏线。'],
      ['profile-deep', '深雾主页', '主页底换成更深一层淡雾。'],
      ['profile-glow', '浅彩主页', '主页底换成浅强调色。'],
      ['profile-fog', '薄雾主页', '主页底换成更淡的页面底。'],
      ['profile-tile', '青瓦主页', '主页底带一层青瓦浅纹。'],
      ['profile-folk', '庙会浅底', '主页底换成庙会浅暖色。'],
      ['profile-season', '四时浅底', '主页底换成四时浅底。'],
    ],
  },
  {
    id: 'profile-card',
    name: '资料卡片样式',
    hint: '头像区域、方言标签展示卡片。',
    feature: '修改个人主页资料卡片和方言标签展示。',
    preview: 'profile',
    category: 'profile',
    mpBlocked: false,
    defaultName: '系统默认资料卡',
    defaultHint: '资料卡跟随当前主题。',
    upcoming: [
      ['profile-card-lane', '巷口资料卡', '资料卡带巷口栏线。'],
    ],
  },
  {
    id: 'profile-grid',
    name: '主页录音网格',
    hint: '个人主页录音网格卡片样式。',
    feature: '修改个人主页录音网格的卡片样式。',
    preview: 'cards',
    category: 'profile',
    mpBlocked: false,
    defaultName: '系统默认网格',
    defaultHint: '网格卡片跟随全局圆角。',
    upcoming: [
      ['profile-grid-tile', '青瓦网格', '网格卡片带青瓦折边。'],
    ],
  },
  {
    id: 'profile-voice',
    name: '语音签名播放器',
    hint: '方言语音签名的播放按钮装扮。',
    feature: '修改方言语音签名播放按钮的外观。',
    preview: 'actions',
    category: 'profile',
    mpBlocked: false,
    defaultName: '系统默认播放键',
    defaultHint: '语音签名播放键跟随主题色。',
    upcoming: [
      ['profile-voice-wave', '水纹播放键', '播放键带一圈水纹。'],
    ],
  },
  {
    id: 'avatar',
    name: '头像框&装饰挂件',
    hint: '地域纹样、方言文字头像框。',
    feature: '修改头像边框。',
    preview: 'avatar',
    category: 'avatar',
    mpBlocked: false,
    defaultName: '系统默认头像',
    defaultHint: '圆形头像，无额外边框。',
    upcoming: [
      ['avatar-frame', '青瓦圆框', '头像外加一圈青瓦框。'],
      ['avatar-glyph', '方言文字框', '头像框带一圈方言字。'],
      ['avatar-ink', '青墨细框', '头像外加一圈青墨细线。'],
      ['avatar-thin', '细线圆框', '头像外加一圈极细主题色。'],
      ['avatar-soft', '浅彩宽框', '头像外加一圈更宽的浅彩框。'],
      ['avatar-ridge', '压线圆框', '头像外加一圈中等压线。'],
      ['avatar-mist', '雾边圆框', '头像外加一圈浅雾边。'],
      ['avatar-seal', '朱印圆框', '头像外加一圈朱印色细框。'],
      ['avatar-wide', '宽墨圆框', '头像外加一圈更宽的墨框。'],
      ['avatar-folk', '香火圆框', '头像外加一圈香火暖边。'],
      ['avatar-season', '节气细框', '头像外加一圈节气细边。'],
    ],
  },
  {
    id: 'avatar-float',
    name: '主页悬浮挂件',
    hint: '方言小符号、家乡小图标，停在页面角落。',
    feature: '在个人主页角落放一枚方言或家乡小挂件。',
    preview: 'avatar',
    category: 'avatar',
    mpBlocked: false,
    defaultName: '系统默认挂件',
    defaultHint: '主页角落不加挂件。',
    upcoming: [
      ['avatar-charm', '乡音挂件', '角落一枚乡音小挂件。'],
    ],
  },
  {
    id: 'avatar-comment',
    name: '评论区头像装饰',
    hint: '评论区头像旁的小装饰。',
    feature: '给评论区头像加上小装饰。',
    preview: 'avatar',
    category: 'avatar',
    mpBlocked: false,
    defaultName: '系统默认评区头像',
    defaultHint: '评论区头像不加装饰。',
    upcoming: [
      ['avatar-comment-dot', '乡音小点', '头像旁一枚乡音小点。'],
    ],
  },
  {
    id: 'comment-bubble',
    name: '评论气泡样式',
    hint: '评论气泡、评论卡片背景。',
    feature: '修改评论气泡和评论卡片背景。',
    preview: 'comment',
    category: 'comment',
    mpBlocked: false,
    defaultName: '系统默认评论气泡',
    defaultHint: '评论气泡跟随当前主题。',
    upcoming: [
      ['comment-paper', '宣纸气泡', '评论气泡像一小张宣纸。'],
      ['comment-round', '软圆气泡', '评论气泡收成更圆的软边。'],
      ['comment-ink', '青墨方泡', '评论气泡换成青墨细方框。'],
      ['comment-pill', '胶囊气泡', '评论气泡收成更长的胶囊。'],
      ['comment-soft', '浅底气泡', '评论气泡换成更软的浅底。'],
      ['comment-line', '细线气泡', '评论气泡只留一圈细线。'],
      ['comment-accent', '浅彩气泡', '评论气泡底换成浅强调色。'],
      ['comment-square', '小方气泡', '评论气泡收成小圆角方框。'],
      ['comment-fog', '薄雾气泡', '评论气泡底换成一层薄雾。'],
      ['comment-folk', '社火气泡', '评论气泡带社火暖边。'],
      ['comment-season', '时令气泡', '评论气泡换成时令浅底。'],
    ],
  },
  {
    id: 'comment-tag',
    name: '评论区方言标签',
    hint: '评论区 @ 和方言标签气泡。',
    feature: '修改评论区 @ 与方言标签气泡样式。',
    preview: 'comment',
    category: 'comment',
    mpBlocked: false,
    defaultName: '系统默认评区标签',
    defaultHint: '评论区标签跟随主题色。',
    upcoming: [
      ['comment-tag-chip', '方言标签泡', '方言标签收成一粒小气泡。'],
    ],
  },
  {
    id: 'topic-card',
    name: '方言话题卡片',
    hint: '方言话题卡片、话题标签样式。',
    feature: '修改方言话题卡片和话题标签。',
    preview: 'topic',
    category: 'topic',
    mpBlocked: false,
    defaultName: '系统默认话题卡',
    defaultHint: '话题卡片跟随当前主题。',
    upcoming: [
      ['topic-lane', '巷口话题卡', '话题卡带巷口栏线。'],
    ],
  },
  {
    id: 'topic-challenge',
    name: '方言挑战赛卡片',
    hint: '方言挑战赛卡片装饰。',
    feature: '给方言挑战赛卡片加上装饰。',
    preview: 'topic',
    category: 'topic',
    mpBlocked: false,
    defaultName: '系统默认挑战卡',
    defaultHint: '挑战赛卡片不加额外装饰。',
    upcoming: [
      ['topic-banner', '乡音挑战旗', '挑战卡顶上一面小旗。'],
    ],
  },
  {
    id: 'dialog-sheet',
    name: '弹窗边框背景',
    hint: '弹窗边框、弹窗背景。',
    feature: '修改弹窗边框和背景。',
    preview: 'chrome',
    category: 'chrome',
    mpBlocked: false,
    defaultName: '系统默认弹窗',
    defaultHint: '弹窗跟随当前主题。',
    upcoming: [
      ['dialog-paper', '宣纸弹窗', '弹窗底换成宣纸纹。'],
    ],
  },
  {
    id: 'toast-style',
    name: 'Toast提示框',
    hint: '轻提示框的底色和边框。',
    feature: '修改 Toast 提示框样式。',
    preview: 'chrome',
    category: 'chrome',
    mpBlocked: false,
    defaultName: '系统默认提示',
    defaultHint: '轻提示跟随当前主题。',
    upcoming: [
      ['toast-seal', '朱印提示', '提示框收成一枚小朱印。'],
    ],
  },
  {
    id: 'input-compose',
    name: '装一罐输入框',
    hint: '装一罐输入框，可带方言小装饰。',
    feature: '修改装一罐输入框样式。',
    preview: 'chrome',
    category: 'chrome',
    mpBlocked: false,
    defaultName: '系统默认输入框',
    defaultHint: '装一罐输入框跟随主题。',
    upcoming: [
      ['input-compose-lane', '乡刊输入栏', '输入框带乡刊栏线。'],
    ],
  },
  {
    id: 'input-comment',
    name: '评论输入框',
    hint: '评论输入框，可带方言小装饰。',
    feature: '修改评论输入框样式。',
    preview: 'chrome',
    category: 'chrome',
    mpBlocked: false,
    defaultName: '系统默认评论框',
    defaultHint: '评论输入框跟随主题。',
    upcoming: [
      ['input-comment-chip', '方言边饰框', '评论框角上一枚方言小饰。'],
    ],
  },
];

export function accessLabel(access, extra = {}) {
  if (access === ACCESS_EVENT && extra.eventStatus === 'ended') return '已绝版';
  if (access === ACCESS_MEMBER) return '会员专属';
  if (access === ACCESS_EVENT) return '活动限定';
  if (access === ACCESS_CREATOR) return '方言创作者专属';
  return '免费';
}

export function accessTagClass(item) {
  if (item?.removed || item?.retired) return 'tag-ended';
  if (!item?.preview) return 'tag-soon';
  if (!item?.available) return 'tag-soon';
  if (item.access === ACCESS_EVENT && item.eventStatus === 'ended') return 'tag-ended';
  if (item.access === ACCESS_MEMBER) return 'tag-member';
  if (item.access === ACCESS_EVENT) return 'tag-event';
  if (item.access === ACCESS_CREATOR) return 'tag-creator';
  return 'tag-free';
}

function makeDressItem(
  id,
  group,
  name,
  description,
  available,
  preview,
  access = ACCESS_FREE,
  extra = {},
) {
  return {
    id,
    group,
    name,
    description,
    available,
    access,
    tag: available ? accessLabel(access, extra) : '敬请期待',
    preview,
    ...extra,
  };
}

export const LOCAL_DRESS_GROUPS = DRESS_GROUP_DEFS.map((def) => ({
  id: def.id,
  name: def.name,
  hint: def.hint,
  feature: def.feature,
  preview: def.preview,
  category: def.category,
  mpBlocked: def.mpBlocked,
  component_type: componentTypeOf(def.id),
}));

export const P1_DRESS_GROUP_IDS = ['cards', 'profile', 'avatar', 'comment-bubble'];

const DRESS_STYLE_BY_ID = {
  'cards-paper': '简约',
  'cards-brick': '地域方言风',
  'cards-round': '二次元',
  'cards-sharp': '赛博',
  'cards-wide': '市井烟火',
  'cards-thin': '极简暗色',
  'cards-accent': '节日限定',
  'cards-soft': '复古',
  'cards-ridge': '国风',
  'cards-folk': '节日风俗',
  'cards-season': '季节时令',
  'profile-mist': '地域方言风',
  'profile-night': '赛博',
  'profile-grain': '市井烟火',
  'profile-wash': '复古',
  'profile-line': '简约',
  'profile-deep': '极简暗色',
  'profile-glow': '节日限定',
  'profile-fog': '二次元',
  'profile-tile': '国风',
  'profile-folk': '节日风俗',
  'profile-season': '季节时令',
  'avatar-frame': '国风',
  'avatar-glyph': '二次元',
  'avatar-ink': '复古',
  'avatar-thin': '简约',
  'avatar-soft': '地域方言风',
  'avatar-ridge': '市井烟火',
  'avatar-mist': '极简暗色',
  'avatar-seal': '节日限定',
  'avatar-wide': '赛博',
  'avatar-folk': '节日风俗',
  'avatar-season': '季节时令',
  'comment-paper': '简约',
  'comment-round': '二次元',
  'comment-ink': '复古',
  'comment-pill': '市井烟火',
  'comment-soft': '地域方言风',
  'comment-line': '赛博',
  'comment-accent': '节日限定',
  'comment-square': '国风',
  'comment-fog': '极简暗色',
  'comment-folk': '节日风俗',
  'comment-season': '季节时令',
};

const BUILTIN_DRESS_STYLES = {
  'cards-plain': { borderRadius: '12px' },
  'profile-plain': { background: 'var(--page-color)' },
  'avatar-plain': { borderWidth: '0px' },
  'comment-bubble-plain': { borderRadius: '12px' },
  'navbar-plain': { color: 'var(--text-color)' },
  'tabbar-plain': {
    tabBackground: 'var(--surface-color)',
    tabColor: 'var(--muted-color)',
    tabAccent: 'var(--accent-color)',
    tabOnAccent: 'var(--on-accent-color)',
    tabEmphasis: 'var(--text-color)',
    tabBorder: 'var(--border-color)',
  },
  'cards-member': { borderColor: 'var(--accent-color)' },
  'avatar-creator': { borderWidth: '4px' },
  'cards-paper': {
    borderRadius: '4px',
    borderColor: 'var(--border-color)',
    shadow: '0 8rpx 20rpx var(--border-color)',
    background: 'var(--surface-color)',
  },
  'profile-mist': {
    background: 'var(--surface-subtle-color)',
  },
  'avatar-frame': {
    borderWidth: '4px',
    borderColor: 'var(--accent-color)',
  },
  'comment-paper': {
    borderRadius: '4px',
    background: 'var(--surface-color)',
    borderColor: 'var(--border-color)',
  },
  'cards-brick': {
    borderRadius: '2px',
    borderWidth: '2px',
    borderColor: 'var(--accent-color)',
    background: 'var(--surface-subtle-color)',
  },
  'cards-round': {
    borderRadius: '24px',
    shadow: '0 12rpx 24rpx var(--border-color)',
    background: 'var(--surface-color)',
  },
  'profile-night': {
    background: 'var(--surface-color)',
    color: 'var(--text-color)',
  },
  'profile-grain': {
    background: 'var(--accent-subtle-color)',
  },
  'avatar-glyph': {
    borderWidth: '2px',
    borderColor: 'var(--accent-color)',
    color: 'var(--accent-color)',
  },
  'avatar-ink': {
    borderWidth: '6px',
    borderColor: 'var(--text-color)',
  },
  'comment-round': {
    borderRadius: '24px',
    background: 'var(--surface-subtle-color)',
  },
  'comment-ink': {
    borderRadius: '0px',
    borderColor: 'var(--text-color)',
    background: 'var(--surface-color)',
  },
  'cards-sharp': {
    borderRadius: '0px',
    borderWidth: '1px',
    borderColor: 'var(--text-color)',
    background: 'var(--surface-color)',
  },
  'cards-wide': {
    borderRadius: '16px',
    shadow: '0 16rpx 32rpx var(--border-color)',
    background: 'var(--surface-color)',
  },
  'cards-thin': {
    borderRadius: '8px',
    borderWidth: '1px',
    borderColor: 'var(--border-color)',
    background: 'var(--surface-color)',
  },
  'cards-accent': {
    borderRadius: '12px',
    background: 'var(--accent-subtle-color)',
  },
  'cards-soft': {
    borderRadius: '20px',
    background: 'var(--surface-subtle-color)',
  },
  'cards-ridge': {
    borderRadius: '6px',
    borderWidth: '3px',
    borderColor: 'var(--accent-color)',
    background: 'var(--surface-color)',
  },
  'profile-wash': {
    background: 'var(--page-color)',
    color: 'var(--text-color)',
  },
  'profile-line': {
    background: 'var(--surface-color)',
    borderColor: 'var(--border-color)',
  },
  'profile-deep': {
    background: 'var(--surface-subtle-color)',
    color: 'var(--text-color)',
  },
  'profile-glow': {
    background: 'var(--accent-subtle-color)',
    color: 'var(--accent-color)',
  },
  'profile-fog': {
    background: 'var(--page-color)',
    color: 'var(--muted-color)',
  },
  'profile-tile': {
    background: 'var(--surface-color)',
    borderColor: 'var(--accent-color)',
  },
  'avatar-thin': {
    borderWidth: '1px',
    borderColor: 'var(--accent-color)',
  },
  'avatar-soft': {
    borderWidth: '8px',
    borderColor: 'var(--accent-subtle-color)',
  },
  'avatar-ridge': {
    borderWidth: '3px',
    borderColor: 'var(--accent-color)',
  },
  'avatar-mist': {
    borderWidth: '2px',
    borderColor: 'var(--border-color)',
  },
  'avatar-seal': {
    borderWidth: '4px',
    borderColor: 'var(--accent-color)',
    color: 'var(--text-color)',
  },
  'avatar-wide': {
    borderWidth: '10px',
    borderColor: 'var(--text-color)',
  },
  'comment-pill': {
    borderRadius: '32px',
    background: 'var(--accent-subtle-color)',
  },
  'comment-soft': {
    borderRadius: '16px',
    background: 'var(--surface-color)',
  },
  'comment-line': {
    borderRadius: '8px',
    borderColor: 'var(--border-color)',
    background: 'transparent',
  },
  'comment-accent': {
    borderRadius: '12px',
    background: 'var(--accent-subtle-color)',
    borderColor: 'var(--accent-color)',
  },
  'comment-square': {
    borderRadius: '2px',
    background: 'var(--surface-subtle-color)',
  },
  'comment-fog': {
    borderRadius: '20px',
    background: 'var(--page-color)',
  },
  'cards-folk': {
    borderRadius: '10px',
    borderWidth: '2px',
    borderColor: 'var(--accent-color)',
    background: 'var(--accent-subtle-color)',
  },
  'cards-season': {
    borderRadius: '18px',
    borderWidth: '0px',
    background: 'var(--page-color)',
  },
  'profile-folk': {
    background: 'var(--accent-subtle-color)',
    color: 'var(--gilt-color)',
  },
  'profile-season': {
    background: 'var(--page-color)',
    color: 'var(--text-secondary-color)',
  },
  'avatar-folk': {
    borderWidth: '5px',
    borderColor: 'var(--gilt-color)',
  },
  'avatar-season': {
    borderWidth: '3px',
    borderColor: 'var(--border-color)',
  },
  'comment-folk': {
    borderRadius: '10px',
    background: 'var(--accent-subtle-color)',
    borderColor: 'var(--accent-color)',
  },
  'comment-season': {
    borderRadius: '22px',
    background: 'var(--surface-subtle-color)',
  },
};

const FREE_LIVE_DRESS_IDS = new Set([
  'cards-paper',
  'cards-brick',
  'cards-round',
  'cards-sharp',
  'cards-wide',
  'cards-thin',
  'cards-accent',
  'cards-soft',
  'cards-ridge',
  'profile-mist',
  'profile-night',
  'profile-grain',
  'profile-wash',
  'profile-line',
  'profile-deep',
  'profile-glow',
  'profile-fog',
  'profile-tile',
  'avatar-frame',
  'avatar-glyph',
  'avatar-ink',
  'avatar-thin',
  'avatar-soft',
  'avatar-ridge',
  'avatar-mist',
  'avatar-seal',
  'avatar-wide',
  'comment-paper',
  'comment-round',
  'comment-ink',
  'comment-pill',
  'comment-soft',
  'comment-line',
  'comment-accent',
  'comment-square',
  'comment-fog',
  'cards-folk',
  'cards-season',
  'profile-folk',
  'profile-season',
  'avatar-folk',
  'avatar-season',
  'comment-folk',
  'comment-season',
]);

export const DRESS_CATEGORIES = [
  { value: 'all', label: '全部' },
  { value: 'nav', label: '导航栏' },
  { value: 'tabbar', label: '底部Tab' },
  { value: 'buttons', label: '交互按钮' },
  { value: 'cards', label: '录音卡片' },
  { value: 'profile', label: '个人主页' },
  { value: 'avatar', label: '头像挂件' },
  { value: 'comment', label: '评论区' },
  { value: 'topic', label: '话题卡片' },
  { value: 'chrome', label: '弹窗输入框' },
];

export const LOCAL_DRESS_ITEMS = DRESS_GROUP_DEFS.flatMap((def) => [
  makeDressItem(
    `${def.id}-plain`,
    def.id,
    def.defaultName,
    def.defaultHint,
    true,
    def.preview,
  ),
  ...def.upcoming.map(([id, name, description]) => makeDressItem(
    id,
    def.id,
    name,
    description,
    FREE_LIVE_DRESS_IDS.has(id),
    def.preview,
  )),
]);

LOCAL_DRESS_ITEMS.push(
  makeDressItem(
    'cards-member',
    'cards',
    '会员宣纸卡',
    '会员专属录音卡片纹理。',
    true,
    'cards',
    ACCESS_MEMBER,
  ),
  makeDressItem(
    'cards-event',
    'cards',
    '灯会录音卡',
    '同乡灯会限定卡片。',
    true,
    'cards',
    ACCESS_EVENT,
    { eventStatus: 'active' },
  ),
  makeDressItem(
    'avatar-event-end',
    'avatar',
    '开春头像框',
    '开春乡音头像框，活动已结束。',
    true,
    'avatar',
    ACCESS_EVENT,
    { eventStatus: 'ended' },
  ),
  makeDressItem(
    'avatar-creator',
    'avatar',
    '方言达人头像框',
    '完成创作任务后领取。',
    true,
    'avatar',
    ACCESS_CREATOR,
  ),
  makeDressItem(
    'navbar-member',
    'navbar',
    '会员顶栏细纹',
    '会员专属顶栏细纹。',
    true,
    'navbar',
    ACCESS_MEMBER,
  ),
);

LOCAL_DRESS_ITEMS.forEach((item, index) => {
  const def = DRESS_GROUP_DEFS.find((row) => row.id === item.group);
  const builtinStyle = BUILTIN_DRESS_STYLES[item.id] || {};
  const styleTag = DRESS_STYLE_BY_ID[item.id];
  LOCAL_DRESS_ITEMS[index] = {
    ...item,
    support_terminal: item.support_terminal || defaultSupportTerminal(Boolean(def?.mpBlocked)),
    component_type: item.component_type || componentTypeOf(item.group),
    style_json: cloneSkinStyle(
      (item.style_json && Object.keys(item.style_json).length)
        ? item.style_json
        : builtinStyle,
    ),
    ...(styleTag ? { style_tags: [styleTag] } : {}),
  };
});

GLOBAL_THEMES.forEach((item, index) => {
  GLOBAL_THEMES[index] = {
    ...item,
    support_terminal: item.support_terminal || defaultSupportTerminal(false),
    style_json: cloneSkinStyle(item.style_json),
  };
});

export function seedHeat(item) {
  if (Number.isFinite(item?.heat)) return item.heat;
  let total = 36;
  String(item?.id || '').split('').forEach((ch) => {
    total += ch.charCodeAt(0);
  });
  return 24 + (total % 160);
}

export function seedFavoriteCount(item) {
  if (Number.isFinite(item?.favSeed)) return item.favSeed;
  return Math.max(3, Math.floor(seedHeat(item) / 4));
}

function catalogSocialHeat(item) {
  if (!item) return null;
  const hasCatalog = ['collect_count', 'share_count', 'like_count']
    .some((key) => Object.prototype.hasOwnProperty.call(item, key));
  if (!hasCatalog) return null;
  return Number(item.collect_count || 0)
    + Number(item.share_count || 0)
    + Number(item.like_count || 0);
}

export function socialStats(kind, item) {
  const liked = isLiked(kind, item?.id);
  const favorited = isFavorited(kind, item?.id);
  const catalogHeat = catalogSocialHeat(item);
  if (catalogHeat != null) {
    return {
      liked,
      favorited,
      likes: catalogHeat + (liked ? 1 : 0) + (favorited ? 1 : 0),
      favorites: Number(item.collect_count || 0) + (favorited ? 1 : 0),
      shares: Number(item.share_count || 0),
    };
  }
  return {
    liked,
    favorited,
    likes: seedHeat(item) + (liked ? 1 : 0),
    favorites: seedFavoriteCount(item) + (favorited ? 1 : 0),
    shares: 0,
  };
}

export function canShareOrFavorite(item, { favorited = false } = {}) {
  if (!item?.id) return false;
  if (favorited) return true;
  return Boolean(item.available);
}

export function sortCatalog(list, kind, sort = 'newest') {
  const rows = list.map((item, index) => ({ item, index }));
  if (sort === 'heat') {
    rows.sort((left, right) => {
      const leftHeat = socialStats(kind, left.item).likes;
      const rightHeat = socialStats(kind, right.item).likes;
      return rightHeat - leftHeat;
    });
  } else if (sort === 'free') {
    rows.sort((left, right) => {
      const leftFree = (left.item.access || ACCESS_FREE) === ACCESS_FREE ? 0 : 1;
      const rightFree = (right.item.access || ACCESS_FREE) === ACCESS_FREE ? 0 : 1;
      if (leftFree !== rightFree) return leftFree - rightFree;
      return socialStats(kind, right.item).likes - socialStats(kind, left.item).likes;
    });
  } else if (sort === 'name') {
    rows.sort((left, right) => String(left.item.name || '').localeCompare(
      String(right.item.name || ''),
      'zh',
    ));
  } else {
    rows.sort((left, right) => {
      const leftTime = Number(left.item.create_time) || 0;
      const rightTime = Number(right.item.create_time) || 0;
      if (leftTime !== rightTime) return rightTime - leftTime;
      return right.index - left.index;
    });
  }
  return rows.map((row) => row.item);
}

export function hasPermission(kind, item) {
  if (!item?.available) return false;
  if (item.eventStatus === 'ended') return false;
  const access = item.access || ACCESS_FREE;
  if (access === ACCESS_FREE) return true;
  if (access === ACCESS_MEMBER) return getMemberStatus();
  if (access === ACCESS_CREATOR) return creatorUnlocked() && isOwned(kind, item.id);
  if (access === ACCESS_EVENT) return isOwned(kind, item.id);
  return false;
}

export function isDressBlocked(item, group, isMiniProgram = false) {
  return Boolean(group?.mpBlocked && isMiniProgram)
    || !supportsTerminal(item, { group, isMiniProgram });
}

export function describeAccess(item, kind, { group, isMiniProgram } = {}) {
  const access = item?.access || ACCESS_FREE;
  const blocked = isDressBlocked(item, group, isMiniProgram);
  const health = themeResourceHealth(item);
  if (!item || item.removed || item.retired || health.reason === 'removed') {
    return {
      label: '装扮已下架',
      action: 'removed',
      disabled: true,
      owned: false,
      blocked,
      hint: '装扮已下架',
    };
  }
  if (!item?.available) {
    return {
      label: '敬请期待',
      action: 'soon',
      disabled: true,
      owned: false,
      blocked,
      hint: kind === 'theme' ? '该主题暂未开放，敬请期待' : '装扮素材即将上线',
    };
  }
  if (health.reason === 'resource' || health.reason === 'style') {
    return {
      label: '装扮资源加载异常',
      action: 'broken',
      disabled: true,
      owned: false,
      blocked,
      hint: '装扮资源加载异常',
    };
  }
  const owned = hasPermission(kind, item);
  if (access === ACCESS_EVENT && item.eventStatus === 'ended') {
    return {
      label: '已绝版',
      action: 'ended',
      disabled: true,
      owned,
      blocked,
      hint: '该装扮活动已结束，暂无法获取',
    };
  }
  if (access === ACCESS_MEMBER && !owned) {
    return {
      label: '会员专属',
      action: 'member',
      disabled: false,
      owned: false,
      blocked,
      hint: '该装扮为会员专属，开通会员即可解锁全部会员主题与装扮',
    };
  }
  if (access === ACCESS_EVENT && item.eventStatus === 'active' && !owned) {
    return {
      label: '活动限定',
      action: 'event',
      disabled: false,
      owned: false,
      blocked,
      hint: '限时活动获取，完成后可领取。',
    };
  }
  if (access === ACCESS_CREATOR && !owned) {
    if (!creatorUnlocked()) {
      return {
        label: '方言创作者专属',
        action: 'creator-lock',
        disabled: false,
        owned: false,
        blocked,
        hint: '完成方言创作任务即可解锁，装一罐积累创作成就。',
      };
    }
    return {
      label: '方言创作者专属',
      action: 'claim',
      disabled: false,
      owned: false,
      blocked,
      hint: '已达成创作条件，领取后永久可用。',
    };
  }
  return {
    label: accessLabel(access, item),
    action: blocked ? 'mp-block' : 'enable',
    disabled: blocked,
    owned: true,
    blocked,
    hint: blocked ? '拥有权限，但小程序环境暂不支持该装扮' : '',
  };
}

export function listAcquireOffers() {
  const themes = GLOBAL_THEMES.filter((item) => {
    if (!item.available) return false;
    if (hasPermission('theme', item)) return false;
    return (item.access || ACCESS_FREE) !== ACCESS_FREE;
  });
  const dresses = LOCAL_DRESS_ITEMS.filter((item) => {
    if (!item.available) return false;
    if (hasPermission('dress', item)) return false;
    return (item.access || ACCESS_FREE) !== ACCESS_FREE;
  });
  return { themes, dresses };
}

export function accessActionLabel(accessInfo, { applied = false, kind = 'theme' } = {}) {
  if (applied) return kind === 'theme' ? '已启用' : '已应用';
  if (accessInfo?.action === 'soon') return '敬请期待';
  if (accessInfo?.action === 'ended') return '已绝版';
  if (accessInfo?.action === 'removed') return '装扮已下架';
  if (accessInfo?.action === 'broken') return '无法启用';
  if (accessInfo?.action === 'member') return '去开通会员';
  if (accessInfo?.action === 'event') return '去参与活动';
  if (accessInfo?.action === 'creator-lock') return '去完成创作任务';
  if (accessInfo?.action === 'claim') return '领取';
  if (accessInfo?.action === 'mp-block') return '应用';
  return kind === 'theme' ? '立即启用' : '应用';
}

export function getThemeById(id) {
  return GLOBAL_THEMES.find((item) => item.id === id) || null;
}

export function getActiveThemeId() {
  const saved = getStoredThemeId();
  const match = GLOBAL_THEMES.find((item) => item.id === saved && item.available && !item.removed);
  return match?.id || DEFAULT_THEME_ID;
}

export function getActiveTheme() {
  return GLOBAL_THEMES.find((item) => item.id === getActiveThemeId()) || GLOBAL_THEMES[0];
}

export function getRenderableTheme() {
  const theme = getActiveTheme();
  if (hasPermission('theme', theme)) return theme;
  return GLOBAL_THEMES.find((item) => item.id === DEFAULT_THEME_ID) || GLOBAL_THEMES[0];
}

export function listThemesByCategory(category = 'all', region = 'all', sort = 'newest') {
  const source = !category || category === 'all'
    ? GLOBAL_THEMES
    : GLOBAL_THEMES.filter((item) => item.category === category);
  const list = category !== 'dialect' || !region || region === 'all'
    ? source
    : source.filter((item) => item.region === region);
  return sortCatalog(list, 'theme', sort);
}

export function listDressGroupsByCategory(category = 'all', { isMiniProgram = false } = {}) {
  const source = !category || category === 'all'
    ? LOCAL_DRESS_GROUPS
    : LOCAL_DRESS_GROUPS.filter((item) => item.category === category);
  const visible = isMiniProgram ? source.filter((item) => !item.mpBlocked) : source;
  return visible.map((group) => {
    const items = LOCAL_DRESS_ITEMS.filter((item) => item.group === group.id);
    return {
      ...group,
      hasLive: items.some((item) => item.available),
    };
  });
}

export function getDressGroup(groupId) {
  return LOCAL_DRESS_GROUPS.find((item) => item.id === groupId) || null;
}

export function listDressItems(groupId, sort = 'newest') {
  return sortCatalog(
    LOCAL_DRESS_ITEMS.filter((item) => item.group === groupId),
    'dress',
    sort,
  );
}

export function getDressItem(itemId) {
  return LOCAL_DRESS_ITEMS.find((item) => item.id === itemId) || null;
}

export function defaultThemeQuery() {
  return {
    keyword: '',
    access: 'all',
    category: 'all',
    dressCategory: 'all',
    regions: [],
    status: 'all',
    sort: 'newest',
    resultTab: 'all',
    searching: false,
  };
}

export function catalogStatus(item) {
  const health = themeResourceHealth(item);
  if (!item || health.reason === 'removed') return 'removed';
  if (health.reason === 'resource' || health.reason === 'style') return 'broken';
  if (!item?.available) return 'upcoming';
  if (item.eventStatus === 'ended') return 'ended';
  return 'usable';
}

export function canLivePreview(item) {
  const status = catalogStatus(item);
  return status === 'usable' || status === 'ended';
}

export function isRemotePreviewSrc(value) {
  const text = String(value || '').trim();
  return /^https?:\/\//i.test(text) || text.startsWith('//') || text.startsWith('/');
}

export function previewCoverOf(item) {
  return item?.cover_img || item?.preview || '';
}

export function previewDetailOf(item) {
  return item?.detail_img || item?.cover_img || item?.preview || '';
}

export function dressDisplayTags(item, group, { applied = false } = {}) {
  const tags = [];
  const category = DRESS_CATEGORIES.find((row) => row.value === group?.category);
  if (category && category.value !== 'all') {
    tags.push({ kind: 'style', label: category.label, className: 'tag-style' });
  }
  const visual = (item?.style_tags || []).find((label) => label !== category?.label);
  if (visual) {
    tags.push({ kind: 'style', label: visual, className: 'tag-style' });
  }
  const region = DIALECT_REGIONS.find((row) => row.value === item?.region);
  if (region && region.value !== 'all') {
    tags.push({ kind: 'dialect', label: region.label, className: 'tag-dialect' });
  }
  if (item) {
    const ended = item.eventStatus === 'ended' || item.removed;
    if (!ended) {
      tags.push({
        kind: 'access',
        label: accessLabel(item.access || ACCESS_FREE, item),
        className: accessTagClass(item),
      });
    }
    if (applied) {
      tags.push({ kind: 'status', label: '已启用', className: 'tag-active' });
    } else if (!item.available) {
      tags.push({ kind: 'status', label: '待上线', className: 'tag-soon' });
    } else if (ended) {
      tags.push({ kind: 'status', label: '已绝版', className: 'tag-ended' });
    }
  }
  return tags;
}

export function themeDisplayTags(theme, { applied = false } = {}) {
  const tags = [];
  const category = THEME_CATEGORIES.find((row) => row.value === theme?.category);
  if (category && category.value !== 'all') {
    tags.push({ kind: 'style', label: category.label, className: 'tag-style' });
  }
  const region = DIALECT_REGIONS.find((row) => row.value === theme?.region);
  if (region && region.value !== 'all') {
    tags.push({ kind: 'dialect', label: region.label, className: 'tag-dialect' });
  }
  const ended = theme?.eventStatus === 'ended' || theme?.removed;
  if (!ended) {
    tags.push({
      kind: 'access',
      label: accessLabel(theme?.access || ACCESS_FREE, theme || {}),
      className: accessTagClass(theme || {}),
    });
  }
  if (applied) {
    tags.push({ kind: 'status', label: '已启用', className: 'tag-active' });
  } else if (!theme?.available) {
    tags.push({ kind: 'status', label: '待上线', className: 'tag-soon' });
  } else if (ended) {
    tags.push({ kind: 'status', label: '已绝版', className: 'tag-ended' });
  }
  return tags;
}

export function catalogHaystack(kind, item, group) {
  const categoryLabel = kind === 'theme'
    ? THEME_CATEGORIES.find((row) => row.value === item?.category)?.label
    : DRESS_CATEGORIES.find((row) => row.value === group?.category)?.label;
  const regionLabel = DIALECT_REGIONS.find((row) => row.value === item?.region)?.label;
  return [
    item?.name,
    item?.description,
    item?.blurb,
    item?.tag,
    categoryLabel,
    regionLabel,
    group?.name,
    group?.hint,
    accessLabel(item?.access || ACCESS_FREE, item || {}),
    kind === 'theme' ? '全局主题' : '局部装扮',
    ...(Array.isArray(item?.style_tags) ? item.style_tags : []),
    ...(Array.isArray(item?.dialect_tags) ? item.dialect_tags : []),
  ].filter(Boolean).join(' ').toLowerCase();
}

export function cleanSearchKeyword(keyword) {
  const text = String(keyword || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim();
  return text.slice(0, THEME_SEARCH_KEYWORD_MAX);
}

export function matchKeyword(haystack, keyword) {
  const query = cleanSearchKeyword(keyword).toLowerCase();
  if (!query) return true;
  const text = String(haystack || '');
  if (text.includes(query)) return true;
  const parts = query.split(/[\s,，、]+/).filter(Boolean);
  if (parts.length > 1 && parts.every((part) => text.includes(part))) return true;
  if (/^[\u4e00-\u9fff]{4,}$/.test(query)) {
    const chunks = [];
    for (let index = 0; index < query.length - 1; index += 2) {
      chunks.push(query.slice(index, index + 2));
    }
    if (chunks.some((chunk) => text.includes(chunk))) return true;
  }
  return false;
}

export function matchRegions(item, haystack, regions) {
  if (!regions?.length || regions.includes('all')) return true;
  const text = String(haystack || '');
  return regions.some((value) => {
    if (item?.region === value) return true;
    const label = DIALECT_REGIONS.find((row) => row.value === value)?.label;
    return Boolean(label && text.includes(String(label).toLowerCase()));
  });
}

export function getThemeQuery() {
  return readJsonObject(THEME_QUERY_STORAGE_KEY, defaultThemeQuery());
}

export function getSearchCache() {
  return readJsonObject(THEME_SEARCH_CACHE_KEY, {
    keyword: '',
    ids: [],
    at: 0,
  });
}

export function queryThemeCatalog(query = {}, { isMiniProgram = false } = {}) {
  const next = { ...defaultThemeQuery(), ...query };
  const keyword = cleanSearchKeyword(next.keyword);
  const themes = GLOBAL_THEMES.filter((item) => {
    if (next.access !== 'all' && (item.access || ACCESS_FREE) !== next.access) return false;
    if (next.category !== 'all' && item.category !== next.category) return false;
    if (next.status !== 'all' && catalogStatus(item) !== next.status) return false;
    const haystack = catalogHaystack('theme', item, null);
    if (!matchKeyword(haystack, keyword)) return false;
    return matchRegions(item, haystack, next.regions);
  });
  const dresses = LOCAL_DRESS_ITEMS.filter((item) => {
    const group = getDressGroup(item.group);
    if (next.access !== 'all' && (item.access || ACCESS_FREE) !== next.access) return false;
    if (next.dressCategory !== 'all' && group?.category !== next.dressCategory) return false;
    if (next.status !== 'all' && catalogStatus(item) !== next.status) return false;
    const haystack = catalogHaystack('dress', item, group);
    if (!matchKeyword(haystack, keyword)) return false;
    return matchRegions(item, haystack, next.regions);
  });
  const themeRows = sortCatalog(themes, 'theme', next.sort).map((item) => ({
    kind: 'theme',
    item,
    group: null,
    blocked: false,
  }));
  const dressRows = sortCatalog(dresses, 'dress', next.sort).map((item) => {
    const group = getDressGroup(item.group);
    return {
      kind: 'dress',
      item,
      group,
      blocked: isDressBlocked(item, group, isMiniProgram),
    };
  });
  return {
    themes: themeRows,
    dresses: dressRows,
    all: [...themeRows, ...dressRows],
  };
}

export function recentUseStatus(kind, item, group, isMiniProgram = false) {
  const health = themeResourceHealth(item);
  if (!item || item.retired || item.removed || health.reason === 'removed') return 'retired';
  if (health.reason === 'resource' || health.reason === 'style') return 'retired';
  if (!item.available) return 'retired';
  if (item.eventStatus === 'ended') return 'ended';
  if (isDressBlocked(item, group, isMiniProgram)) return 'blocked';
  if (!hasPermission(kind, item)) return 'gated';
  return 'ok';
}

export function recentStatusMeta(status, item) {
  if (status === 'ended') {
    return {
      label: '⚠️已绝版',
      hint: '该装扮已绝版，无法再次使用',
      disabled: true,
    };
  }
  if (status === 'blocked') {
    return {
      label: '❌环境不支持',
      hint: '当前环境暂不支持该装扮',
      disabled: true,
    };
  }
  if (status === 'gated') {
    return {
      label: accessLabel(item?.access || ACCESS_MEMBER, item || {}),
      hint: '',
      disabled: true,
    };
  }
  if (status === 'retired') {
    return {
      label: '📦已下架',
      hint: '装扮已下架',
      disabled: true,
    };
  }
  return {
    label: '✅可用',
    hint: '',
    disabled: false,
  };
}

export function mergeRemoteCatalog({ themes = [], dresses = [] } = {}) {
  themes.forEach((remote) => {
    const current = GLOBAL_THEMES.find((item) => item.id === remote.id);
    if (!current) return;
    current.available = remote.available;
    current.removed = Boolean(remote.removed);
    current.eventStatus = remote.eventStatus;
    current.blurb = remote.blurb || current.blurb;
    current.description = remote.description || current.description;
    if (remote.style_json && Object.keys(remote.style_json).length) {
      current.style_json = cloneSkinStyle({
        ...(current.style_json || {}),
        ...remote.style_json,
      });
    }
    if ('collect_count' in remote) current.collect_count = Number(remote.collect_count || 0);
    if ('share_count' in remote) current.share_count = Number(remote.share_count || 0);
    if ('like_count' in remote) current.like_count = Number(remote.like_count || 0);
    if (remote.poster_img) current.poster_img = remote.poster_img;
    if (remote.detail_img) current.detail_img = remote.detail_img;
    if (remote.cover_img) current.cover_img = remote.cover_img;
  });
  dresses.forEach((remote) => {
    const current = LOCAL_DRESS_ITEMS.find((item) => item.id === remote.id);
    if (!current) return;
    current.available = remote.available;
    current.removed = Boolean(remote.removed);
    current.eventStatus = remote.eventStatus;
    if (remote.group) current.group = remote.group;
    if (remote.style_json && Object.keys(remote.style_json).length) {
      current.style_json = cloneSkinStyle({
        ...(current.style_json || {}),
        ...remote.style_json,
      });
    }
    if ('collect_count' in remote) current.collect_count = Number(remote.collect_count || 0);
    if ('share_count' in remote) current.share_count = Number(remote.share_count || 0);
    if ('like_count' in remote) current.like_count = Number(remote.like_count || 0);
    if (remote.poster_img) current.poster_img = remote.poster_img;
  });
}

bindThemeCatalogPort({
  canShareOrFavorite,
  cleanSearchKeyword,
  defaultThemeQuery,
  getActiveTheme,
  getActiveThemeId,
  getDressGroup,
  getDressItem,
  getSearchCache,
  getThemeById,
  getThemeQuery,
  hasPermission,
  isDressBlocked,
  listAllDresses: () => LOCAL_DRESS_ITEMS,
  listAllThemes: () => GLOBAL_THEMES,
  queryThemeCatalog,
  recentStatusMeta,
  recentUseStatus,
});
