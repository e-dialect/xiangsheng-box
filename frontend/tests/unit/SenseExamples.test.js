import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import SenseExamples from '@/components/SenseExamples.vue';

describe('sense examples inherited from the legacy Web experience', () => {
  it('shows examples and explanations without flattening their labels', () => {
    const wrapper = mount(SenseExamples, { props: { examples: [
      { type: '例', content: '原样例句', explain: '原样解释' },
      { type: '俗', content: '另一条俗语', explain: '另一条解释' },
    ] } });
    expect(wrapper.findAll('.sense-examples__item')).toHaveLength(2);
    expect(wrapper.text()).toContain('原样例句');
    expect(wrapper.text()).toContain('原样解释');
    expect(wrapper.text()).toContain('俗');
  });
  it('accepts plain strings and the text/translation object form', () => {
    const wrapper = mount(SenseExamples, { props: { examples: [
      '保留原话', { text: 'Recorded sentence', translation: '已记录译文' },
    ] } });
    expect(wrapper.findAll('.sense-examples__item')).toHaveLength(2);
    expect(wrapper.text()).toContain('已记录译文');
  });
  it('does not fabricate text from invalid or unsupported records', () => {
    const wrapper = mount(SenseExamples, { props: { examples: [
      null, 12, [], {}, { content: {} }, { other: 'unknown' }, ' ',
    ] } });
    expect(wrapper.find('.sense-examples').exists()).toBe(false);
  });
  it('treats source text as plain text, never HTML', () => {
    const wrapper = mount(SenseExamples, { props: { examples: [
      { content: '<img src=x onerror=alert(1)>', explain: '<b>解释</b>' },
    ] } });
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('b').exists()).toBe(false);
    expect(wrapper.text()).toContain('<b>解释</b>');
  });
  it('keeps conflicting statements as separate records', () => {
    const wrapper = mount(SenseExamples, { props: { examples: ['某地这样说', '另一来源有不同记载'] } });
    expect(wrapper.findAll('.sense-examples__item')).toHaveLength(2);
  });
});
