import { toIndexPage } from '@/routers';
import { toLoginPage } from '@/routers/login';
import {
  clearInterceptIntent,
  peekInterceptIntent,
} from '@/services/authGuard';
import {
  AUTH_DESTINATION_KINDS,
  resolveAuthDestination,
} from '@/services/authJourney';
import {
  needsDialectOnboarding,
  ONBOARDING_REASONS,
  toDialectOnboarding,
} from '@/services/dialectOnboarding';
import { openPage } from '@/services/navigation';
import { endGuestDraftSession } from '@/services/recordingDrafts';
import { afterThemeLogin, afterThemeLogout } from '@/services/themeApi';
import rawRequest from '../utils/rawRequest';

export function resumeInterruptedPageAfterLogin() {
  const pages = getCurrentPages();
  const previousPage = pages.length > 1 ? pages[pages.length - 2] : null;
  const previousRoute = previousPage ? previousPage.route : '';
  const interruptedIntent = peekInterceptIntent();
  const destination = resolveAuthDestination(interruptedIntent);

  if (destination.kind === AUTH_DESTINATION_KINDS.DEFAULT) return false;

  clearInterceptIntent();
  if (destination.kind === AUTH_DESTINATION_KINDS.URL) {
    const normalizedPreviousRoute = String(previousRoute || '').replace(/^\//, '');
    const destinationHasState = destination.url !== `/${destination.route}`;
    // 同页受保护动作仍要携带恢复参数重新进入，否则 navigateBack 会悄悄丢掉动作。
    if (normalizedPreviousRoute === destination.route && !destinationHasState) {
      uni.navigateBack({ delta: 1 });
    } else {
      openPage(destination.url, {}, { replace: true });
    }
    return true;
  }

  toIndexPage(true);
  return true;
}

/**
 * 加载用户信息到 app.globalData
 */
export async function loadUserInfo() {
  const id = uni.getStorageSync('id');
  if (!id) {
    return null;
  }
  const app = getApp();
  return rawRequest.get(`/users/${id}`).then((res) => {
    app.globalData.userInfo = res.user;
    app.globalData.contribution = res.contribution;
    app.globalData.id = res.user.id;
    return res.user;
  });
}

export async function afterLogin(res, options = {}) {
  uni.showToast({
    title: '登录成功',
    icon: 'success',
  });
  endGuestDraftSession();
  uni.setStorageSync('token', res.token);
  uni.setStorageSync('id', res.id);
  try {
    await afterThemeLogin(res.id);
  } catch {
    // Theme merge is handled on theme-center; login must not fail.
  }
  const user = await loadUserInfo();
  if (needsDialectOnboarding(user)) {
    const reason = options.isNew
      ? ONBOARDING_REASONS.NEW_USER
      : ONBOARDING_REASONS.MISSING_DIALECT;
    toDialectOnboarding(reason, true);
    return;
  }
  if (resumeInterruptedPageAfterLogin(res.id)) return;
  toIndexPage(true);
}

/**
 * 小程序一键登录
 */
function generateUsernameSuffix(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  for (let i = 0; i < length; i += 1) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return suffix;
}

/**
 * 使用微信 code 进行一键注册
 */
async function registerWithWechatCode(code) {
  // 用户无需设置密码；后端会创建不可用密码，仅保留微信登录能力。
  const username = `wx_${generateUsernameSuffix()}`;

  // 不再调用 uni.getUserProfile（小程序基础库限制），只提交必需字段
  // 发送注册请求（仅必填项）
  return rawRequest.post('/users/wechat/register', {
    jscode: code,
    username,
  }, { auth: false })
    .then(async (res) => {
      await afterLogin(res, { isNew: true });
      return res;
    })
    .catch((err) => {
      // 不在此处直接弹窗，保留原行为：提示给用户
      uni.showToast({
        title: err.message || '注册失败',
        icon: 'none',
      });
      throw err;
    });
}

export async function mpLogin() {
  // #ifdef H5
  toLoginPage();
  // #endif

  // #ifndef H5
  uni.login({
    // 尝试调用登录接口成功
    success: (res) => {
      // 如果没有获取到微信的 code 直接使用普通登录
      if (!res.code) {
        toLoginPage();
        return;
      }
      // 尝试进行微信登录
      rawRequest.post(
        '/login/wechat',
        {
          jscode: res.code,
        },
        { auth: false },
      )
        .then(async (res2) => {
          await afterLogin(res2);
        })
        .catch((err) => {
          switch (err.statusCode) {
            case 404:
              uni.showModal({
                content: '当前微信未绑定账号，是否一键注册？',
                success(modalRes) {
                  if (modalRes.confirm) {
                    // jscode 是一次性凭证，之前用于登录尝试已可能被后端消费，
                    // 因此再次调用 uni.login() 获取新的 code 用于注册。
                    uni.login({
                      success: (res2) => {
                        if (!res2.code) {
                          uni.showToast({ title: '获取微信授权失败', icon: 'none' });
                          return;
                        }
                        // 使用新的 code 进行注册
                        registerWithWechatCode(res2.code);
                      },
                      fail() {
                        uni.showToast({ title: '获取微信授权失败', icon: 'none' });
                      },
                    });
                  } else {
                    // 跳转到普通登录页面
                    toLoginPage();
                  }
                },
              });
              break;
            default:
              uni.showToast({
                title: err.message || '登录失败',
              });
          }
        });
    },
    // 尝试调用登录接口失败
    fail() {
      // 跳转到账号密码登录页面
      toLoginPage();
    },
  });
  // #endif
}

/**
 * 账号密码登录
 * @param username 用户名
 * @param password 密码
 */
export async function normalLogin(username, password, options = {}) {
  if (!username) {
    uni.showToast({
      title: '请输入用户名',
      icon: 'error',
    });
    return null;
  }
  if (!password) {
    uni.showToast({
      title: '请输入密码',
      icon: 'error',
    });
    return null;
  }
  try {
    const res = await rawRequest.post('/login', {
      username,
      password,
    }, { auth: false });
    await afterLogin(res, options);
    return res;
  } catch (err) {
    switch (err.statusCode) {
      case 401:
        uni.showToast({
          title: err.message || '用户名或密码错误',
          icon: 'error',
        });
        break;
      default:
        uni.showToast({
          title: err.message || '登录失败',
        });
    }
    return null;
  }
}

/**
 * 更新 Token 并登录
 * @returns {Promise<boolean>} 是否登录成功
 */
export async function getLoginStatus() {
  if (!uni.getStorageSync('token')) {
    return false;
  }

  let flag = false;
  await rawRequest.put('/login', {}).then(async (res) => {
    uni.setStorageSync('token', res.token);
    uni.setStorageSync('id', res.id);
    await loadUserInfo();
    flag = true;
  }).catch((err) => {
    switch (err.statusCode) {
      case 401:
        if (!uni.getStorageSync('token')) break;
        uni.removeStorageSync('token');
        uni.removeStorageSync('id');
        afterThemeLogout();
        uni.showToast({
          title: err.message || '登录已过期，请重新登录',
          icon: 'error',
        });
        break;
      default:
        break;
    }
  });
  return flag;
}

export function getLoginStatusSync() {
  return !!(uni.getStorageSync('token'));
}
