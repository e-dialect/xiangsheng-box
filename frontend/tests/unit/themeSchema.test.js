import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  applyOutfitStyle,
  clearThemeStyleCache,
  COMPONENT_NAV_BAR,
  defaultSupportTerminal,
  cloneCatalogItem,
  cloneSkinStyle,
  flattenStyleJson,
  fromCurrentConfig,
  fromDecorationItem,
  fromPrivilegeType,
  fromSavedMix,
  fromThemeItem,
  getAppliedOutfitVars,
  isNativeComponent,
  PRIVILEGE_ACTIVITY,
  resolveOutfitStyle,
  supportsTerminal,
  THEME_API_PATHS,
  THEME_DATA_KEYS,
  toCollectList,
  toCurrentConfig,
  toDecorationItem,
  toPrivilegeType,
  toSavedMix,
  toThemeItem,
} from '@/services/themeSchema';

vi.mock('@/services/platform', () => ({
  isH5Runtime: vi.fn(() => false),
  isWechatMiniProgram: vi.fn(() => false),
  default: vi.fn(() => false),
}));

describe('themeSchema contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.uni = {
      getStorageSync: vi.fn(() => ''),
      setStorageSync: vi.fn(),
      $emit: vi.fn(),
    };
  });

  it('maps privilege and terminals to the PRD enums', () => {
    expect(toPrivilegeType('event')).toBe(PRIVILEGE_ACTIVITY);
    expect(fromPrivilegeType(PRIVILEGE_ACTIVITY)).toBe('event');
    expect(defaultSupportTerminal(true)).toEqual(['h5']);
    expect(defaultSupportTerminal(false)).toEqual(['h5', 'miniprogram']);
    expect(isNativeComponent(COMPONENT_NAV_BAR)).toBe(true);
    expect(THEME_API_PATHS.config).toBe('/users/theme/config/');
    expect(THEME_API_PATHS.entitlement).toBe('/users/theme/entitlement/');
    expect(THEME_API_PATHS).not.toHaveProperty('submissions');
    expect(THEME_API_PATHS).not.toHaveProperty('credits');
    expect(THEME_API_PATHS).not.toHaveProperty('fragments');
    expect(THEME_API_PATHS).not.toHaveProperty('ranks');
    expect(THEME_DATA_KEYS.local_current_config).toBe('local_current_config');
  });

  it('serializes catalog items to theme_item and decoration_item', () => {
    const theme = toThemeItem({
      id: 'chuankiang',
      name: '川渝烟火',
      description: '巴蜀市井热辣风格',
      category: 'dialect',
      region: 'chuankiang',
      preview: 'dialect',
      available: false,
      access: 'free',
    });
    expect(theme).toMatchObject({
      theme_id: 'chuankiang',
      desc: '巴蜀市井热辣风格',
      dialect_tags: ['川渝'],
      style_tags: ['地域方言风'],
      privilege_type: 'free',
      status: 'coming',
      support_terminal: ['h5', 'miniprogram'],
    });
    expect(fromThemeItem({
      theme_id: 'chuankiang',
      name: '川渝烟火',
      desc: '巴蜀市井热辣风格',
      style_tags: ['地域方言风'],
      dialect_tags: ['川渝'],
      privilege_type: 'free',
      status: 'coming',
      collect_count: 4,
      share_count: 1,
      detail_img: 'wide',
      poster_img: 'poster',
      activity_start_at: null,
      activity_end_at: null,
    })).toMatchObject({
      id: 'chuankiang',
      category: 'dialect',
      region: 'chuankiang',
      collect_count: 4,
      share_count: 1,
      detail_img: 'wide',
      poster_img: 'poster',
      activity_start_at: null,
    });
    expect(theme).toMatchObject({
      detail_img: '',
      poster_img: '',
      activity_start_at: null,
    });
    expect(fromThemeItem({ name: 'orphan' })).toBeNull();
    expect(fromThemeItem({ theme_id: 'plain' }).name).toBe('装扮');
    expect(fromThemeItem({
      theme_id: 'event-spring',
      status: 'deprecated',
      name: '开春乡音',
    })).toMatchObject({
      available: true,
      removed: true,
      eventStatus: 'ended',
    });
    expect(fromDecorationItem({})).toBeNull();

    const dress = toDecorationItem({
      id: 'navbar-plain',
      name: '系统默认顶栏',
      description: '跟随当前全局主题的顶栏。',
      group: 'navbar',
      preview: 'navbar',
      available: true,
      access: 'free',
    }, { id: 'navbar', mpBlocked: true, category: 'nav' });
    expect(dress).toMatchObject({
      decoration_id: 'navbar-plain',
      component_type: 'nav_bar',
      group: 'navbar',
      privilege_type: 'free',
      status: 'available',
      support_terminal: ['h5'],
      detail_img: '',
      activity_start_at: null,
    });
    expect(supportsTerminal(dress, {
      group: { mpBlocked: true },
      isMiniProgram: true,
    })).toBe(false);
  });

  it('builds user snapshots for collect, mix, and current config', () => {
    expect(toCollectList({ themes: ['default'], dresses: ['cards-plain'] })).toEqual({
      collect_list: [
        { item_id: 'default', item_type: 'theme', collect_time: 0 },
        { item_id: 'cards-plain', item_type: 'decoration', collect_time: 0 },
      ],
    });
    expect(toSavedMix({
      id: 'outfit-1',
      name: '川渝全套搭配',
      themeId: 'default',
      localDress: { cards: 'cards-plain' },
      overlay: false,
      savedAt: 9,
    })).toMatchObject({
      mix_id: 'outfit-1',
      mix_name: '川渝全套搭配',
      global_theme_id: 'default',
      decoration_ids: ['cards-plain'],
      decoration_map: { card: 'cards-plain' },
      is_cover_local_decoration: false,
    });
    expect(fromSavedMix({
      mix_id: 'outfit-1',
      mix_name: '川渝全套搭配',
      global_theme_id: 'default',
      decoration_ids: ['cards-plain'],
      decoration_map: { card: 'cards-plain' },
      is_cover_local_decoration: false,
    })).toMatchObject({
      overlay: false,
      localDress: { cards: 'cards-plain' },
    });
    expect(toCurrentConfig({
      themeId: 'default',
      localDress: { navbar: 'navbar-plain', cards: 'cards-plain' },
      overlay: true,
      recent: [{ id: 'default', kind: 'theme', usedAt: 1 }],
    })).toMatchObject({
      global_theme_id: 'default',
      decoration_map: {
        nav_bar: 'navbar-plain',
        card: 'cards-plain',
      },
      is_cover_local_decoration: true,
      recent_use_list: [
        { item_id: 'default', item_type: 'theme', use_time: 1 },
      ],
    });
    expect(fromCurrentConfig({
      global_theme_id: 'default',
      decoration_map: { card: 'cards-plain' },
      is_cover_local_decoration: false,
      recent_use_list: [
        { item_id: 'default', item_type: 'theme', use_time: 2 },
        { item_id: '', item_type: 'theme', use_time: 1 },
        { item_id: 'gone', item_type: 'decoration', use_time: 0 },
      ],
    }, (itemId) => (itemId === 'cards-plain' ? 'cards' : ''))).toMatchObject({
      themeId: 'default',
      overlay: false,
      localDress: { cards: 'cards-plain' },
      recent: [
        { id: 'default', kind: 'theme', usedAt: 2 },
        { id: 'gone', kind: 'dress', usedAt: 0 },
      ],
    });
  });

  it('injects token style_json and skips native mini-program components', () => {
    const flat = flattenStyleJson({
      borderColor: 'var(--accent-color)',
      borderWidth: '4px',
      borderRadius: '50%',
      shadow: '0 0 8px var(--accent-color)',
    }, 'avatar_frame');
    expect(flat.ok).toBe(true);
    expect(flat.vars['--dress-avatar-frame-border-color']).toBe('var(--accent-color)');
    expect(flattenStyleJson({ borderColor: 'red;background:url(x)' }).vars).toEqual({});
    const cached = flattenStyleJson('{bad');
    expect(flattenStyleJson('{bad')).toEqual(cached);
    clearThemeStyleCache();
    expect(flattenStyleJson('{bad')).toMatchObject({ ok: false, reason: 'style' });

    const resolved = resolveOutfitStyle({
      theme: {
        style_json: { accent: 'pine', primaryLook: 'fill' },
      },
      dressItems: [{
        item: {
          style_json: { borderColor: 'var(--accent-color)' },
          component_type: 'nav_bar',
          support_terminal: ['h5'],
        },
        group: { mpBlocked: true, id: 'navbar' },
      }],
      overlay: false,
      isMiniProgram: true,
    });
    expect(resolved.ok).toBe(true);
    expect(resolved.skipped[0].reason).toBe('native');
    expect(resolved.appearance.accent).toBe('pine');

    expect(flattenStyleJson({
      cardBackground: 'var(--page-color)',
      cardBorderRadius: '4px',
      grainImage: 'var(--grain-paper)',
      letterSpacing: '0.06em',
    }).vars).toMatchObject({
      '--dress-card-background': 'var(--page-color)',
      '--dress-card-border-radius': '4px',
      '--dress-grain-image': 'var(--grain-paper)',
      '--dress-letter-spacing': '0.06em',
    });

    const tabBar = flattenStyleJson({
      tabBackground: 'var(--surface-color)',
      tabColor: 'var(--muted-color)',
      tabAccent: 'var(--accent-color)',
      tabOnAccent: 'var(--on-accent-color)',
      tabEmphasis: 'var(--text-color)',
      tabBorder: 'var(--border-color)',
    }, 'tab_bar');
    expect(tabBar.vars).toMatchObject({
      '--dress-tab-bar-background': 'var(--surface-color)',
      '--dress-tab-bar-color': 'var(--muted-color)',
      '--dress-tab-bar-accent': 'var(--accent-color)',
      '--dress-tab-bar-on-accent': 'var(--on-accent-color)',
      '--dress-tab-bar-emphasis': 'var(--text-color)',
      '--dress-tab-bar-border-color': 'var(--border-color)',
    });
    expect(Object.keys(tabBar.vars).some((key) => key.includes('tab-bar-tab-bar'))).toBe(false);
    const coveredSkin = resolveOutfitStyle({
      theme: {
        style_json: {
          accent: 'ink',
          cardBorderRadius: '6px',
          cardBackground: 'var(--surface-color)',
        },
      },
      dressItems: [{ item: { style_json: { borderWidth: '8px' }, group: 'cards' } }],
      overlay: true,
    });
    expect(coveredSkin.vars).toMatchObject({
      '--dress-card-border-radius': '6px',
      '--dress-card-background': 'var(--surface-color)',
    });
    expect(coveredSkin.vars['--dress-card-border-width'] || coveredSkin.vars['--dress-border-width']).toBeFalsy();
    expect(coveredSkin.appearance.accent).toBe('ink');

    applyOutfitStyle(resolveOutfitStyle({
      theme: { style_json: { accent: 'tea', primaryLook: 'ardent' } },
    }));
    expect(getAppliedOutfitVars()).toEqual({});
    expect(uni.setStorageSync).toHaveBeenCalledWith('ui_accent', 'tea');
    expect(uni.setStorageSync).toHaveBeenCalledWith('ui_button_style', 'ardent');
  });

  it('clones skin records and flatten results so callers cannot share mutations', () => {
    const style = { cardBorderRadius: '8px', accent: 'tea' };
    const item = {
      id: 'a',
      name: 'A',
      style_json: style,
      support_terminal: ['h5'],
    };
    const copy = cloneCatalogItem(item);
    expect(copy.style_json).not.toBe(item.style_json);
    expect(copy.support_terminal).not.toBe(item.support_terminal);
    copy.style_json.cardBorderRadius = '99px';
    expect(item.style_json.cardBorderRadius).toBe('8px');
    expect(cloneSkinStyle(style)).not.toBe(style);

    const first = flattenStyleJson(style).vars;
    first['--dress-card-border-radius'] = '1px';
    expect(flattenStyleJson(style).vars['--dress-card-border-radius']).toBe('8px');
  });

  it('falls back to default when style_json is corrupt', () => {
    const resolved = resolveOutfitStyle({
      theme: { style_json: '{bad' },
    });
    expect(resolved.ok).toBe(false);
    expect(applyOutfitStyle(resolved)).toMatchObject({ ok: false, fallback: 'default' });
  });
});
