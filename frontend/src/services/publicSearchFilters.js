export const WRITING_TYPES = [
  { label: '不限', value: '' },
  { label: '汉字正字', value: 'orthographic' },
  { label: '俗写', value: 'popular' },
  { label: '借字', value: 'loan' },
  { label: '拟音', value: 'phonetic' },
  { label: '罗马字', value: 'romanization' },
  { label: '待考写法', value: 'uncertain' },
];

export const SOURCE_TYPES = [
  { label: '不限', value: '' },
  { label: '用户原话', value: 'user_statement' },
  { label: '口述', value: 'oral' },
  { label: '田野记录', value: 'fieldwork' },
  { label: '书籍', value: 'book' },
  { label: '论文或文章', value: 'article' },
  { label: '档案', value: 'archive' },
  { label: '网页', value: 'web' },
  { label: '旧库原文', value: 'legacy' },
  { label: '其他', value: 'other' },
];

export function publicSearchFilters(filters) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) return {};
  const result = {};
  if (/^[1-9]\d*$/.test(String(filters.dialectId || ''))) {
    result.dialectId = String(filters.dialectId);
    if (filters.dialectMatch === 'exact') result.dialectMatch = 'exact';
  }
  if (WRITING_TYPES.some(({ value }) => value && value === filters.writingType)) {
    result.writingType = filters.writingType;
  }
  if (SOURCE_TYPES.some(({ value }) => value && value === filters.sourceType)) {
    result.sourceType = filters.sourceType;
  }
  if (['draft', 'reviewed', 'disputed'].includes(filters.status)) result.status = filters.status;
  if (typeof filters.hasRecording === 'boolean') result.hasRecording = filters.hasRecording;
  ['ipa', 'romanization', 'source', 'concept'].forEach((key) => {
    if (typeof filters[key] === 'string' && filters[key].trim()) result[key] = filters[key].trim();
  });
  return result;
}

export function readPublicSearchFilters(raw) {
  if (typeof raw !== 'string' || !raw) return {};
  try {
    // H5 supplies decoded route options. WeChat may supply the encoded component.
    const parsed = JSON.parse(raw.startsWith('{') ? raw : decodeURIComponent(raw));
    return parsed && typeof parsed === 'object' ? publicSearchFilters(parsed) : {};
  } catch {
    return {};
  }
}

export function publicSearchShareParams(key, filters) {
  const criteria = publicSearchFilters(filters);
  return {
    key: String(key || '').trim(),
    filters: Object.keys(criteria).length ? JSON.stringify(criteria) : undefined,
  };
}
