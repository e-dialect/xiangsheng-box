const H5_PAGES_JSON_ROUTE_ASSIGNMENT = /(?:window|global)\.__uniRoutes\s*=\s*\[/;
const H5_NOT_FOUND_ROUTE = '/pages/error/not-found';
const H5_CATCH_ALL_ROUTE = '/:pathMatch(.*)*';

const H5_NOT_FOUND_ROUTE_REGISTRATION = `
const guantouH5Routes = globalThis.__uniRoutes;
if (
  Array.isArray(guantouH5Routes)
  && !guantouH5Routes.some((route) => route.path === '${H5_CATCH_ALL_ROUTE}')
) {
  const recoveryQuery = (to) => {
    const path = to.path;
    const { id, key, keywords, index } = to.query || {};
    if (path === '/pages/words/details' && typeof id === 'string' && /^[1-9][0-9]{0,18}$/.test(id)) {
      return { path, legacyWord: id };
    }
    if (path !== '/search') return { path };
    if (index !== undefined || (key !== undefined && keywords !== undefined && key !== keywords)) {
      return { path, legacySearchNeedsInput: '1' };
    }
    const term = key === undefined ? keywords : key;
    if (term === undefined) return { path };
    if (typeof term !== 'string') return { path, legacySearchNeedsInput: '1' };
    return { path, legacySearch: term.slice(0, 200) };
  };
  guantouH5Routes.push({
    path: '${H5_CATCH_ALL_ROUTE}',
    redirect: (to) => ({ path: '${H5_NOT_FOUND_ROUTE}', query: recoveryQuery(to) }),
    meta: { route: 'pages/error/not-found' },
  });
}
`;

export function injectH5NotFoundRoute(code) {
  if (!H5_PAGES_JSON_ROUTE_ASSIGNMENT.test(code)) return null;
  return `${code}\n${H5_NOT_FOUND_ROUTE_REGISTRATION}`;
}

export function h5NotFoundRoutePlugin() {
  return {
    name: 'guantou:h5-not-found-route',
    enforce: 'post',
    transform(code) {
      if (process.env.UNI_PLATFORM !== 'h5') return null;

      const transformed = injectH5NotFoundRoute(code);
      return transformed ? { code: transformed, map: null } : null;
    },
  };
}
