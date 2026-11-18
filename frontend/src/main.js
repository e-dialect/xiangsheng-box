import { createSSRApp } from 'vue';
import '@tdesign/uniapp/theme.less';
import share from '@/services/shareMessages';
// #ifdef H5
import { syncProductTitle } from '@/services/productProfile';
// #endif
// Api函数polyfill（目前为实验版本，如不需要，可删除！）';
import Polyfill from '@/polyfill/polyfill';

// 全局mixins，用于实现setData等功能，请勿删除！';
import Mixin from '@/polyfill/mixins';
import App from './App.vue';

Polyfill.init();

// 不能修改导出的 createApp 方法名，不能修改从 Vue 中导入的 createSSRApp。
// eslint-disable-next-line import/prefer-default-export
export function createApp() {
  const app = createSSRApp(App);
  app.mixin(Mixin);
  app.mixin(share);
  // #ifdef H5
  app.mixin({
    onShow() {
      // The page router may write its own title in the same navigation.
      setTimeout(syncProductTitle, 0);
    },
  });
  // #endif
  return {
    app,
  };
}
