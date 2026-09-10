<template>
  <PageShell
    class="theme-center-page"
    title="主题中心"
    :back-fallback="ROUTES.mine"
    :intercept-back="navInterceptBack"
    @back="onThemeNavBack"
    @scroll="onShellScroll"
  >
    <view class="center">
      <ThemeCenterDiscoveryView
        :search-form="searchForm"
        :member-syncing="memberSyncing"
        :catalog-stale="catalogStale"
        :catalog-fail="catalogFail"
        :catalog-loading="catalogLoading"
        :searching="searching"
        :hot-keywords="hotKeywords"
        :show-filter-bar="showFilterBar"
        :filter-summary="filterSummary"
        :search-tabs="searchTabs"
        :result-tab="resultTab"
        :search-rows="searchRows"
        :tab="tab"
        :is-grey-entry="isGreyEntry"
        :tag-class="tagClass"
        :theme-preview-vars="themePreviewVars"
        :theme-preview-shot-class="themePreviewShotClass"
        :search-action-variant="searchActionVariant"
        :search-action-disabled="searchActionDisabled"
        :search-action-label="searchActionLabel"
        @acquire="onAcquire"
        @enable-entry="onSearchEnable"
        @exit-search="exitSearch"
        @hot-keyword="onHotKeyword"
        @open-entry="onOpenSearchEntry"
        @open-filter="openFilterSheet"
        @result-tab="onResultTab"
        @retry-catalog="retryCatalog"
        @submit-search="submitThemeSearch"
        @tab-switch="onTabSwitch"
        @update-keyword="onSearchKeywordUpdate"
      />

      <ThemeCenterRecentView
        :visible="!catalogFail && !searching && (tab === 'global' || tab === 'local')"
        :rows="recentRows"
        :theme-cover-src="themeCoverSrc"
        :theme-preview-vars="themePreviewVars"
        :theme-preview-shot-class="themePreviewShotClass"
        :recent-tag-class="recentTagClass"
        @apply="onApplyRecent"
        @open="onRecentTap"
        @preview-error="onPreviewImgError"
      />

      <ThemeCenterGlobalView
        :visible="!catalogFail && !searching && tab === 'global'"
        :active-theme="activeTheme"
        :appearance-options="appearanceOptions"
        :appearance="appearance"
        :themes="visibleThemes"
        :empty-scene="themeListEmptyScene"
        :footer-lines="globalFooterLines"
        :theme-preview-vars="themePreviewVars"
        :theme-preview-shot-class="themePreviewShotClass"
        :theme-cover-src="themeCoverSrc"
        :catalog-badge="catalogBadge"
        :is-grey-theme="isGreyTheme"
        :theme-tags="themeTags"
        :is-item-fav="isItemFav"
        :theme-action-variant="themeActionVariant"
        :theme-action-disabled="themeActionDisabled"
        :theme-action-label="themeActionLabel"
        :stats-of="statsOf"
        @appearance="onAppearance"
        @empty-action="onThemeListEmptyAction"
        @enable="onCardEnable"
        @open-detail="openDetail"
        @preview="onSkinCardPreview"
        @preview-error="onPreviewImgError"
        @share="onShare"
        @toggle-favorite="onToggleFavorite"
      />

      <ThemeCenterLocalView
        :visible="!catalogFail && !searching && tab === 'local'"
        :show-dress-items="showDressItems"
        :dress-items="visibleDressItems"
        :groups="dressGroups"
        :is-grey-entry="isGreyEntry"
        :tag-class="tagClass"
        :search-action-variant="searchActionVariant"
        :search-action-disabled="searchActionDisabled"
        :search-action-label="searchActionLabel"
        @clear-filters="onClearAppliedFilters"
        @enable-entry="onSearchEnable"
        @open-dress="onOpenDress"
        @open-entry="onOpenSearchEntry"
        @open-mine="onTabSwitch('mine')"
      />

      <ThemeCenterFavoritesView
        :visible="!catalogFail && !searching && tab === 'favorites'"
        :filters="favoriteFilters"
        :filter="favoriteFilter"
        :entries="favoriteEntries"
        :tag-class="tagClass"
        :stats-of="statsOf"
        :action-variant="favoriteVariant"
        :action-disabled="favoriteDisabled"
        :action-label="favoriteActionLabel"
        @empty-action="onFavoriteEmptyAction"
        @enable="onFavoriteEnable"
        @open="onOpenFavorite"
        @share="onShare"
        @toggle-favorite="onToggleFavorite"
        @update-filter="onFavoriteFilterUpdate"
      />

      <ThemeCenterMineView
        :visible="!catalogFail && !searching && tab === 'mine'"
        :active-theme="activeTheme"
        :theme-tags="themeTags"
        :preview-shot-class="previewShotClass"
        :theme-preview-vars="themePreviewVars"
        :theme-preview-shot-class="themePreviewShotClass"
        :has-applied-dress="hasAppliedDress"
        :applied-dress="appliedDress"
        :dress-tags="dressTags"
        :dress-status="dressStatus"
        :overlay="overlay"
        :saved-outfits="savedOutfits"
        :outfit-theme-preview="outfitThemePreview"
        :outfit-preview-vars="outfitPreviewVars"
        :outfit-preview-shot-class="outfitPreviewShotClass"
        :outfit-summary="outfitSummary"
        :owned-unused="ownedUnused"
        :acquire-offers="acquireOffers"
        :tag-class="tagClass"
        :theme-action-variant="themeActionVariant"
        :theme-action-disabled="themeActionDisabled"
        :dress-action-variant="dressActionVariant"
        :dress-action-disabled="dressActionDisabled"
        :account-sync-note="accountSyncNote"
        @apply-outfit="onApplyOutfit"
        @apply-owned-dress="onApplyOwnedDress"
        @change-theme="onChangeTheme"
        @clear-dress="onClearDress"
        @delete-outfit="onDeleteOutfit"
        @dress-empty="onDressAppliedEmptyAction"
        @dress-offer="onDressOffer"
        @edit-dress="onEditDress"
        @enable-theme="onCardEnable"
        @open-preview="openPreview"
        @open-save-outfit="onOpenSaveOutfit"
        @overlay-change="onOverlayChange"
        @preview-outfit="onPreviewOutfit"
        @rename-outfit="onOpenRenameOutfit"
        @reset-dress="onResetDress"
      />
    </view>

    <ThemeCenterThemeDetail
      :theme="detailTheme"
      :is-mini-program="isMiniProgram"
      :theme-features="themeFeatures"
      :zoom-open="zoomOpen"
      :zoom-hint="zoomHint"
      :is-item-fav="isItemFav"
      :catalog-badge="catalogBadge"
      :theme-preview-vars="themePreviewVars"
      :theme-preview-shot-class="themePreviewShotClass"
      :theme-detail-src="themeDetailSrc"
      :theme-tags="themeTags"
      :stats-of="statsOf"
      :theme-access="themeAccess"
      :can-live-preview-item="canLivePreviewItem"
      :theme-action-variant="themeActionVariant"
      :theme-action-disabled="themeActionDisabled"
      :theme-action-label="themeActionLabel"
      @close="closeDetail"
      @close-zoom="closeZoom"
      @enable="onCardEnable"
      @like="onToggleLike"
      @live-preview="openLivePreview"
      @open-zoom="openZoom"
      @preview-error="onPreviewImgError"
      @share="onShare"
      @toggle-favorite="onToggleFavorite"
    />

    <ThemeLivePreview
      v-if="previewOpen"
      :open="true"
      :title="previewTitle"
      :model="livePreviewModel"
      @cancel="closePreview"
      @apply="onConfirmPreview"
    />

    <ThemeCenterOutfitSheet
      :open="outfitSheet"
      :mode="outfitMode"
      :form="outfitForm"
      :rules="outfitRules"
      :error="outfitError"
      @close="closeOutfitSheet"
      @confirm="onConfirmOutfitSheet"
      @update-name="onOutfitNameUpdate"
    />

    <ThemeCenterFilterSheet
      :open="filterSheet"
      :draft="filterDraft"
      :context="filterContext"
      :access-filters="accessFilters"
      :categories="categories"
      :dress-categories="dressCategories"
      :dialect-regions="dialectRegions"
      :status-filters="statusFilters"
      :sort-options="sortOptions"
      :is-draft-region-on="isDraftRegionOn"
      @close="closeFilterSheet"
      @confirm="onConfirmFilter"
      @reset="onResetFilter"
      @toggle-region="onToggleDraftRegion"
      @update-draft="onFilterDraftUpdate"
    />

    <ThemeCenterMergeSheet
      :open="mergeSheet"
      @choose="onMergeChoice"
    />

    <ThemeShareSheet
      :target="shareTarget"
      :is-mini-program="isMiniProgram"
      @close="shareTarget = null"
    />
  </PageShell>
</template>

<script>
import PageShell from '@/components/PageShell.vue';
import ThemeCenterDiscoveryView from '@/components/theme-center/ThemeCenterDiscoveryView.vue';
import ThemeCenterFavoritesView from '@/components/theme-center/ThemeCenterFavoritesView.vue';
import ThemeCenterFilterSheet from '@/components/theme-center/ThemeCenterFilterSheet.vue';
import ThemeCenterGlobalView from '@/components/theme-center/ThemeCenterGlobalView.vue';
import ThemeCenterLocalView from '@/components/theme-center/ThemeCenterLocalView.vue';
import ThemeCenterMergeSheet from '@/components/theme-center/ThemeCenterMergeSheet.vue';
import ThemeCenterMineView from '@/components/theme-center/ThemeCenterMineView.vue';
import ThemeCenterOutfitSheet from '@/components/theme-center/ThemeCenterOutfitSheet.vue';
import ThemeCenterRecentView from '@/components/theme-center/ThemeCenterRecentView.vue';
import ThemeCenterThemeDetail from '@/components/theme-center/ThemeCenterThemeDetail.vue';
import ThemeLivePreview from '@/components/ThemeLivePreview.vue';
import ThemeShareSheet from '@/components/ThemeShareSheet.vue';
import themeCenterController from '@/pages/users/theme-center/controller';

export default {
  ...themeCenterController,
  components: {
    PageShell,
    ThemeCenterDiscoveryView,
    ThemeCenterFavoritesView,
    ThemeCenterFilterSheet,
    ThemeCenterGlobalView,
    ThemeCenterLocalView,
    ThemeCenterMergeSheet,
    ThemeCenterMineView,
    ThemeCenterOutfitSheet,
    ThemeCenterRecentView,
    ThemeCenterThemeDetail,
    ThemeLivePreview,
    ThemeShareSheet,
  },
};
</script>

<style lang="scss" src="@/components/theme-center/theme-center.scss"></style>
