function sortDialects(items) {
  return items.sort((left, right) => (
    (left.sort_order || 0) - (right.sort_order || 0) || left.id - right.id
  ));
}

let dialectCatalog = [];

export function registerDialectCatalog(dialects = []) {
  dialectCatalog = Array.isArray(dialects) ? [...dialects] : [];
  return dialectCatalog;
}

export function buildDialectTree(dialects = []) {
  const nodesByCode = new Map(dialects.map((dialect) => [
    dialect.qualified_code,
    { ...dialect, children: [] },
  ]));
  const roots = [];

  nodesByCode.forEach((node) => {
    const segments = node.qualified_code.split('.');
    const parentCode = segments.slice(0, -1).join('.');
    const parent = nodesByCode.get(parentCode);
    if (parent) parent.children.push(node);
    else roots.push(node);
  });

  nodesByCode.forEach((node) => sortDialects(node.children));
  return sortDialects(roots);
}

export function findDialectPath(nodes, dialectId, path = []) {
  let matchedPath = [];
  nodes.some((node) => {
    const nextPath = [...path, node];
    if (String(node.id) === String(dialectId)) {
      matchedPath = nextPath;
      return true;
    }
    const childPath = findDialectPath(node.children, dialectId, nextPath);
    if (!childPath.length) return false;
    matchedPath = childPath;
    return true;
  });
  return matchedPath;
}

export function naturalDialectName(name = '') {
  const value = String(name || '').trim();
  if (!value) return '';
  if (value === '莆仙片（兴化方言）') return '莆仙方言';
  if (value.endsWith('片')) return `${value.slice(0, -1)}方言`;
  return value;
}

function pathFromNames(dialect = {}) {
  if (!Array.isArray(dialect.path_names)) return [];
  return dialect.path_names.map(naturalDialectName).filter(Boolean);
}

function pathFromCatalog(dialect = {}, dialects = dialectCatalog) {
  if (!dialects.length) return [];
  const tree = buildDialectTree(dialects);
  const exact = findDialectPath(tree, dialect.id);
  if (exact.length) return exact.map((item) => naturalDialectName(item.name));
  const codeMatch = dialects.find((item) => (
    item.qualified_code && item.qualified_code === dialect.qualified_code
  ));
  return codeMatch
    ? findDialectPath(tree, codeMatch.id).map((item) => naturalDialectName(item.name))
    : [];
}

function pathFromQualifiedCode(dialect = {}) {
  const segments = String(dialect.qualified_code || '').split('.').filter(Boolean);
  if (!segments.length) return [];
  return segments.map((segment, index) => {
    if (index === segments.length - 1 && dialect.name) return naturalDialectName(dialect.name);
    if (index === 0 && segment === '闽') return '闽语';
    if (segment === '莆仙') return '莆仙方言';
    return naturalDialectName(segment);
  });
}

export function dialectPathNames(dialect = {}, dialects = dialectCatalog) {
  if (!dialect) return [];
  const namedPath = pathFromNames(dialect);
  if (namedPath.length) return namedPath;
  const catalogPath = pathFromCatalog(dialect, dialects);
  if (catalogPath.length) return catalogPath;
  const codePath = pathFromQualifiedCode(dialect);
  if (codePath.length) return codePath;
  return [naturalDialectName(dialect.name)].filter(Boolean);
}

export function dialectBreadcrumb(dialect = {}, dialects = dialectCatalog) {
  const path = dialectPathNames(dialect, dialects);
  return path.length ? path.join(' › ') : '地区待补充';
}

export function dialectCardLabel(dialect = {}, dialects = dialectCatalog) {
  const path = dialectPathNames(dialect, dialects);
  if (!path.length) return '地区待补充';
  // Any ancestor can identify the language or distinguish a locality.
  return path.join(' · ');
}
