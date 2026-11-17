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
