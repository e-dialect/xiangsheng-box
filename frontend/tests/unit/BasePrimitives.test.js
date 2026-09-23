import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseForm from '@/components/BaseForm.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import confirmDialog from '@/components/ConfirmDialog';

describe('BaseButton', () => {
  beforeEach(() => {
    global.uni = {
      $emit: vi.fn(),
      $on: vi.fn(),
      $off: vi.fn(),
      getStorageSync: vi.fn(() => ''),
    };
  });

  it('forwards recording action icons explicitly on both platforms', () => {
    const wrapper = mount(BaseButton, { props: { icon: 'refresh' } });
    expect(wrapper.getComponent({ name: 'TDesignStub' }).props('icon')).toBe('refresh');
  });

  it('forwards the mini program share capability explicitly', () => {
    const wrapper = mount(BaseButton, { props: { openType: 'share' } });
    expect(wrapper.getComponent({ name: 'TDesignStub' }).props('openType')).toBe('share');
  });

  it('omits an empty aria-label so slot text stays the accessible name', () => {
    const wrapper = mount(BaseButton, {
      slots: { default: '保存' },
    });
    expect(wrapper.vm.resolvedAriaLabel).toBeUndefined();
  });

  it('renders the primary variant with slot text by default', () => {
    const wrapper = mount(BaseButton, {
      slots: { default: '提交词条' },
    });

    const button = wrapper.getComponent({ name: 'TDesignStub' });
    expect(button.props('theme')).toBe('primary');
    expect(button.props('variant')).toBe('base');
    expect(button.props('size')).toBe('medium');
    expect(wrapper.text()).toContain('提交词条');
  });

  it('supports ghost and danger variants with block sizing', () => {
    const ghost = mount(BaseButton, {
      props: { variant: 'ghost', block: true },
    });
    expect(ghost.getComponent({ name: 'TDesignStub' }).props()).toMatchObject({
      block: true,
      theme: 'primary',
      variant: 'outline',
    });

    const danger = mount(BaseButton, {
      props: { variant: 'danger', size: 'small', text: '删除' },
    });
    expect(danger.getComponent({ name: 'TDesignStub' }).props()).toMatchObject({
      size: 'small',
      theme: 'danger',
      variant: 'base',
    });
    expect(danger.text()).toContain('删除');

    const dangerGhost = mount(BaseButton, {
      props: { variant: 'danger-ghost', text: '立论' },
    });
    expect(dangerGhost.getComponent({ name: 'TDesignStub' }).props()).toMatchObject({
      theme: 'danger',
      variant: 'outline',
    });
  });

  it('keeps ghost active feedback on readable semantic colors', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/BaseButton.vue'),
      'utf8',
    );
    expect(source).toContain(
      '--td-button-primary-outline-active-bg-color: var(--accent-subtle-color);',
    );
    expect(source).toContain(
      '--td-button-primary-outline-active-border-color: var(--accent-color);',
    );
    expect(source).toContain(
      '.base-button--ghost.t-button--outline.t-button--primary.t-button--hover',
    );
    expect(source).toContain('color: var(--text-color);');
  });

  it('keeps soft and fog button foregrounds distinct from their light backgrounds', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/BaseButton.vue'),
      'utf8',
    );
    expect(source).toContain('--td-button-primary-color: var(--text-color);');
    expect(source).toContain('--td-button-primary-bg-color: var(--accent-subtle-color);');
    expect(source).toContain('--td-brand-color: var(--text-secondary-color);');
    expect(source).toContain(
      '--td-button-primary-outline-color: var(--text-secondary-color);',
    );
    expect(source).toContain(
      '.base-button--ghost.base-button--look-fog {\n  background: var(--surface-subtle-color);',
    );
    expect(source).not.toContain('--td-button-primary-outline-active-color:');
  });

  it('emits click on tap but not when disabled or loading', async () => {
    const wrapper = mount(BaseButton);
    wrapper.getComponent({ name: 'TDesignStub' }).vm.$emit('click', { detail: {} });
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('click')).toHaveLength(1);

    const disabled = mount(BaseButton, { props: { disabled: true } });
    disabled.getComponent({ name: 'TDesignStub' }).vm.$emit('click');
    await disabled.vm.$nextTick();
    expect(disabled.emitted('click')).toBeUndefined();

    const loading = mount(BaseButton, { props: { loading: true } });
    loading.getComponent({ name: 'TDesignStub' }).vm.$emit('click');
    await loading.vm.$nextTick();
    expect(loading.emitted('click')).toBeUndefined();
  });

  it('applies user-selected looks and effects to primary and ghost only', async () => {
    const wrapper = mount(BaseButton, { slots: { default: '装一罐' } });
    wrapper.vm.handleThemeChange({
      primaryLook: 'outline',
      ghostLook: 'soft',
      effect: 'glow',
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.getComponent({ name: 'TDesignStub' }).props('variant')).toBe('outline');
    expect(wrapper.vm.rootClass).toEqual(expect.arrayContaining([
      'base-button--primary',
      'base-button--look-outline',
      'base-button--effect-glow',
    ]));

    const ghost = mount(BaseButton, { props: { variant: 'ghost' } });
    ghost.vm.handleThemeChange({
      primaryLook: 'classic',
      ghostLook: 'filled',
      effect: 'lift',
    });
    await ghost.vm.$nextTick();
    expect(ghost.getComponent({ name: 'TDesignStub' }).props('variant')).toBe('base');
    expect(ghost.vm.rootClass).toEqual(expect.arrayContaining([
      'base-button--ghost',
      'base-button--look-filled',
      'base-button--effect-lift',
    ]));

    const danger = mount(BaseButton, { props: { variant: 'danger', text: '退出' } });
    danger.vm.handleThemeChange({
      buttonStyle: 'outline',
      primaryLook: 'outline',
      effect: 'glow',
    });
    await danger.vm.$nextTick();
    expect(danger.getComponent({ name: 'TDesignStub' }).props()).toMatchObject({
      theme: 'danger',
      variant: 'base',
    });
    expect(danger.vm.rootClass).not.toEqual(expect.arrayContaining([
      'base-button--look-outline',
      'base-button--effect-glow',
    ]));
  });
});

describe('BaseField', () => {
  it('provides a safe per-field form relation when used standalone', () => {
    const wrapper = mount(BaseField, {
      props: { name: 'keyword', label: '关键词' },
    });
    const relation = wrapper.vm.standaloneFormRelation;
    const child = { name: 'keyword' };

    expect(relation).toMatchObject({
      data: {},
      formData: {},
      rules: {},
    });
    relation.registerChild(child);
    expect(relation.children).toEqual([child]);
    relation.unregisterChild('keyword');
    expect(relation.children).toEqual([]);
  });

  it('wraps a picker trigger without rendering an extra text input', () => {
    const wrapper = mount(BaseField, {
      props: { name: 'dialect', label: '方言点', error: '请选择方言点' },
      slots: { default: '<div class="dialect-trigger">选择方言</div>' },
    });
    expect(wrapper.find('.dialect-trigger').exists()).toBe(true);
    expect(wrapper.findAllComponents({ name: 'TDesignStub' })).toHaveLength(1);
    expect(wrapper.find('.base-field-error').text()).toBe('请选择方言点');
  });

  it('preserves completion icons while server errors take precedence over success', async () => {
    const suffixIcon = { name: 'check-circle-filled' };
    const wrapper = mount(BaseField, {
      props: { name: 'concept', status: 'success', suffixIcon, error: '概念有误' },
    });
    const input = wrapper.findAllComponents({ name: 'TDesignStub' })[1];
    expect(input.attributes('status')).toBeUndefined();
    expect(input.vm.$attrs.status).toBe('error');
    expect(input.vm.$attrs['suffix-icon']).toEqual(suffixIcon);

    await wrapper.setProps({ error: '' });
    expect(input.vm.$attrs.status).toBe('success');
    expect(input.vm.$attrs['suffix-icon']).toEqual(suffixIcon);
  });

  it('renders label, required mark and error text', () => {
    const wrapper = mount(BaseField, {
      props: {
        name: 'nickname',
        label: '昵称',
        required: true,
        error: '昵称不能为空',
      },
    });

    const formItem = wrapper.findAllComponents({ name: 'TDesignStub' })[0];
    expect(formItem.props('label')).toBe('昵称');
    expect(formItem.props('requiredMark')).toBe(true);
    expect(wrapper.find('.base-field-error').text()).toBe('昵称不能为空');
    expect(wrapper.findAllComponents({ name: 'TDesignStub' })).toHaveLength(2);
  });

  it('keeps field semantics with a custom picker control instead of rendering an input', () => {
    const wrapper = mount(BaseField, {
      props: { name: 'dialect_id', label: '方言点', help: '请选择当地记录', required: true },
      slots: { default: '<div class="custom-control">闽语 · 莆仙片</div>' },
    });
    expect(wrapper.findAllComponents({ name: 'TDesignStub' })).toHaveLength(1);
    expect(wrapper.getComponent({ name: 'TDesignStub' }).props()).toMatchObject({
      name: 'dialect_id', label: '方言点', help: '请选择当地记录', requiredMark: true,
    });
    expect(wrapper.get('.custom-control').text()).toBe('闽语 · 莆仙片');
  });

  it('uses textarea and emits v-model updates on input', async () => {
    const wrapper = mount(BaseField, {
      props: { name: 'definition', type: 'textarea', modelValue: '' },
    });

    const textarea = wrapper.findAllComponents({ name: 'TDesignStub' })[1];
    textarea.vm.$emit('change', { detail: { value: '词条释义' } });
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['词条释义']);
    expect(wrapper.emitted('input')[0]).toEqual(['词条释义']);
  });

  it('forwards confirm from the text input', async () => {
    const wrapper = mount(BaseField, {
      props: { name: 'keyword', modelValue: '川渝', confirmType: 'search' },
    });
    const input = wrapper.findAllComponents({ name: 'TDesignStub' })[1];
    input.vm.$emit('confirm', { detail: { value: '川渝' } });
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('confirm')[0]).toEqual(['川渝']);
  });

  it('forwards TDesign enter events while keeping confirm compatibility', async () => {
    const wrapper = mount(BaseField, {
      props: {
        name: 'search',
        confirmType: 'search',
        focus: true,
        ariaRole: 'searchbox',
        ariaLabel: '搜索',
      },
    });
    const input = wrapper.findAllComponents({ name: 'TDesignStub' })[1];

    expect(input.props('ariaLabel')).toBe('搜索');
    expect(input.vm.$attrs.focus).toBe(true);
    expect(input.vm.$attrs['confirm-type']).toBe('search');
    expect(input.vm.$attrs['aria-role']).toBe('searchbox');
    input.vm.$emit('enter', { value: '月亮' });
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('enter')).toHaveLength(1);
    expect(wrapper.emitted('confirm')).toHaveLength(1);
  });
});

describe('TDesign infrastructure primitives', () => {
  it('forwards form methods and defaults to top labels', async () => {
    const wrapper = mount(BaseForm, { props: { data: { nickname: '' } } });
    const form = wrapper.getComponent({ name: 'TDesignStub' });
    form.vm.validate = vi.fn(() => Promise.resolve(true));

    expect(form.props('data')).toEqual({ nickname: '' });
    await expect(wrapper.vm.validate()).resolves.toBe(true);
    expect(form.vm.validate).toHaveBeenCalledOnce();
  });

  it('renders loading only while active', async () => {
    const wrapper = mount(BaseLoading, { props: { loading: false } });
    expect(wrapper.findComponent({ name: 'TDesignStub' }).exists()).toBe(false);
    await wrapper.setProps({ loading: true, text: '载入方言' });
    expect(wrapper.getComponent({ name: 'TDesignStub' }).props('text')).toBe('载入方言');
  });

  it('keeps the existing empty-state action contract', () => {
    const wrapper = mount(EmptyState, {
      props: { title: '还没有内容', actionText: '去创建' },
    });
    const empty = wrapper.findAllComponents({ name: 'TDesignStub' })[0];
    const button = wrapper.getComponent(BaseButton);

    expect(empty.props('icon')).toBe('');
    button.vm.$emit('click');
    expect(wrapper.emitted('action')).toHaveLength(1);
  });

  it('keeps empty states content-first with shared spacing tokens', () => {
    const emptySource = readFileSync(
      resolve(process.cwd(), 'src/components/EmptyState.vue'),
      'utf8',
    );
    const tokenSource = readFileSync(
      resolve(process.cwd(), 'src/styles/tokens.scss'),
      'utf8',
    );

    expect(emptySource).not.toContain('icon="info-circle"');
    expect(tokenSource).toContain('--td-empty-description-margin-top: 0;');
    expect(tokenSource).toContain('--td-empty-action-margin-top: var(--space-3);');
  });
});

describe('confirmDialog', () => {
  beforeEach(() => {
    // eslint-disable-next-line no-undef
    globalThis.uni = { showModal: vi.fn() };
  });

  it('resolves true when the user confirms', async () => {
    uni.showModal.mockImplementation(({ success }) => success({ confirm: true }));
    await expect(confirmDialog({ title: '删除录音？' })).resolves.toBe(true);
    expect(uni.showModal.mock.calls[0][0].title).toBe('删除录音？');
    expect(uni.showModal.mock.calls[0][0].confirmColor).toBeUndefined();
  });

  it('resolves false when the user cancels or the modal fails', async () => {
    uni.showModal.mockImplementation(({ success }) => success({ confirm: false }));
    await expect(confirmDialog()).resolves.toBe(false);

    uni.showModal.mockImplementation(({ fail }) => fail(new Error('denied')));
    await expect(confirmDialog()).resolves.toBe(false);
  });

  it('applies the danger confirm color for destructive actions', async () => {
    uni.showModal.mockImplementation(({ success }) => success({ confirm: true }));
    await confirmDialog({ danger: true });
    expect(uni.showModal.mock.calls[0][0].confirmColor).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
