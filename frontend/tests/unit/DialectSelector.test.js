import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { mount } from '@vue/test-utils';
import DialectLabel from '@/components/DialectLabel.vue';
import DialectSelector from '@/components/DialectSelector.vue';
import {
  dialectBreadcrumb,
  dialectCardLabel,
  registerDialectCatalog,
} from '@/utils/dialectTree';

const dialects = [
  {
    id: 1, name: '闽语', code: '闽', qualified_code: '闽', sort_order: 1,
  },
  {
    id: 2,
    name: '莆仙片（兴化方言）',
    code: '莆仙',
    qualified_code: '闽.莆仙',
    sort_order: 1,
  },
  {
    id: 3, name: '莆田', code: '莆田', qualified_code: '闽.莆仙.莆田', sort_order: 1,
  },
  {
    id: 4,
    name: '城里',
    code: '城里',
    qualified_code: '闽.莆仙.莆田.城里',
    sort_order: 1,
  },
];

describe('hierarchical dialect selection and labels', () => {
  beforeEach(() => {
    registerDialectCatalog(dialects);
    globalThis.uni = {
      getStorageSync: vi.fn(() => ''),
      setStorageSync: vi.fn(),
    };
    globalThis.getApp = vi.fn(() => ({ globalData: { userInfo: null } }));
  });

  it('uses natural card and detail labels without exposing qualified codes', () => {
    expect(dialectCardLabel(dialects[1], dialects)).toBe('闽语 · 莆仙方言');
    expect(dialectCardLabel(dialects[3], dialects)).toBe('闽语 · 莆仙方言 · 莆田 · 城里');
    expect(dialectBreadcrumb(dialects[3], dialects)).toBe('闽语 › 莆仙方言 › 莆田 › 城里');

    const card = mount(DialectLabel, { props: { dialect: dialects[3], dialects } });
    expect(card.text()).toBe('闽语 · 莆仙方言 · 莆田 · 城里');
    expect(card.text()).not.toContain('闽.莆仙');
  });

  it('preserves parent scope and intermediate regions from API names or fallback codes', () => {
    expect(dialectCardLabel(dialects[0], dialects)).toBe('闽语');
    expect(dialectCardLabel(dialects[2], dialects)).toBe('闽语 · 莆仙方言 · 莆田');
    expect(dialectCardLabel({
      name: '福州', path_names: ['闽语', '闽东片', '侯官片', '福州'],
    })).toBe('闽语 · 闽东方言 · 侯官方言 · 福州');
    expect(dialectCardLabel({
      name: '厦门', qualified_code: '闽.闽南.泉漳.厦门',
    }, [])).toBe('闽语 · 闽南 · 泉漳 · 厦门');
    expect(dialectCardLabel({
      name: '同名镇', path_names: ['某语言', '某方言', '甲地区', '乙地区', '同名镇'],
    })).toBe('某语言 · 某方言 · 甲地区 · 乙地区 · 同名镇');
    expect(dialectCardLabel({ path_names: ['蒙古语', '某地'] }, [])).toBe('蒙古语 · 某地');
    expect(dialectCardLabel({ name: '独立名称' }, [])).toBe('独立名称');
    expect(dialectCardLabel(null, [])).toBe('地区待补充');
  });

  it('lets a contributor stop at a parent node or continue to a locality', async () => {
    const wrapper = mount(DialectSelector, {
      props: { visible: true, dialects, ownerScope: 7 },
    });

    wrapper.vm.openNode(wrapper.vm.tree[0]);
    await wrapper.vm.$nextTick();
    wrapper.vm.openNode(wrapper.vm.childNodes[0]);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('当前已知范围');
    expect(wrapper.text()).toContain('莆仙方言');

    wrapper.vm.selectNode(wrapper.vm.currentNode);
    expect(wrapper.emitted('change')[0][0]).toMatchObject({ value: 2 });

    await wrapper.setProps({ visible: true, value: 4 });
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.currentNode.id).toBe(4);
    expect(wrapper.text()).toContain('闽语 › 莆仙方言 › 莆田 › 城里');
  });

  it('searches internal aliases but only renders human-facing paths', async () => {
    const wrapper = mount(DialectSelector, { props: { visible: true, dialects } });
    wrapper.vm.query = '闽.莆仙.莆田.城里';
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.searchResults.map((item) => item.id)).toContain(4);
    expect(wrapper.text()).toContain('闽语 › 莆仙方言 › 莆田 › 城里');
  });

  it('refreshes the profile default when the sheet opens after app startup', async () => {
    const app = { globalData: { userInfo: null } };
    globalThis.getApp = vi.fn(() => app);
    const wrapper = mount(DialectSelector, {
      props: { visible: false, dialects, ownerScope: 7 },
    });

    app.globalData.userInfo = { primary_dialect: dialects[3] };
    await wrapper.setProps({ visible: true });

    expect(wrapper.text()).toContain('默认 · 闽语 · 莆仙方言 · 莆田 · 城里');
  });
  it('keeps selecting a dialect when saving the optional recent shortcut fails', () => {
    uni.setStorageSync.mockImplementation(() => { throw new Error('storage quota exceeded'); });
    const wrapper = mount(DialectSelector, { props: { visible: true, dialects } });

    expect(() => wrapper.vm.selectNode(dialects[3])).not.toThrow();
    expect(wrapper.emitted('change')).toEqual([[{ value: 4, dialect: dialects[3] }]]);
    expect(wrapper.emitted('update:visible')).toEqual([[false]]);
    expect(wrapper.emitted('close')).toHaveLength(1);
    expect(wrapper.vm.recentIds).toEqual([4]);
  });

  it('replaces recent shortcuts when the visible selector changes account scope', async () => {
    const storage = {
      'dialect-selector:recent:7': '[4,3]',
      'dialect-selector:recent:8': '[2]',
    };
    uni.getStorageSync.mockImplementation((key) => storage[key] || '');
    const wrapper = mount(DialectSelector, {
      props: { visible: true, dialects, ownerScope: 7 },
    });
    expect(wrapper.vm.recentIds).toEqual([4, 3]);

    await wrapper.setProps({ ownerScope: 8 });
    expect(wrapper.vm.recentIds).toEqual([2]);
    wrapper.vm.selectNode(dialects[0]);
    expect(uni.setStorageSync).toHaveBeenLastCalledWith('dialect-selector:recent:8', '[1,2]');

    await wrapper.setProps({ ownerScope: 'guest' });
    expect(wrapper.vm.recentIds).toEqual([]);
  });

  it('loads the new account history on reopen without changing the selected dialect', async () => {
    uni.getStorageSync.mockImplementation((key) => (
      key === 'dialect-selector:recent:7' ? '[4,3]' : '[2]'
    ));
    const wrapper = mount(DialectSelector, {
      props: {
        visible: true, dialects, ownerScope: 7, value: 4, defaultDialect: dialects[3],
      },
    });
    await wrapper.setProps({ visible: false });
    await wrapper.setProps({ ownerScope: 8 });
    expect(wrapper.emitted('change')).toBeUndefined();
    await wrapper.setProps({ visible: true });

    expect(wrapper.vm.recentIds).toEqual([2]);
    expect(wrapper.vm.currentNode.id).toBe(4);
    expect(wrapper.vm.resolvedDefaultDialect.id).toBe(4);
    expect(wrapper.emitted('change')).toBeUndefined();
  });

  it('refreshes the profile default when the account changes while the sheet stays open', async () => {
    const app = { globalData: { userInfo: { primary_dialect: dialects[3] } } };
    globalThis.getApp = vi.fn(() => app);
    const wrapper = mount(DialectSelector, {
      props: { visible: true, dialects, ownerScope: 7 },
    });
    expect(wrapper.vm.resolvedDefaultDialect.id).toBe(4);

    app.globalData.userInfo = { primary_dialect: dialects[1] };
    await wrapper.setProps({ ownerScope: 8 });
    expect(wrapper.vm.resolvedDefaultDialect.id).toBe(2);

    app.globalData.userInfo = null;
    await wrapper.setProps({ ownerScope: 'guest' });
    expect(wrapper.vm.resolvedDefaultDialect).toBeNull();
    expect(wrapper.emitted('change')).toBeUndefined();
  });

  it('picks up a late global profile when the async dialect catalog arrives', async () => {
    const app = { globalData: { userInfo: null } };
    globalThis.getApp = vi.fn(() => app);
    const wrapper = mount(DialectSelector, {
      props: { visible: true, dialects: [], ownerScope: 7 },
    });
    expect(wrapper.vm.resolvedDefaultDialect).toBeNull();
    app.globalData.userInfo = { primary_dialect: dialects[3] };
    await wrapper.setProps({ dialects });
    expect(wrapper.vm.resolvedDefaultDialect.id).toBe(4);
  });

  it('refreshes the global fallback after an explicit default is removed', async () => {
    const app = { globalData: { userInfo: { primary_dialect: dialects[1] } } };
    globalThis.getApp = vi.fn(() => app);
    const wrapper = mount(DialectSelector, {
      props: {
        visible: true, dialects, ownerScope: 7, defaultDialect: dialects[3],
      },
    });
    expect(wrapper.vm.resolvedDefaultDialect.id).toBe(4);
    app.globalData.userInfo = { primary_dialect: dialects[2] };
    await wrapper.setProps({ defaultDialect: null });
    expect(wrapper.vm.resolvedDefaultDialect.id).toBe(3);
  });
});
