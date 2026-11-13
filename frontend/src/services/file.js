import { upload } from '@/utils/httpClient';
import { notify } from '@/services/feedback';

/**
 * 上传文件
 * @param file 文件对象（路径）
 * @returns {Promise<unknown>}
 */
export function uploadFile(file) {
  return upload(file);
}

export function supportsAudioFileSelection() {
  let supported = false;
  // #ifdef H5
  supported = typeof uni.chooseFile === 'function';
  // #endif

  // #ifndef H5
  supported = typeof uni.chooseMessageFile === 'function';
  // #endif
  return supported;
}

export function chooseAudioFile() {
  return new Promise((resolve, reject) => {
    const success = (res) => {
      const file = (res.tempFiles && res.tempFiles[0]) || {};
      const path = (res.tempFilePaths && res.tempFilePaths[0]) || file.path || '';
      if (!path) {
        reject(new Error('未选择音频文件'));
        return;
      }
      resolve({
        path,
        name: file.name || path.split('/').pop() || '本地音频',
        size: file.size || 0,
      });
    };
    const fail = (error) => {
      const message = String(error?.errMsg || error?.message || '').trim();
      if (/^(?:choose(?:Message)?File:fail\s*)?(?:user\s+)?cancel(?:led|ed)?$/i.test(message)) {
        resolve(null);
        return;
      }
      reject(error);
    };

    // #ifdef H5
    if (supportsAudioFileSelection()) {
      uni.chooseFile({
        count: 1,
        type: 'all',
        extension: ['.mp3', '.wav', '.m4a'],
        success,
        fail,
      });
      return;
    }
    // #endif

    // #ifndef H5
    if (supportsAudioFileSelection()) {
      uni.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['mp3', 'wav', 'm4a'],
        success,
        fail,
      });
      return;
    }
    // #endif

    reject(new Error('当前环境暂不支持选择本地音频'));
  });
}

/**
 * 选择并上传图片
 * @param maxNumber 最大数量
 * @return{Promise<string[]>} URL 列表
 */
export async function chooseAndUploadImages(maxNumber = 1) {
  const images = await new Promise((resolve) => {
    uni.chooseImage({
      count: maxNumber,
      success: async (res) => {
        try {
          const uploaded = await Promise.all(
            res.tempFilePaths.map((path) => uploadFile(path)),
          );
          resolve(uploaded);
        } catch (error) {
          notify({ title: error.message || '上传失败' });
          resolve([]);
        }
      },
      fail: (err) => {
        notify({ title: err.errMsg || '选择图片失败' });
        resolve([]);
      },
    });
  });
  return images.map((item) => item.url);
}

/**
 * 选择并上传一张图片
 * @returns {Promise<string>} 图片的 url
 */
export async function chooseAndUploadAnImage() {
  const images = await chooseAndUploadImages(1);
  return images[0];
}
