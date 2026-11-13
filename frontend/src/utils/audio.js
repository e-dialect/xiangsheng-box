import { markRaw, toRaw } from 'vue';

let currentAudioContext = null;
let managedHandle = null;
let preloadContext = null;

const MANAGED_THROTTLE_MS = 200;

/* 受控句柄被外部停止或置换时通知订阅者复位本地播放态。 */
const externalStopListeners = new Set();

/* 广播携带被停止的句柄：订阅者据此识别停止归属，忽略不属于自己的停止 */
function notifyExternalStop(stoppedHandle) {
  externalStopListeners.forEach((listener) => {
    try {
      listener(stoppedHandle);
    } catch (error) {
      /* 单个订阅者异常不应阻断其他订阅者的状态复位 */
    }
  });
}

/**
 * 订阅「外部停止」广播：受控句柄被 stopAudio / playAudio / playManaged
 * 等外部路径停止或置换时触发（自然播完/报错走句柄自身回调，不广播）。
 * 回调收到被停止的句柄：订阅方应记录自己持有的句柄，忽略不属于自己的停止，
 * 否则自己发起的置换播放会被旧句柄的停止广播误复位；未携带句柄时无条件复位。
 * 订阅方只应复位本地展示态，回调内不得再调 stopAudio，避免递归。
 * 返回取消订阅函数。
 */
export function onExternalStop(callback) {
  if (typeof callback !== 'function') return () => {};
  externalStopListeners.add(callback);
  return () => {
    externalStopListeners.delete(callback);
  };
}

export function offExternalStop(callback) {
  externalStopListeners.delete(callback);
}

function disposeManagedHandle() {
  if (!managedHandle) return;
  const handle = managedHandle;
  managedHandle = null;
  handle.destroy();
  /* destroy 不触发任何句柄回调，改由广播通知订阅者复位，并携带被停止句柄供归属识别 */
  notifyExternalStop(handle);
}

function releasePreload() {
  if (!preloadContext) return;
  const context = preloadContext;
  preloadContext = null;
  context.destroy();
}

/**
 * 释放预缓冲句柄（页面 onHide/onUnload 回收路径使用）。
 */
export function releasePreloadAudio() {
  releasePreload();
}

function stopCurrentAudio() {
  disposeManagedHandle();
  if (!currentAudioContext) return;
  const context = currentAudioContext;
  // 先解除归属，防止 stop/destroy 触发的旧回调影响后续播放或重入清理。
  currentAudioContext = null;
  context.stop();
  if (typeof context.destroy === 'function') {
    context.destroy();
  }
}

export function playAudio(src, warn = true) {
  if (!src || src === 'null') {
    if (warn) {
      uni.showToast({
        title: '不是一个可用文件',
        icon: 'error',
      });
    }
    return;
  }

  stopCurrentAudio();
  uni.showToast({
    title: '正在播放...',
    icon: 'none',
  });
  // #ifdef H5
  const audioElement = new Audio(src);
  let webAudioContext = null;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const resolvedUrl = new URL(src, window.location.href);
    const canUseWebAudio = AudioContextClass
      && (resolvedUrl.origin === window.location.origin || resolvedUrl.protocol === 'blob:');
    if (canUseWebAudio) {
      webAudioContext = new AudioContextClass();
      const source = webAudioContext.createMediaElementSource(audioElement);
      source.connect(webAudioContext.destination);
    }
  } catch (error) {
    webAudioContext = null;
  }
  const webPlayback = {
    stop() {
      audioElement.pause();
      audioElement.currentTime = 0;
    },
    destroy() {
      // 先置空事件回调再清 src，避免清源触发的异步迟到 error
      // 误杀后续受控播放并弹出误导性 toast。
      audioElement.onerror = null;
      audioElement.onended = null;
      audioElement.src = '';
      if (webAudioContext && typeof webAudioContext.close === 'function') {
        webAudioContext.close();
      }
    },
  };
  currentAudioContext = webPlayback;
  audioElement.onerror = () => {
    if (currentAudioContext !== webPlayback) return;
    uni.showToast({ title: '播放失败', icon: 'none' });
    stopCurrentAudio();
  };
  audioElement.onended = () => {
    if (currentAudioContext === webPlayback) stopCurrentAudio();
  };
  const playPromise = audioElement.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {
      if (currentAudioContext !== webPlayback) return;
      uni.showToast({ title: '播放失败', icon: 'none' });
      stopCurrentAudio();
    });
  }
  // #endif

  // #ifndef H5
  const innerAudioContext = uni.createInnerAudioContext();
  currentAudioContext = innerAudioContext;
  innerAudioContext.onError(() => {
    if (currentAudioContext !== innerAudioContext) return;
    uni.showToast({
      title: '播放失败',
      icon: 'none',
    });
    stopCurrentAudio();
  });
  innerAudioContext.onEnded(() => {
    if (currentAudioContext === innerAudioContext) {
      currentAudioContext = null;
      innerAudioContext.destroy();
    }
  });

  innerAudioContext.src = src;
  innerAudioContext.play();
  // #endif
}

/** Stop only the managed playback owned by this caller, without touching preload. */
export function stopManagedAudio(expectedHandle) {
  if (!expectedHandle || toRaw(expectedHandle) !== managedHandle) return;
  disposeManagedHandle();
}

export function stopAudio() {
  stopCurrentAudio();
  // 页面 onHide/onUnload 调 stopAudio 时一并回收预缓冲句柄。
  releasePreload();
}

/**
 * 事件化受控播放（首页沉浸流 Issue #192 使用）。
 *
 * 与 playAudio 的区别：
 * - 不弹「正在播放...」toast，播放状态由调用方自行呈现；
 * - 返回受控句柄，回调 onEnded/onTimeUpdate/onError；
 * - 全局互斥：调用时会停掉任何其他播放（含旧 API），
 *   playAudio/stopAudio 也会停掉受控播放；
 * - onTimeUpdate 回调按约 200ms 节流。
 */
function createWebManaged(src, { onEnded, onTimeUpdate, onError }) {
  const audioElement = new Audio(src);
  audioElement.preload = 'auto';
  let lastEmitAt = 0;
  let handle = null;
  const handleTimeUpdate = () => {
    if (managedHandle !== handle) return;
    const now = Date.now();
    if (now - lastEmitAt < MANAGED_THROTTLE_MS) return;
    lastEmitAt = now;
    if (onTimeUpdate) {
      onTimeUpdate({
        currentTime: audioElement.currentTime || 0,
        duration: audioElement.duration || 0,
      });
    }
  };
  const handleEnded = () => {
    if (managedHandle !== handle) return;
    managedHandle = null;
    handle.destroy();
    if (onEnded) onEnded();
  };
  const handleError = () => {
    if (managedHandle !== handle) return;
    managedHandle = null;
    handle.destroy();
    if (onError) onError(new Error('playback failed'));
  };
  audioElement.addEventListener('timeupdate', handleTimeUpdate);
  audioElement.addEventListener('ended', handleEnded);
  audioElement.addEventListener('error', handleError);
  handle = {
    src,
    stop() {
      audioElement.pause();
      audioElement.currentTime = 0;
    },
    destroy() {
      audioElement.pause();
      audioElement.removeEventListener('timeupdate', handleTimeUpdate);
      audioElement.removeEventListener('ended', handleEnded);
      audioElement.removeEventListener('error', handleError);
      audioElement.src = '';
    },
  };
  const playPromise = audioElement.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => handleError());
  }
  return handle;
}

function createNativeManaged(src, { onEnded, onTimeUpdate, onError }) {
  const innerAudioContext = uni.createInnerAudioContext();
  let lastEmitAt = 0;
  let handle = null;
  innerAudioContext.onTimeUpdate(() => {
    if (managedHandle !== handle) return;
    const now = Date.now();
    if (now - lastEmitAt < MANAGED_THROTTLE_MS) return;
    lastEmitAt = now;
    if (onTimeUpdate) {
      onTimeUpdate({
        currentTime: innerAudioContext.currentTime || 0,
        duration: innerAudioContext.duration || 0,
      });
    }
  });
  innerAudioContext.onEnded(() => {
    if (managedHandle !== handle) return;
    managedHandle = null;
    handle.destroy();
    if (onEnded) onEnded();
  });
  innerAudioContext.onError(() => {
    if (managedHandle !== handle) return;
    managedHandle = null;
    handle.destroy();
    if (onError) onError(new Error('playback failed'));
  });
  handle = {
    src,
    stop() {
      innerAudioContext.stop();
    },
    destroy() {
      innerAudioContext.destroy();
    },
  };
  innerAudioContext.src = src;
  innerAudioContext.play();
  return handle;
}

export function playManaged(src, callbacks = {}) {
  if (!src || src === 'null') {
    if (callbacks.onError) callbacks.onError(new Error('invalid audio source'));
    return null;
  }

  stopCurrentAudio();

  let handle = null;
  // #ifdef H5
  handle = createWebManaged(src, callbacks);
  // #endif
  // #ifndef H5
  handle = createNativeManaged(src, callbacks);
  // #endif
  // 组件把句柄放入响应式 data 后仍需按同一身份识别外部停止广播。
  managedHandle = markRaw(handle);
  return handle;
}

/**
 * 预缓冲下一罐音频（最多保留 1 个，新的会顶掉旧的）。
 */
export function preload(src) {
  if (!src || src === 'null') return;
  if (managedHandle && managedHandle.src === src) return;
  releasePreload();

  // #ifdef H5
  const audioElement = new Audio();
  audioElement.preload = 'auto';
  audioElement.src = src;
  preloadContext = {
    src,
    destroy() {
      audioElement.src = '';
    },
  };
  // #endif

  // #ifndef H5
  const innerAudioContext = uni.createInnerAudioContext();
  innerAudioContext.src = src;
  preloadContext = {
    src,
    destroy() {
      innerAudioContext.destroy();
    },
  };
  // #endif
}
