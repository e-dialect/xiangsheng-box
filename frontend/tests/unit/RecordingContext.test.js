import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import RecordingContext from '@/components/RecordingContext.vue';

describe('recording context is explicit about known and missing facts', () => {
  it('keeps restrictions verbatim and separates visibility from a draft', () => {
    const recording = { visibility: true, status: 'draft', rights_statement: '仅用于核查，不对外使用' };
    const wrapper = mount(RecordingContext, { props: { recording, expanded: true } });
    expect(wrapper.text()).toContain('公开可见');
    expect(wrapper.text()).toContain('初稿·待核对');
    expect(wrapper.text()).toContain(recording.rights_statement);
    expect(wrapper.text()).toContain('公开可见不表示已核对或获准引用');
  });
  it('does not infer review or permission when fields are missing', () => {
    const wrapper = mount(RecordingContext, { props: { recording: {} } });
    expect(wrapper.text()).toContain('可见性未提供');
    expect(wrapper.text()).toContain('整理状态未提供');
    expect(wrapper.text()).toContain('暂未补充引用授权说明');
    expect(wrapper.text()).not.toContain('审核通过');
  });
});
