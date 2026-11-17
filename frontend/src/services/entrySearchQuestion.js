import { naturalDialectName } from '@/utils/dialectTree';

const termQuestion = /^([^\s，。！？!?、；;:：「」“”]{1,24}?)(?:怎么读|怎么念|是什么意思|什么意思|怎么说|哪里这样说)[?？]?$/u;
const quotedQuestion = /^(?:「([^」]+)」|“([^”]+)”)(?:怎么读|怎么念|是什么意思|什么意思|怎么说|哪里这样说)[?？]?$/u;

export default function entryQuestionTerm(input, dialects = []) {
  const query = String(input ?? '').trim();
  const quoted = query.match(quotedQuestion);
  if (quoted) return (quoted[1] ?? quoted[2]).trim() || query;
  const term = query.match(termQuestion)?.[1];
  if (!term) return query;

  // Leave known dialect qualifiers for a search flow that can interpret their scope.
  const hasQualifier = dialects.some(({ name }) => {
    const dialect = naturalDialectName(name);
    return dialect && (
      term.endsWith(`在${dialect}`)
      || term.endsWith(`用${dialect}`)
      || term.endsWith(`${dialect}话`)
      || term.endsWith(`${dialect}方言`)
      || (term !== dialect && /(?:话|语|方言)$/u.test(dialect) && term.endsWith(dialect))
    );
  });
  return hasQualifier ? query : term;
}
