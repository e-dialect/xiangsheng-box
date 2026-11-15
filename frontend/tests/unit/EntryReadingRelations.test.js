import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PronunciationForms from '@/components/PronunciationForms.vue';
import SenseConcepts from '@/components/SenseConcepts.vue';

const reading = (variant) => mount(PronunciationForms, { props: { variant } });

describe('entry pronunciation forms', () => {
  it('preserves distinct forms and original IPA without deriving missing IPA dimensions', () => {
    const wrapper = reading({ base_romanization: 'base', surface_romanization: 'surface', ipa: 'ipa' });
    expect(wrapper.text().replace(/\s/g, '')).toContain('基础形式（单读）base');
    expect(wrapper.text().replace(/\s/g, '')).toContain('实际形式（连读）surface');
    expect(wrapper.text().replace(/\s/g, '')).toContain('→');
    expect(wrapper.text().replace(/\s/g, '')).toContain('IPA（原记录）ipa');
  });
  it('collapses identical forms without a self-transition', () => {
    const wrapper = reading({ base_romanization: ' same ', surface_romanization: 'same' });
    expect(wrapper.findAll('.pronunciation-forms__value')).toHaveLength(1);
    expect(wrapper.text()).not.toContain('→');
  });
  it.each([
    { base_romanization: 'base' }, { surface_romanization: 'surface' }, { ipa: 'ipa' },
  ])('does not invent the missing form: %j', (variant) => {
    const wrapper = reading(variant);
    expect(wrapper.findAll('.pronunciation-forms__value')).toHaveLength(1);
    expect(wrapper.text()).not.toContain('→');
  });
  it('shows missing data without rendering objects', () => {
    expect(reading({ ipa: {}, base_romanization: ' ' }).text()).toBe('读音标注待补充');
  });
  it('preserves reading type and notes as text', () => {
    const wrapper = reading({ reading_type: 'literary', usage_note: '<b>sourcenote</b>' });
    expect(wrapper.text().replace(/\s/g, '')).toContain('文读');
    expect(wrapper.text().replace(/\s/g, '')).toContain('<b>sourcenote</b>');
    expect(wrapper.find('b').exists()).toBe(false);
  });
});

describe('sense concept relations', () => {
  it('distinguishes all four relations and retains notes', () => {
    const wrapper = mount(SenseConcepts, {
      props: {
        concepts: [
          { label: '甲', relation_type: 'exact' }, { label: '乙', relation_type: 'broader' },
          { label: '丙', relation_type: 'narrower' }, { label: '丁', relation_type: 'related', note: '说明' },
        ],
      },
    });
    ['对应概念：甲', '较宽关联：乙', '较窄关联：丙', '相关概念：丁', '说明'].forEach((text) => {
      expect(wrapper.text().replace(/\s/g, '')).toContain(text);
    });
  });
  it('does not silently upgrade unknown relations to exact', () => {
    const wrapper = mount(SenseConcepts, { props: { concepts: [{ code: 'code', relation_type: 'new' }] } });
    expect(wrapper.text().replace(/\s/g, '')).toContain('关联关系待核实：code');
  });
  it('keeps sense labels separate when the sense changes', async () => {
    const wrapper = mount(SenseConcepts, { props: { concepts: [{ label: '亲属', relation_type: 'related' }] } });
    await wrapper.setProps({ concepts: [{ label: '器官', relation_type: 'related' }] });
    expect(wrapper.text()).not.toContain('亲属');
    expect(wrapper.text().replace(/\s/g, '')).toContain('器官');
  });
  it('gracefully shows unannotated senses and rejects invalid labels', () => {
    const wrapper = mount(SenseConcepts, { props: { concepts: [null, {}, { label: {} }] } });
    expect(wrapper.text().replace(/\s/g, '')).toContain('尚未标注概念关联');
  });
});
