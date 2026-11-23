import rawRequest from '@/utils/rawRequest';
import { pageUrl, ROUTES } from '@/services/navigation';

export function loadLocalMaterials(dialect, quizVersion) {
  return rawRequest.get('/local-tools/', {
    dialect,
    ...(quizVersion ? { quiz_version: quizVersion } : {}),
  }, { auth: false, loading: false });
}

export function resolveLocalDialect({
  chosen, shared, profile, route,
}) {
  return chosen || shared || profile || route || '';
}

export function quizShareMessage(dialect, material) {
  if (!dialect || !material?.version) return null;
  return {
    title: material.title,
    path: pageUrl(ROUTES.localTools, { dialect, tool: 'quiz', quiz: material.version }),
  };
}

export function readLocalParam(value) {
  const text = typeof value === 'string' ? value : '';
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

export function readSoundLookupSearch(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    // H5 provides decoded JSON. Native route options can still be encoded.
    const params = JSON.parse(value.startsWith('{') ? value : readLocalParam(value));
    if (typeof params?.keywords !== 'string' || Array.from(params.keywords).length !== 1
      || typeof params.dialect !== 'string' || !params.dialect) return null;
    return { keywords: params.keywords, dialect: params.dialect };
  } catch {
    return null;
  }
}
