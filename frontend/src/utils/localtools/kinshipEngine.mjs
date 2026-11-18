/* Bounded kinship calculator. Conventional full-sibling/two-parent model only.
 * Person identity is independent of a role/term. No network, framework or DOM.
 */
const FIELDS = ['fa', 'mu', 'xiong', 'di', 'jie', 'mei', 'fu', 'qi', 'zi', 'nv'];
const TARGET_SEX = { fa: 'male', mu: 'female', xiong: 'male', di: 'male', jie: 'female', mei: 'female', fu: 'male', qi: 'female', zi: 'male', nv: 'female' };
const SIBLINGS = ['xiong', 'di', 'jie', 'mei'];
const clone = value => JSON.parse(JSON.stringify(value));
const opposite = sex => sex === 'male' ? 'female' : 'male';
const sexValue = value => value === 'male' || value === 'female' ? value : 'unknown';
const values = value => value == null ? [] : Array.isArray(value) ? value : [value];
const addUnique = (list, item) => { if (list.indexOf(item) < 0) list.push(item); };

// This adapter is transitional. Stable IDs must be supplied by the versioned
// phase-2 dataset; never persist IDs derived from array order or display names.
export function normalizeLegacyDataset(relative, idByName) {
  if (!idByName) throw new Error('An explicit stable name-to-ID map is required');
  return {
    selfId: idByName[relative[0].name],
    nodes: relative.map(node => ({
      id: idByName[node.name],
      label: node.name,
      relations: FIELDS.reduce((result, field) => {
        result[field] = node.relations && node.relations[field] != null
          ? values(node.relations[field]).map(name => {
            if (!idByName[name]) throw new Error('Missing stable ID for ' + name);
            return idByName[name];
          }) : null;
        return result;
      }, {})
    }))
  };
}

export function createKinshipEngine(dataset, options = {}) {
  const nodes = new Map();
  for (const raw of dataset.nodes || []) {
    if (!raw.id || nodes.has(raw.id)) throw new Error('Missing or duplicate role ID');
    const relations = {};
    for (const field of FIELDS) relations[field] = values((raw.relations || {})[field]).slice();
    nodes.set(raw.id, { ...raw, sex: sexValue(raw.sex), relations });
  }
  if (!nodes.has(dataset.selfId)) throw new Error('Unknown selfId');
  for (const node of nodes.values()) {
    for (const field of FIELDS) {
      for (const id of values(node.relations[field])) {
        if (!nodes.has(id)) throw new Error('Dangling relation: ' + node.id + '.' + field + ' -> ' + id);
      }
    }
  }
  const maxDepth = Number.isInteger(options.maxDepth) && options.maxDepth > 0 ? options.maxDepth : 15;
  const selfNode = nodes.get(dataset.selfId);
  const datasetVersion = dataset.datasetVersion || null;
  // A single parent edge identifies one ancestor only when its role is reached
  // by one anchored parent path. A shared/aggregate role reached by two paths
  // must not identify the two people. Do not extend uniqueness via child or
  // sibling edges: those roles can describe any number of people.
  const anchorPaths = new Map();
  function visitAnchor(roleId, lineage = []) {
    const node = nodes.get(roleId);
    if (node.kind && node.kind !== 'person') return;
    // A role that can be its own sibling explicitly represents multiple
    // people, even if one parent path happens to use that role.
    if (SIBLINGS.some(field => node.relations[field].includes(roleId))) return;
    const count = (anchorPaths.get(roleId) || 0) + 1;
    anchorPaths.set(roleId, count);
    // Two visits suffice to propagate ambiguity to descendants, and bound
    // traversal even for malformed cycles or heavily shared parent graphs.
    if (count > 2 || lineage.includes(roleId)) return;
    for (const field of ['fa', 'mu']) {
      const ids = node.relations[field];
      if (ids.length === 1) visitAnchor(ids[0], lineage.concat(roleId));
    }
  }
  visitAnchor(dataset.selfId);
  for (const field of ['fu', 'qi']) {
    const ids = selfNode.relations[field];
    if (ids.length === 1) visitAnchor(ids[0]);
  }
  const uniqueRoleIds = new Set([...anchorPaths].filter(([, count]) => count === 1).map(([id]) => id));
  uniqueRoleIds.add(dataset.selfId);
  const anchoredSiblingAges = [];
  for (const anchorId of uniqueRoleIds) {
    const ages = new Map(); const ambiguous = new Set();
    for (const field of SIBLINGS) for (const id of nodes.get(anchorId).relations[field]) {
      const age = field === 'xiong' || field === 'jie' ? 'older' : 'younger';
      if (ages.has(id) && ages.get(id) !== age) ambiguous.add(id);
      ages.set(id, age);
    }
    for (const [roleId, age] of ages) {
      if (roleId !== anchorId && !ambiguous.has(roleId)) anchoredSiblingAges.push({ anchorId, roleId, age });
    }
  }

  function newPerson(token, roleId, sex) {
    return { token, roleId, sex, parents: {}, unknownParents: [], children: [], siblings: [], spouse: null };
  }

  function sameFamily(graph, token) {
    const found = [];
    const queue = [token];
    while (queue.length) {
      const next = queue.shift();
      if (found.indexOf(next) >= 0) continue;
      found.push(next);
      queue.push(...graph.people[next].siblings);
    }
    return found;
  }

  function assignSex(graph, token, sex) {
    const person = graph.people[token];
    if (person.sex !== 'unknown' && person.sex !== sex) return false;
    person.sex = sex;
    return true;
  }

  function addAge(graph, older, younger) {
    if (older === younger) return false;
    const queue = [younger];
    const seen = [];
    while (queue.length) {
      const next = queue.shift();
      if (next === older) return false;
      if (seen.indexOf(next) >= 0) continue;
      seen.push(next);
      for (const pair of graph.olderThan) if (pair[0] === next) queue.push(pair[1]);
    }
    if (!graph.olderThan.some(pair => pair[0] === older && pair[1] === younger)) graph.olderThan.push([older, younger]);
    return true;
  }

  function bindParent(graph, child, parent, field) {
    if (child === parent || !assignSex(graph, parent, TARGET_SEX[field])) return false;
    const ancestors = [parent]; const seen = [];
    while (ancestors.length) {
      const next = ancestors.shift();
      if (next === child) return false;
      if (seen.indexOf(next) >= 0) continue;
      seen.push(next);
      ancestors.push(...Object.values(graph.people[next].parents), ...graph.people[next].unknownParents);
    }
    // Siblings in this model share both parents. A conflict rejects the branch;
    // it must never silently overwrite already known provenance.
    for (const member of sameFamily(graph, child)) {
      const person = graph.people[member];
      if (member === parent || (person.parents[field] && person.parents[field] !== parent)) return false;
      const other = field === 'fa' ? 'mu' : 'fa';
      if (person.parents[other] === parent) return false;
      const spouse = graph.people[parent].spouse;
      if (spouse && person.parents[other] && person.parents[other] !== spouse) return false;
    }
    for (const member of sameFamily(graph, child)) {
      graph.people[member].parents[field] = parent;
      graph.people[member].unknownParents = graph.people[member].unknownParents.filter(ref => ref !== parent);
      addUnique(graph.people[parent].children, member);
    }
    const spouse = graph.people[parent].spouse;
    const other = field === 'fa' ? 'mu' : 'fa';
    if (spouse && !graph.people[child].parents[other]) {
      if (!bindParent(graph, child, spouse, other)) return false;
    }
    return true;
  }

  function bindUnknownParent(graph, child, parent) {
    if (child === parent) return false;
    const sex = graph.people[parent].sex;
    if (sex !== 'unknown') return bindParent(graph, child, parent, sex === 'male' ? 'fa' : 'mu');
    for (const member of sameFamily(graph, child)) {
      addUnique(graph.people[member].unknownParents, parent);
      addUnique(graph.people[parent].children, member);
    }
    return true;
  }

  function bindSiblings(graph, left, right) {
    if (left === right) return false;
    addUnique(graph.people[left].siblings, right);
    addUnique(graph.people[right].siblings, left);
    const family = sameFamily(graph, left);
    for (const field of ['fa', 'mu']) {
      const parents = [...new Set(family.map(ref => graph.people[ref].parents[field]).filter(Boolean))];
      if (parents.length > 1) return false;
      if (parents.length === 1 && !bindParent(graph, left, parents[0], field)) return false;
    }
    const unknown = [...new Set(family.reduce((all, ref) => all.concat(graph.people[ref].unknownParents), []))];
    for (const parent of unknown) if (!bindUnknownParent(graph, left, parent)) return false;
    return true;
  }

  function bindSpouses(graph, left, right, field) {
    if (left === right) return false;
    if (!assignSex(graph, left, field === 'fu' ? 'female' : 'male')) return false;
    if (!assignSex(graph, right, TARGET_SEX[field])) return false;
    const a = graph.people[left]; const b = graph.people[right];
    if ((a.spouse && a.spouse !== right) || (b.spouse && b.spouse !== left)) return false;
    a.spouse = right; b.spouse = left;
    const children = [...new Set(a.children.concat(b.children))];
    for (const child of children) {
      if (!bindUnknownParent(graph, child, left) || !bindUnknownParent(graph, child, right)) return false;
    }
    return true;
  }

  function allocate(graph, roleId) {
    // Deterministically anchored ancestors/spouses identify one person. A
    // repeated 'elder brother' role does not establish identity.
    if (roleId === dataset.selfId) return 'p0';
    if (uniqueRoleIds.has(roleId)) {
      const known = Object.values(graph.people).find(person => person.roleId === roleId);
      if (known) return known.token;
    }
    const token = 'p' + graph.nextPerson++;
    graph.people[token] = newPerson(token, roleId, nodes.get(roleId).sex);
    return token;
  }

  function connect(graph, source, target, field) {
    if (!assignSex(graph, target, TARGET_SEX[field])) return false;
    if (field === 'fa' || field === 'mu') return bindParent(graph, source, target, field);
    if (field === 'zi' || field === 'nv') {
      for (const existing of graph.people[source].children.slice()) {
        if (existing !== target && !bindSiblings(graph, target, existing)) return false;
      }
      if (!bindUnknownParent(graph, target, source)) return false;
      // This declared model uses the known current spouse as the co-parent.
      // Step/adoptive/ritual kinship is deliberately outside its scope.
      const spouse = graph.people[source].spouse;
      return !spouse || bindUnknownParent(graph, target, spouse);
    }
    if (field === 'fu' || field === 'qi') return bindSpouses(graph, source, target, field);
    if (!bindSiblings(graph, source, target)) return false;
    return field === 'xiong' || field === 'jie'
      ? addAge(graph, target, source) : addAge(graph, source, target);
  }

  function roleAge(graph) {
    // Validate all present role/anchor pairs, including a parent first reached
    // after their sibling. An indirect route (e.g. grandfather -> son) does
    // not erase the uncle's declared age relative to the unique father.
    const people = Object.values(graph.people);
    for (const { anchorId, roleId, age } of anchoredSiblingAges) {
      for (const anchor of people.filter(person => person.roleId === anchorId)) {
        for (const person of people.filter(person => person.roleId === roleId)) {
          if (!(age === 'older' ? addAge(graph, person.token, anchor.token) : addAge(graph, anchor.token, person.token))) return false;
        }
      }
    }
    return true;
  }

  function makeCandidate(graph, token, revision, index, reason) {
    const person = graph.people[token];
    return {
      candidateId: 'v' + revision + ':' + index + ':' + token + ':' + person.roleId,
      personToken: token,
      roleId: person.roleId,
      label: nodes.get(person.roleId).label || person.roleId,
      sex: person.sex,
      egoSex: graph.people.p0.sex,
      reason,
      graph
    };
  }

  function createSession(context = {}, revision = 0) {
    const sex = sexValue(context.sex);
    const graph = { nextPerson: 1, people: { p0: newPerson('p0', dataset.selfId, sex) }, olderThan: [] };
    const first = makeCandidate(graph, 'p0', revision, 0, 'initial');
    return {
      version: 1,
      datasetVersion,
      model: 'conventional-full-sibling-coparent',
      context: { sex },
      revision,
      path: [], history: [],
      candidates: [first], selectedCandidateId: first.candidateId,
      hasUnlistedPossibilities: false,
      status: 'ready', diagnostic: null
    };
  }

  function selected(state) {
    if (state.selectedCandidateId) return state.candidates.find(item => item.candidateId === state.selectedCandidateId) || null;
    return null;
  }

  function fail(state, status, diagnostic) {
    return { ...state, status, diagnostic };
  }

  function snapshot(state) {
    const rest = { ...state };
    delete rest.history;
    return clone(rest);
  }

  function advance(state, field) {
    if (FIELDS.indexOf(field) < 0) return fail(state, 'unsupported', 'unknown-field');
    const current = selected(state);
    if (!current) return fail(state, 'needsChoice', 'choose-current-candidate');
    if (state.path.length >= maxDepth) return fail(state, 'limit', 'max-depth');
    const node = nodes.get(current.roleId);
    if (node.kind && node.kind !== 'person') return fail(state, 'unsupported', 'non-person-relation');
    const person = current.graph.people[current.personToken];
    const revision = state.revision + 1;
    const candidates = [];
    const add = (graph, token, reason) => {
      if (!connect(graph, current.personToken, token, field) || !roleAge(graph)) return;
      // Deduplicate identical identity+constraints only. Never deduplicate by
      // role ID: a previously visited brother and another brother are distinct.
      if (candidates.some(item => item.personToken === token && JSON.stringify(item.graph) === JSON.stringify(graph))) return;
      candidates.push(makeCandidate(graph, token, revision, candidates.length, reason));
    };

    // A known parent or spouse is an identity binding, not a role lookup.
    const known = field === 'fa' || field === 'mu' ? person.parents[field]
      : field === 'fu' || field === 'qi' ? person.spouse : null;
    if (known) {
      add(clone(current.graph), known, 'known-person');
    } else {
      const roles = values(node.relations[field]);
      if (field === 'zi' || field === 'nv') {
        for (const ref of person.children) add(clone(current.graph), ref, 'known-child');
      }
      if (SIBLINGS.indexOf(field) >= 0) {
        for (const ref of sameFamily(current.graph, current.personToken)) {
          if (ref !== current.personToken) add(clone(current.graph), ref, 'known-sibling');
        }
      }
      if (field === 'fu' || field === 'qi') {
        const otherField = field === 'fu' ? 'fa' : 'mu';
        const coParents = [...new Set(person.children.map(ref => current.graph.people[ref].parents[otherField]).filter(Boolean))];
        for (const ref of coParents) {
          if (roles.indexOf(current.graph.people[ref].roleId) >= 0) add(clone(current.graph), ref, 'known-coparent');
        }
      }
      const unknownParent = (field === 'fa' || field === 'mu')
        ? person.unknownParents.filter(ref => current.graph.people[ref].sex === 'unknown') : [];
      // This engine does not guess among multiple unspecified parent identities.
      if (unknownParent.length > 1) return fail(state, 'unsupported', 'multiple-unknown-parents');
      for (const ref of unknownParent) {
        add(clone(current.graph), ref, 'known-parent-with-sex-constraint');
      }
      for (const roleId of roles) {
        const graph = clone(current.graph);
        // If an unknown known parent is not this parent, it must be the other
        // parent in the explicitly scoped two-parent model.
        let possible = true;
        for (const ref of unknownParent) {
          if (!assignSex(graph, ref, opposite(TARGET_SEX[field]))) possible = false;
          if (!bindParent(graph, current.personToken, ref, field === 'fa' ? 'mu' : 'fa')) possible = false;
        }
        if (!possible) continue;
        const token = allocate(graph, roleId);
        add(graph, token, 'dataset-relation');
      }
    }
    if (!candidates.length) return fail(state, 'unsupported', 'no-supported-consistent-relation');
    // Remembered children/siblings establish possible identities, not an
    // exhaustive answer when the static graph has no coverage for this step.
    // An unknown-sex known parent likewise cannot exclude an unlisted other
    // parent. Exact already-bound parents/spouses are uniquely identified.
    const hasUnlistedPossibilities = !known && values(node.relations[field]).length === 0 && candidates.some(item =>
      ['known-child', 'known-sibling', 'known-parent-with-sex-constraint'].indexOf(item.reason) >= 0);
    const autoSelect = candidates.length === 1 && !hasUnlistedPossibilities;
    return {
      ...state,
      revision,
      path: state.path.concat([{ field, fromCandidateId: current.candidateId, hasUnlistedPossibilities }]),
      history: state.history.concat([snapshot(state)]),
      candidates,
      selectedCandidateId: autoSelect ? candidates[0].candidateId : null,
      hasUnlistedPossibilities,
      status: autoSelect ? 'ready' : 'needsChoice', diagnostic: null
    };
  }

  function reduce(state, action) {
    if (!state || state.version !== 1 || !action) throw new Error('Invalid kinship state/action');
    if (state.datasetVersion !== datasetVersion) return fail(state, 'unsupported', 'dataset-version-mismatch');
    if (action.type === 'advance') return advance(state, action.field);
    if (action.type === 'choose') {
      if (!state.candidates.some(item => item.candidateId === action.candidateId)) return fail(state, 'invalidSelection', 'candidate-not-current');
      return { ...state, selectedCandidateId: action.candidateId, status: 'ready', diagnostic: null };
    }
    if (action.type === 'clear') return createSession(state.context, state.revision + 1);
    if (action.type === 'setContext') return createSession(action.context || {}, state.revision + 1);
    if (action.type === 'back') {
      if (!state.history.length) return { ...state, status: 'ready', diagnostic: null };
      const restored = clone(state.history[state.history.length - 1]);
      const revision = state.revision + 1;
      const oldSelected = restored.selectedCandidateId;
      restored.candidates = restored.candidates.map((item, index) => {
        const result = makeCandidate(item.graph, item.personToken, revision, index, item.reason);
        if (item.candidateId === oldSelected) restored.selectedCandidateId = result.candidateId;
        return result;
      });
      return { ...restored, revision, history: clone(state.history.slice(0, -1)), status: restored.selectedCandidateId ? 'ready' : 'needsChoice', diagnostic: null };
    }
    return fail(state, 'unsupported', 'unknown-action');
  }

  return { createSession, reduce, selected, maxDepth };
}
