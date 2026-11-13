import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/httpClient', () => ({
  upload: vi.fn(),
}));

const httpClient = await import('@/utils/httpClient');
const fileService = await import('@/services/file');

function installUniMock() {
  global.uni = {
    chooseImage: vi.fn(),
    chooseFile: vi.fn(),
    chooseMessageFile: vi.fn(),
    showToast: vi.fn(),
  };
}

describe('file upload helpers', () => {
  beforeEach(() => {
    installUniMock();
  });

  it('chooseAndUploadImages returns uploaded urls', async () => {
    uni.chooseImage.mockImplementation(({ success }) => {
      success({ tempFilePaths: ['/tmp/a.png', '/tmp/b.png'] });
    });
    httpClient.upload
      .mockResolvedValueOnce({ url: 'https://example.test/a.png' })
      .mockResolvedValueOnce({ url: 'https://example.test/b.png' });

    await expect(fileService.chooseAndUploadImages(2)).resolves.toEqual([
      'https://example.test/a.png',
      'https://example.test/b.png',
    ]);
  });

  it('chooseAndUploadImages falls back to empty array when selection fails', async () => {
    uni.chooseImage.mockImplementation(({ fail }) => {
      fail({ errMsg: 'cancelled' });
    });

    await expect(fileService.chooseAndUploadImages(1)).resolves.toEqual([]);
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'cancelled',
      icon: 'none',
    }));
  });

  it('chooseAndUploadAnImage unwraps first url', async () => {
    vi.spyOn(httpClient, 'upload').mockResolvedValue({
      url: 'https://example.test/one.png',
    });
    uni.chooseImage.mockImplementation(({ success }) => {
      success({ tempFilePaths: ['/tmp/one.png'] });
    });

    await expect(fileService.chooseAndUploadAnImage()).resolves.toBe('https://example.test/one.png');
  });

  it.each([
    'chooseFile:fail cancel',
    'chooseMessageFile:fail cancel',
    'chooseFile:fail user cancel',
  ])('chooseAudioFile treats %s as dismissal', async (errMsg) => {
    uni.chooseFile.mockImplementation(({ fail }) => fail({ errMsg }));
    await expect(fileService.chooseAudioFile()).resolves.toBeNull();
    expect(uni.showToast).not.toHaveBeenCalled();
  });

  it.each([
    'chooseFile:fail permission denied',
    'chooseMessageFile:fail file not found',
    'failed to cancel upload',
  ])('chooseAudioFile preserves actual failure: %s', async (errMsg) => {
    const error = { errMsg };
    uni.chooseFile.mockImplementation(({ fail }) => fail(error));
    await expect(fileService.chooseAudioFile()).rejects.toBe(error);
  });

  it('chooseAudioFile still rejects a malformed successful selection', async () => {
    uni.chooseFile.mockImplementation(({ success }) => success({ tempFiles: [] }));
    await expect(fileService.chooseAudioFile()).rejects.toThrow('未选择音频文件');
  });

  it('chooseAudioFile returns a selected local audio path', async () => {
    uni.chooseFile.mockImplementation(({ success }) => {
      success({
        tempFilePaths: ['/tmp/audio.mp3'],
        tempFiles: [{ name: 'audio.mp3', size: 12, path: '/tmp/audio.mp3' }],
      });
    });

    await expect(fileService.chooseAudioFile()).resolves.toEqual({
      path: '/tmp/audio.mp3',
      name: 'audio.mp3',
      size: 12,
    });
    expect(uni.chooseFile).toHaveBeenCalledWith(expect.objectContaining({
      extension: ['.mp3', '.wav', '.m4a'],
    }));
  });
});
