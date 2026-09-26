<template>
  <t-button
    class="base-button"
    :class="rootClass"
    role="button"
    :tabindex="disabled ? -1 : 0"
    :aria-disabled="disabled || loading ? 'true' : 'false'"
    :theme="tdTheme"
    :variant="tdVariant"
    :size="size"
    :shape="resolvedShape"
    :icon="icon"
    :block="block"
    :disabled="disabled"
    :loading="loading"
    :type="type || undefined"
    :open-type="openType || undefined"
    v-bind="buttonA11y"
    @click="handleClick"
    @tap="handleClick"
  >
    <slot>{{ text }}</slot>
  </t-button>
</template>

<script>
import TButton from '@tdesign/uniapp/button/button.vue';
import {
  FILL_GHOST_LOOKS,
  getEffectPreference,
  getGhostLookPreference,
  getPrimaryLookPreference,
  OUTLINE_PRIMARY_LOOKS,
  RECT_PRIMARY_LOOKS,
} from '@/services/theme';

export default {
  name: 'BaseButton',
  components: { TButton },
  props: {
    variant: {
      type: String,
      default: 'primary',
      validator: (value) => ['primary', 'ghost', 'danger', 'danger-ghost', 'light'].includes(value),
    },
    size: {
      type: String,
      default: 'medium',
      validator: (value) => ['extra-small', 'small', 'medium', 'large'].includes(value),
    },
    text: { type: String, default: '' },
    icon: { type: [String, Object], default: '' },
    ariaLabel: { type: String, default: '' },
    block: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    shape: {
      type: String,
      default: 'round',
      validator: (value) => ['rectangle', 'square', 'round', 'circle'].includes(value),
    },
    type: {
      type: String,
      default: '',
      validator: (value) => ['', 'submit', 'reset'].includes(value),
    },
    openType: {
      type: String,
      default: '',
      validator: (value) => ['', 'share'].includes(value),
    },
  },
  emits: ['click'],
  data() {
    return {
      primaryLook: getPrimaryLookPreference(),
      ghostLook: getGhostLookPreference(),
      effect: getEffectPreference(),
      emittingClick: false,
    };
  },
  computed: {
    isPrimary() {
      return this.variant === 'primary';
    },
    isGhost() {
      return this.variant === 'ghost';
    },
    activeLook() {
      if (this.isPrimary) return this.primaryLook;
      if (this.isGhost) return this.ghostLook;
      return '';
    },
    tdTheme() {
      if (this.variant === 'light') return 'light';
      return this.variant.startsWith('danger') ? 'danger' : 'primary';
    },
    tdVariant() {
      if (this.variant === 'danger-ghost') return 'outline';
      if (this.isGhost) return FILL_GHOST_LOOKS.has(this.ghostLook) ? 'base' : 'outline';
      if (this.isPrimary && OUTLINE_PRIMARY_LOOKS.has(this.primaryLook)) return 'outline';
      return 'base';
    },
    resolvedShape() {
      if (this.isPrimary && RECT_PRIMARY_LOOKS.has(this.primaryLook)) return 'rectangle';
      if (this.isGhost && ['classic', 'seal', 'solemn'].includes(this.ghostLook)) return 'rectangle';
      return this.shape;
    },
    rootClass() {
      return [
        `base-button--${this.variant}`,
        `base-button--${this.size}`,
        this.activeLook ? `base-button--look-${this.activeLook}` : '',
        this.effectClass,
        { 'base-button--block': this.block },
      ];
    },
    resolvedAriaLabel() {
      return this.ariaLabel || this.text || undefined;
    },
    buttonA11y() {
      return this.resolvedAriaLabel ? { 'aria-label': this.resolvedAriaLabel } : {};
    },
    followsEffect() {
      return this.isPrimary || this.isGhost;
    },
    effectClass() {
      if (!this.followsEffect || this.effect === 'none') return '';
      return `base-button--effect-${this.effect}`;
    },
  },
  mounted() {
    if (typeof uni !== 'undefined' && typeof uni.$on === 'function') {
      uni.$on('theme-change', this.handleThemeChange);
    }
  },
  beforeUnmount() {
    if (typeof uni !== 'undefined' && typeof uni.$off === 'function') {
      uni.$off('theme-change', this.handleThemeChange);
    }
  },
  methods: {
    handleThemeChange(theme) {
      this.primaryLook = theme?.primaryLook || theme?.buttonStyle || getPrimaryLookPreference();
      this.ghostLook = theme?.ghostLook || getGhostLookPreference();
      this.effect = theme?.effect || getEffectPreference();
    },
    handleClick(event) {
      if (this.disabled || this.loading || this.emittingClick) return;
      this.emittingClick = true;
      this.$emit('click', event);
      this.$nextTick(() => {
        this.emittingClick = false;
      });
    },
  },
};
</script>

<style scoped>
.base-button {
  pointer-events: auto;
  --td-button-border-radius: var(--dress-button-border-radius, var(--radius-pill));
}

.base-button--ghost {
  --td-button-primary-outline-active-bg-color: var(--accent-subtle-color);
  --td-button-primary-outline-active-border-color: var(--accent-color);
}

/*
 * TDesign reuses the active border token as the active outline text color.
 * Some light accent palettes (notably osmanthus and clay) do not reach WCAG AA
 * when that accent is drawn on its subtle background, so keep the border as
 * the selected accent while using the semantic page text color for the label.
 */
.base-button--ghost.t-button--outline.t-button--primary.t-button--hover {
  color: var(--text-color);
}

.base-button--look-soft {
  --td-brand-color: var(--accent-subtle-color);
  --td-brand-color-active: var(--accent-subtle-color);
  --td-text-color-anti: var(--text-color);
  --td-button-primary-color: var(--text-color);
  --td-button-primary-bg-color: var(--accent-subtle-color);
}

.base-button--look-contrast {
  --td-button-border-radius: var(--radius-md);
  --td-brand-color: var(--text-color);
  --td-brand-color-active: var(--text-color);
  --td-text-color-anti: var(--page-color);
}

.base-button--look-solemn {
  --td-button-border-radius: var(--radius-sm);
  --td-brand-color: var(--text-color);
  --td-brand-color-active: var(--text-color);
  --td-text-color-anti: var(--page-color);
  letter-spacing: 0.1em;
}

.base-button--look-classic {
  --td-button-border-radius: var(--radius-sm);
  letter-spacing: 0.12em;
  box-shadow:
    inset 0 0 0 1px var(--accent-color),
    0 0 0 3px var(--surface-color),
    0 0 0 4px var(--accent-subtle-color);
}

.base-button--look-ardent {
  letter-spacing: 0.04em;
  box-shadow: 0 8rpx 22rpx var(--accent-subtle-color);
}

.base-button--look-fresh {
  --td-brand-color: var(--accent-subtle-color);
  --td-brand-color-active: var(--surface-subtle-color);
  --td-text-color-anti: var(--text-color);
  --td-button-primary-color: var(--text-color);
  --td-button-primary-bg-color: var(--accent-subtle-color);
  --td-button-primary-active-bg-color: var(--surface-subtle-color);
  --td-button-primary-active-border-color: var(--border-color);
  --td-button-primary-outline-color: var(--text-color);
  --td-button-primary-outline-border-color: var(--accent-color);
  --td-button-primary-outline-active-bg-color: var(--surface-subtle-color);
  --td-button-primary-outline-active-border-color: var(--text-color);
  --td-button-border-radius: var(--radius-pill);
}

.base-button--look-seal {
  --td-button-border-radius: var(--radius-sm);
  letter-spacing: 0.14em;
  box-shadow: inset 0 0 0 3rpx var(--on-accent-color);
}

.base-button--look-gilt {
  --td-button-border-radius: var(--radius-sm);
  box-shadow:
    inset 0 0 0 1px var(--gilt-color),
    0 0 0 1px var(--accent-subtle-color);
}

.base-button--look-wash {
  --td-brand-color: var(--accent-subtle-color);
  --td-brand-color-active: var(--surface-subtle-color);
  --td-text-color-anti: var(--text-color);
  --td-button-primary-outline-color: var(--text-color);
  --td-button-primary-outline-border-color: var(--border-color);
  --td-button-primary-outline-active-bg-color: var(--surface-subtle-color);
  --td-button-primary-outline-active-border-color: var(--text-color);
}

.base-button--look-fog {
  --td-brand-color: var(--text-secondary-color);
  --td-brand-color-active: var(--text-color);
  --td-text-color-anti: var(--text-secondary-color);
  --td-button-primary-outline-color: var(--text-secondary-color);
  --td-button-primary-outline-border-color: var(--border-color);
  box-shadow: inset 0 0 0 1px var(--border-color);
}

.base-button--ghost.base-button--look-filled {
  --td-brand-color: var(--accent-subtle-color);
  --td-brand-color-active: var(--surface-subtle-color);
  --td-text-color-anti: var(--text-color);
  --td-button-primary-color: var(--text-color);
  --td-button-primary-bg-color: var(--accent-subtle-color);
  --td-button-primary-border-color: var(--accent-subtle-color);
  --td-button-primary-active-bg-color: var(--surface-subtle-color);
  --td-button-primary-active-border-color: var(--border-color);
}

.base-button--ghost.base-button--look-quiet {
  opacity: 0.86;
}

.base-button--ghost.base-button--look-ardent {
  box-shadow: 0 8rpx 20rpx var(--accent-subtle-color);
}

.base-button--ghost.base-button--look-fresh {
  opacity: 0.94;
}

.base-button--ghost.base-button--look-fog {
  background: var(--surface-subtle-color);
}

.base-button--ghost.base-button--look-wash {
  --td-brand-color: var(--accent-subtle-color);
  --td-text-color-anti: var(--text-secondary-color);
}

.base-button--ghost.base-button--look-gilt {
  color: var(--gilt-color);
  box-shadow: inset 0 0 0 2rpx var(--gilt-color);
}

.base-button--effect-glow {
  box-shadow: 0 0 18rpx var(--accent-subtle-color);
}

.base-button--effect-lift {
  box-shadow: 0 12rpx 24rpx var(--border-color);
}

.base-button--effect-gilt {
  box-shadow: 0 0 0 3rpx var(--gilt-color);
}

.base-button--effect-ink {
  text-shadow: 2rpx 2rpx 0 var(--accent-subtle-color);
}

.base-button--effect-bloom {
  box-shadow: 0 0 36rpx var(--accent-subtle-color), 0 8rpx 20rpx var(--border-color);
}

.base-button--effect-press:active {
  opacity: 0.72;
  transform: scale(0.96);
}

.base-button--effect-pulse {
  animation: button-pulse 1.8s ease-in-out infinite;
}

@keyframes button-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 var(--accent-subtle-color);
  }

  50% {
    box-shadow: 0 0 0 10rpx var(--accent-subtle-color);
  }
}

@media (prefers-reduced-motion: reduce) {
  .base-button--effect-pulse {
    animation: none;
  }

  .base-button--effect-press:active {
    transform: none;
  }
}
</style>
