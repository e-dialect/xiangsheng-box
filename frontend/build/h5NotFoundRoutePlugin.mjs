const H5_PAGES_JSON_ROUTE_ASSIGNMENT = /(?:window|global)\.__uniRoutes\s*=\s*\[/;
const H5_NOT_FOUND_ROUTE = '/pages/error/not-found';
const H5_CATCH_ALL_ROUTE = '/:pathMatch(.*)*';

const H5_NOT_FOUND_ROUTE_REGISTRATION = `
const guantouH5Routes = globalThis.__uniRoutes;
if (
  Array.isArray(guantouH5Routes)
  && !guantouH5Routes.some((route) => route.path === '${H5_CATCH_ALL_ROUTE}')
) {
  guantouH5Routes.push({
    path: '${H5_CATCH_ALL_ROUTE}',
    redirect: (to) => ({
      path: '${H5_NOT_FOUND_ROUTE}',
      query: {
        path: to.path,
        ...(to.path === '/pages/words/details' && typeof to.query?.id === 'string'
          && /^[1-9][0-9]{0,18}$/.test(to.query.id) ? { legacyWord: to.query.id } : {}),
        ...(to.path === '/search' && typeof to.query?.key === 'string'
          && !to.query.index && (!to.query.keywords || to.query.keywords === to.query.key)
          ? { legacySearch: to.query.key.slice(0, 200) } : {}),
      },
    }),
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
