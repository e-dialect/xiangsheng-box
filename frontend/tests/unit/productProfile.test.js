import { mount } from '@vue/test-utils';
import ProductHighlights from '@/components/home/ProductHighlights.vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fallbackProductProfile, loadProductProfile, productProfile, productShareTitle, productSwitchUrl,
} from '@/services/productProfile';

const box = { key: 'box', name: '乡声集盒内测版', origin: 'https://box.test.edialect.top' };
const pxm = { key: 'pxm', name: '兴化语记 2.0 内测版', origin: 'https://pxm.test.edialect.top' };

afterEach(() => {
  vi.unstubAllGlobals();
  Object.assign(productProfile, fallbackProductProfile());
  document.title = '';
});

describe('product profile routing', () => {
  it('keeps the registered local brand while the profile API loads or fails', () => {
    expect(fallbackProductProfile('PXM.TEST.EDIALECT.TOP')).toMatchObject({
      key: pxm.key,
      name: pxm.name,
      credit: 'powered by 乡声集盒',
      default_dialect: '闽.莆仙',
    });
    expect(fallbackProductProfile('box.test.edialect.top')).toMatchObject({
      key: box.key, name: box.name, default_dialect: '',
    });
    expect(fallbackProductProfile('pxm.test.edialect.top.example')).toMatchObject({
      key: 'general', name: '乡声集盒', credit: '',
    });
  });

  it('retains public search and detail parameters without passing account or storage data', () => {
    expect(productSwitchUrl(box, {
      pathname: '/app/pages/search',
      search: '?keywords=%E6%B5%B7&dialect=42&token=secret&auth_intent=private',
    }, '/app/')).toBe('https://box.test.edialect.top/app/pages/search?keywords=%E6%B5%B7&dialect=42');
    expect(productSwitchUrl(box, {
      pathname: '/pages/entries/details',
      search: '?id=42&source=outside',
    })).toBe('https://box.test.edialect.top/pages/entries/details?id=42');
    expect(productSwitchUrl(box, {
      pathname: '/pages/login/login',
      search: '?code=secret',
    })).toBe('https://box.test.edialect.top/');
    expect(productSwitchUrl(box, {
      pathname: '/pages/search',
      search: '?keywords=old&dialect=42',
    }, '/', { keywords: 'new' })).toBe('https://box.test.edialect.top/pages/search?keywords=new');
  });

  it('only accepts configured web origins and known internal paths for switching', () => {
    expect(productSwitchUrl({ ...box, origin: 'https://example.com/a' }, { pathname: '/' })).toBeNull();
    expect(productSwitchUrl({ ...box, origin: 'javascript:alert(1)' }, { pathname: '/' })).toBeNull();
    expect(productSwitchUrl(box, { pathname: '//other.example/evil', search: '' })).toBe('https://box.test.edialect.top/');
    expect(productSwitchUrl(null, { pathname: '/' })).toBeNull();
  });

  it('renders ordered sections and opens only active tools for a visitor-chosen dialect', async () => {
    vi.stubGlobal('uni', { navigateTo: vi.fn() });
    Object.assign(productProfile, {
      home_sections: ['collections', 'tools', 'entries', 'recordings'],
      enabled_tools: ['quiz'],
      local_tools_dialect: '',
      featured: [
        { type: 'entry', id: 3, title: '词条' },
        { type: 'collection', id: 4, title: '专题' },
      ],
    });
    const wrapper = mount(ProductHighlights, {
      global: {
        stubs: {
          BaseButton: {
            props: ['text'],
            template: '<button @click="emitClick">{{ text }}</button>',
            methods: { emitClick() { this.$emit('click'); } },
          },
        },
      },
    });
    expect(wrapper.findAll('[data-home-section]').map((section) => (
      section.attributes('data-home-section')
    ))).toEqual(['collections', 'tools', 'entries']);
    const tools = wrapper.get('[data-home-section="tools"]');
    expect(tools.text()).toContain('聪明花开');
    expect(tools.text()).not.toContain('拼音方案');
    await tools.get('button').trigger('click');
    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/tools/local?tool=quiz' });
    productProfile.enabled_tools = [];
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-home-section="tools"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('reads the deployment mapping anonymously and uses the current public name in share text', async () => {
    const request = vi.fn().mockResolvedValue({
      statusCode: 200,
      data: {
        profile: { key: 'sample', name: '中性测试站', version: 17, featured: [] },
        switch_targets: [pxm, null, { ...box, origin: 'javascript:alert(1)' }],
      },
    });
    vi.stubGlobal('uni', { request });
    await Promise.all([loadProductProfile(), loadProductProfile()]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith({
      method: 'GET', url: expect.stringMatching(/\/site-settings\/product-profile$/), dataType: 'json', timeout: 3500,
    });
    expect(productProfile.switchTargets).toEqual([pxm]);
    expect(productProfile.home_sections).toEqual(['tools', 'featured']);
    expect(productProfile.enabled_tools).toEqual(['pinyin', 'quiz', 'kinship']);
    expect(productShareTitle('词条｜走路')).toBe('词条｜走路 · 中性测试站');
    expect(document.title).toBe('中性测试站');
  });
});
