/**
 * 复制数据到剪切板
 * @param data{string} 复制文本
 * @param quiet{boolean} 无需提示
 * @param onSuccess{Function} 复制成功后的可选回调
 */
export function setClipboard(data, quiet = false, onSuccess = undefined) {
  const fail = () => {
    uni.showToast({ title: '复制失败', icon: 'none' });
  };
  try {
    uni.setClipboardData({
      data,
      success() {
        if (typeof onSuccess === 'function') onSuccess();
        if (!quiet) {
          uni.showToast({
            title: '已复制',
            icon: 'none',
          });
        }
      },
      fail,
    });
  } catch {
    fail();
  }
}

/**
 * 安静地设置剪切板
 * @param data{string} 数据
 * @param onSuccess{Function} 复制成功后的可选回调
 */
export function setClipboardQuiet(data, onSuccess) {
  setClipboard(data, true, onSuccess);
}
