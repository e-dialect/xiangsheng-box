const LABELS = Object.freeze({ entry: '词条', recording: '录音', collection: '集盒' });

export function contentFeedbackParams(type, id) {
  if (type === 'kinship') {
    const dialect = typeof id === 'string' ? id.trim() : '';
    if (!dialect || dialect.length > 512 || /[\r\n]/.test(dialect)) return null;
    return { id: '-1', object_type: type, object_id: dialect };
  }
  if (!Object.prototype.hasOwnProperty.call(LABELS, type)) return null;
  const value = String(id ?? '');
  return {
    id: '-1',
    object_type: type,
    object_id: /^[1-9]\d{0,18}$/.test(value) ? value : '',
  };
}

export function contentFeedbackDraft(options = {}) {
  if (String(options.id) !== '-1') return null;
  const params = contentFeedbackParams(options.object_type, options.object_id);
  if (!params) return null;
  const label = LABELS[params.object_type];
  const site = typeof window !== 'undefined' && window.location?.hostname;
  const version = typeof uni !== 'undefined' && uni.getAppBaseInfo?.()?.appVersion;
  const kinship = params.object_type === 'kinship';
  return {
    title: kinship ? '补充当地亲戚称谓' : `${label}链接反馈`,
    content: [
      `站点：${site || '乡声集盒客户端'}`,
      kinship ? `方言：${params.object_id}` : `对象：${label} ${params.object_id || '编号缺失'}`,
      ...(version ? [`客户端版本：${version}`] : []),
      ...(kinship ? ['亲属关系和当地叫法：', '适用地区和资料来源：'] : ['遇到的问题：']),
    ].join('\n'),
  };
}
