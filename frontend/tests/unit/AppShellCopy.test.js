import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ProductBrand from '@/components/ProductBrand.vue';
import { fallbackProductProfile, productProfile } from '@/services/productProfile';

describe('AppShell brand copy', () => {
  it('renders the shared brand and includes a credit only on the local site', async () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/AppShell.vue'), 'utf8');
    expect(source).toMatch(/<ProductBrand\s+class="app-shell__brand"/);
    const wrapper = mount(ProductBrand, { global: { stubs: { BaseButton: true } } });
    try {
      expect(wrapper.text()).toBe('乡声集盒');
      Object.assign(productProfile, fallbackProductProfile('pxm.test.edialect.top'));
      await wrapper.vm.$nextTick();
      expect(wrapper.get('.product-brand__name').text()).toBe('兴化语记 2.0 内测版');
      expect(wrapper.get('.product-brand__credit').text()).toBe('powered by 乡声集盒');
    } finally {
      Object.assign(productProfile, fallbackProductProfile());
      wrapper.unmount();
    }
  });
});
