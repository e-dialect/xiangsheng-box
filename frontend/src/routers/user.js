import {
  goMine,
  goRecommendFollow,
  goUserDetail,
  goUserEmail,
  goUserInformation,
  goUserNickname,
  goUserPassword,
  goUserPhone,
  goUserUsername,
} from '@/services/navigation';

export const toUserPage = (id) => goUserDetail(id);
export const toUserInfoPage = () => goUserInformation();
export const toChangeNicknamePage = () => goUserNickname();
export const toChangeUsernamePage = () => goUserUsername();
export const toChangeEmailPage = () => goUserEmail();
export const toChangePhonePage = () => goUserPhone();
export const toChangePasswordPage = () => goUserPassword();

export function toFollowRecommendations(closeAll = false) {
  return goRecommendFollow(closeAll);
}

export function toMePage(closeAll = false) {
  return goMine(closeAll);
}
