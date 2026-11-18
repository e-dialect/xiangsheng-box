import { BASE_URL } from '@/const/urls';

export default async function privateRecordingAudio(assetId) {
  if (!/^[a-f0-9-]{36}$/i.test(assetId)) throw new Error('无效的录音');
  const token = uni.getStorageSync('token');
  if (!token) throw new Error('请登录后试听');
  // Send credentials only to our API, never to an audio URL in the record.
  const url = `${BASE_URL}/files/recording-media/${assetId}/`;
  const header = { Authorization: `Bearer ${token}` };

  let audio;
  // #ifdef H5
  const response = await fetch(url, { headers: header, cache: 'no-store' });
  if (!response.ok) throw new Error('录音暂不可用');
  const source = URL.createObjectURL(await response.blob());
  audio = { source, release: () => URL.revokeObjectURL(source) };
  // #endif

  // #ifndef H5
  const result = await uni.downloadFile({ url, header });
  if (result.statusCode !== 200) throw new Error('录音暂不可用');
  audio = {
    source: result.tempFilePath,
    release() {
      uni.getFileSystemManager?.().unlink({ filePath: result.tempFilePath, fail() {} });
    },
  };
  // #endif
  return audio;
}
