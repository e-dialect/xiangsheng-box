import { shallowMount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import EvidenceSource from '@/components/EvidenceSource.vue';

describe('evidence source reading', () => {
  it('renders quoted source markup as text without introducing executable elements', () => {
    const text = '<img src=x onerror="alert(1)">原始材料';
    const wrapper = shallowMount(EvidenceSource, {
      props: { source: { source_type: 'book', original_text: text, citation: '书籍第 2 页' } },
    });
    expect(wrapper.text()).toContain(text);
    expect(wrapper.text()).toContain('书籍');
    expect(wrapper.find('img').exists()).toBe(false);
  });

  it('allows long source text to expand and collapse without losing its content', async () => {
    const text = '未经改写的来源原文。'.repeat(100);
    const wrapper = shallowMount(EvidenceSource, { props: { source: { original_text: text } } });
    const button = wrapper.findComponent({ name: 'BaseButton' });
    expect(button.props('text')).toBe('展开全部原文');
    await button.vm.$emit('click');
    expect(button.props('text')).toBe('收起原文');
    expect(wrapper.find('.source-card__text').text()).toBe(text);
    await button.vm.$emit('click');
    expect(button.props('text')).toBe('展开全部原文');
  });
});
