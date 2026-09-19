import request from '@/utils/request';

export const likeRecording = (id, liked) => (liked ? request.put(`/recordings/${id}/like/`, {}) : request.del(`/recordings/${id}/like/`));
export const listComments = (recordingId, page = 1, targetType = 'recording', parentId = null) => request.get(`/${targetType}-comments/`, {
  [`${targetType}_id`]: recordingId,
  page,
  ...(parentId ? { parent_id: parentId } : {}),
}, true, {
  loading: false,
});
export const createComment = (data, targetType = 'recording') => request.post(`/${targetType}-comments/`, data);
export const deleteComment = (id, targetType = 'recording') => request.del(`/${targetType}-comments/${id}/`);
export const likeComment = (id, liked, targetType = 'recording') => (liked ? request.put(`/${targetType}-comments/${id}/like/`, {}) : request.del(`/${targetType}-comments/${id}/like/`));
export const discoverRecording = (kind = 'daily') => request.get(`/recordings/${kind}/`, {}, true, {
  loading: false,
});
export function commentRequestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === 'x' ? value : (value % 4) + 8).toString(16);
  });
}
