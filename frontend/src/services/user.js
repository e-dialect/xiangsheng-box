import request from '@/utils/request';
import rawRequest from '@/utils/rawRequest';
import { afterLogin } from '@/services/login';
import { endGuestDraftSession } from '@/services/recordingDrafts';
import { afterThemeLogout } from '@/services/themeApi';

const PAGE_LOAD_OPTIONS = Object.freeze({ loading: false });

/**
 * US0101 新建用户（普通）
 * @returns {Promise<unknown>}
 */
export async function registerUser(username, password, email, code) {
  return new Promise((resolve, reject) => {
    rawRequest.post('/users', {
      username, password, email, code,
    }, { auth: false }).then((res) => {
      resolve(res);
    }).catch((err) => {
      switch (err.statusCode) {
        case 401:
          uni.showToast({
            title: err.message || '验证码错误',
            icon: 'error',
          });
          break;
        case 409:
          uni.showToast({
            title: err.message || '用户名已存在',
            icon: 'error',
          });
          break;
        default:
          uni.showToast({
            title: err.message || '注册失败',
            icon: 'error',
          });
      }
      reject(err);
    });
  });
}

/**
 * US0102 新建用户（微信）
 * @param username 用户名
 * @param password 密码
 * @param nickname 昵称
 */
export function registerWechatUser(username, password, nickname) {
  return new Promise((resolve, reject) => {
    uni.login({
      async success(res) {
        if (!res.code) {
          reject(new Error('当前平台不支持'));
          return;
        }
        try {
          const response = await rawRequest.post('/users/wechat/register', {
            username,
            password,
            jscode: res.code,
            nickname,
          }, { auth: false });
          await afterLogin(response, { isNew: true });
          resolve(response);
        } catch (error) {
          reject(error);
        }
      },
      fail() {
        reject(new Error('获取微信授权失败'));
      },
    });
  });
}

/**
 * US0201 获取指定用户信息
 * @param id 用户id
 * @returns {Promise<unknown>}
 */
export async function getUserInfo(id, silent = false) {
  return request.get(`/users/${id}`, null, silent, PAGE_LOAD_OPTIONS);
}

/**
 * 按公开身份信息查找可接收站内信的用户。
 * @param query 昵称、用户名或精确用户编号
 * @param limit 最大结果数
 * @returns {Promise<Array>}
 */
export async function searchUsers(query, limit = 8) {
  const search = String(query || '').trim();
  if (!search) return [];
  const response = await request.get(
    '/users',
    { search, limit },
    true,
    PAGE_LOAD_OPTIONS,
  );
  return Array.isArray(response?.users) ? response.users : [];
}

/**
 * US0301 更新用户信息（除password和email外）
 * @param id 用户id
 * @returns {Promise<unknown>}
 */
export async function changeUserInfo(id, userInfo) {
  const res = await request.put(`/users/${id}`, { user: userInfo }, true);
  if (res.token) uni.setStorageSync('token', res.token);
  getApp().globalData.userInfo = res.user || userInfo;
  return res;
}

/**
 * US0302 更新用户密码
 * @param id 用户id
 * @param oldPassword 旧密码
 * @param newPassword 新密码
 * @returns {Promise<unknown>}
 */
export async function changeUserPassword(id, oldPassword, newPassword) {
  const res = await request.put(
    `/users/${id}/password`,
    { oldpassword: oldPassword, newpassword: newPassword },
    true,
  );
  if (res?.token) uni.setStorageSync('token', res.token);
  if (res?.user) getApp().globalData.userInfo = res.user;
  return res;
}

/**
 * US0303 更新用户邮箱
 * @param id 用户id
 * @param email 邮箱
 * @param code 验证码
 * @returns {Promise<unknown>}
 */
export async function changeUserEmail(id, email, code) {
  const res = await request.put(`/users/${id}/email`, { email, code }, true);
  if (res?.user) getApp().globalData.userInfo = res.user;
  return res;
}

/**
 * US0304 绑定微信
 * @param id{number} 用户id
 * @param overwrite{boolean} 是否覆盖
 * @returns {Promise<unknown>}
 */
export async function bindingWechat(id, overwrite, { demo = false } = {}) {
  if (demo) {
    await request.put(`/users/${id}/wechat`, { demo: true, overwrite }, true);
    return { success: true, message: '绑定成功' };
  }
  return new Promise((resolve, reject) => {
    uni.login({
      async success(res) {
        if (!res.code) {
          reject(new Error('获取微信授权失败'));
          return;
        }
        try {
          await request.put(`/users/${id}/wechat`, { jscode: res.code, overwrite }, true);
          resolve({ success: true, message: '绑定成功' });
        } catch (err) {
          reject(err instanceof Error ? err : new Error((err && (err.message || JSON.stringify(err))) || '绑定失败'));
        }
      },
      fail() {
        reject(new Error('获取微信授权失败'));
      },
    });
  });
}

/**
 * US0305 取消绑定微信
 * @param id 用户id
 * @returns {Promise<unknown>}
 */
export async function cancelBindingWechat(id) {
  return request.del(`/users/${id}/wechat`, null, true);
}

/**
 * 清理登录状态
 */
export function clearUserInfo() {
  uni.removeStorageSync('token');
  uni.removeStorageSync('id');
  uni.removeStorageSync('auth_intercept_intent');
  const app = getApp();
  delete app.globalData.userInfo;
  delete app.globalData.contribution;
  delete app.globalData.id;
  endGuestDraftSession();
  afterThemeLogout();
}

/**
 * 通过用户名获取账号关联邮箱
 * @param username 用户名
 * @returns {Promise<unknown>}
 */
export function getEmailByUsername(username) {
  return rawRequest.get('/login/forget', { username }, { auth: false });
}

export function requestPasswordResetCode(username) {
  return rawRequest.post('/login/forget', { username }, { auth: false });
}

export function resetPassword(username, password, code) {
  return rawRequest.put('/login/forget', {
    username, password, code,
  }, { auth: false });
}
