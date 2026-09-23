<template>
  <view class="base-field">
    <t-form-item
      class="base-field-item"
      :name="name"
      :label="label"
      :help="help"
      :required-mark="required"
      :rules="rules"
      label-align="top"
    >
      <view class="base-field-control">
        <slot>
          <t-textarea
            v-if="type === 'textarea'"
            :value="modelValue"
            :placeholder="placeholder"
            :maxlength="maxlength"
            :disabled="disabled"
            :readonly="readonly"
            :focus="focus"
            :confirm-type="confirmType"
            :autosize="resolvedAutosize"
            :indicator="indicator"
            :adjust-position="adjustPosition"
            bordered
            @change="handleChange"
            @blur="$emit('blur', $event)"
            @focus="$emit('focus', $event)"
            @enter="handleEnter"
          />
          <t-input
            v-else
            :value="modelValue"
            :aria-role="ariaRole || undefined"
            :aria-label="ariaLabel || undefined"
            :type="inputType"
            :placeholder="placeholder"
            :maxlength="maxlength"
            :disabled="disabled"
            :readonly="readonly"
            :focus="focus"
            :confirm-type="confirmType"
            :clearable="clearable"
            :status="error ? 'error' : status"
            :suffix-icon="suffixIcon"
            :adjust-position="adjustPosition"
            borderless
            @change="handleChange"
            @confirm="handleConfirm"
            @blur="$emit('blur', $event)"
            @focus="$emit('focus', $event)"
            @enter="handleEnter"
          />
        </slot>
      </view>
    </t-form-item>
    <view
      v-if="error"
      class="base-field-error"
    >
      {{ error }}
    </view>
  </view>
</template>

<script>
import TFormItem from '@tdesign/uniapp/form-item/form-item.vue';
import TInput from '@tdesign/uniapp/input/input.vue';
import TTextarea from '@tdesign/uniapp/textarea/textarea.vue';

const TDESIGN_FORM_RELATION = 'Form';

function createStandaloneFormRelation() {
  return {
    children: [],
    data: {},
    formData: {},
    rules: {},
    labelAlign: 'top',
    labelWidth: '',
    contentAlign: '',
    requiredMark: false,
    showErrorMessage: false,
    requiredMarkPosition: 'left',
    errorMessage: {},
    registerChild(child) {
      if (this.children.some((item) => item.name === child.name)) return;
      this.children = [...this.children, child];
    },
    unregisterChild(childName) {
      this.children = this.children.filter((item) => item.name !== childName);
    },
  };
}

export default {
  name: 'BaseField',
  components: { TFormItem, TInput, TTextarea },
  inject: {
    inheritedFormRelation: {
      from: TDESIGN_FORM_RELATION,
      default: null,
    },
  },
  provide() {
    return {
      [TDESIGN_FORM_RELATION]: this.inheritedFormRelation || this.standaloneFormRelation,
    };
  },
  props: {
    modelValue: { type: [String, Number], default: '' },
    name: { type: String, required: true },
    label: { type: String, default: '' },
    status: {
      type: String,
      default: 'default',
      validator: (value) => ['default', 'success', 'warning', 'error'].includes(value),
    },
    suffixIcon: { type: [String, Object], default: undefined },
    type: {
      type: String,
      default: 'text',
      validator: (value) => ['text', 'textarea', 'number', 'digit', 'password', 'tel'].includes(value),
    },
    placeholder: { type: String, default: '' },
    maxlength: { type: Number, default: -1 },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    rules: { type: Array, default: () => [] },
    help: { type: String, default: '' },
    error: { type: String, default: '' },
    autosize: { type: [Boolean, Object], default: false },
    indicator: { type: Boolean, default: false },
    clearable: { type: Boolean, default: false },
    focus: { type: Boolean, default: false },
    ariaLabel: { type: String, default: '' },
    ariaRole: { type: String, default: '' },
    /* 面板内由容器自行抬升输入区时置 false，避免原生层二次顶起页面。 */
    adjustPosition: { type: Boolean, default: true },
    confirmType: {
      type: String,
      default: 'done',
      validator: (value) => ['return', 'send', 'search', 'next', 'go', 'done'].includes(value),
    },
  },
  emits: ['update:modelValue', 'change', 'input', 'blur', 'focus', 'enter', 'confirm'],
  data() {
    return {
      standaloneFormRelation: createStandaloneFormRelation(),
    };
  },
  computed: {
    inputType() {
      if (this.type === 'tel') return 'number';
      return this.type;
    },
    resolvedAutosize() {
      if (this.autosize) return this.autosize;
      return { minHeight: 80 };
    },
  },
  methods: {
    handleChange(event) {
      const value = event?.detail?.value ?? event?.value ?? event ?? '';
      this.$emit('update:modelValue', value);
      this.$emit('change', value);
      this.$emit('input', value);
    },
    handleConfirm(event) {
      const value = event?.detail?.value ?? event?.value ?? this.modelValue;
      this.$emit('confirm', value);
    },
    handleEnter(event) {
      this.$emit('enter', event);
      this.$emit('confirm', event);
    },
  },
};
</script>

<style scoped>
.base-field {
  width: 100%;
}

.base-field-item {
  --td-form-item-border-color: transparent;
  --td-form-item-horizontal-padding: 0;
  --td-form-item-vertical-padding: var(--space-2);
  --td-input-bg-color: var(--dress-input-box-background, var(--surface-color));
  --td-input-vertical-padding: var(--space-2) var(--space-3);
  --td-textarea-background-color: var(--dress-input-box-background, var(--surface-color));
  --td-textarea-padding: var(--space-2) var(--space-3);
}

.base-field-control {
  width: 100%;
  min-width: 0;
  border:
    var(--dress-input-box-border-width, 0px)
    solid var(--dress-input-box-border-color, transparent);
  border-radius: var(--dress-input-box-border-radius, var(--radius-md));
  overflow: hidden;
}

.base-field-error {
  margin-top: var(--space-1);
  color: var(--danger-color);
  font-size: var(--font-size-xs);
}
</style>
