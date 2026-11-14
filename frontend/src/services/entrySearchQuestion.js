const termQuestion = /^([^\s，。！？!?、；;:：「」“”]{1,24}?)(?:怎么读|怎么念|是什么意思|什么意思|怎么说|哪里这样说)[?？]?$/u;
const quotedQuestion = /^(?:「([^」]+)」|“([^”]+)”)(?:怎么读|怎么念|是什么意思|什么意思|怎么说|哪里这样说)[?？]?$/u;

export default function entryQuestionTerm(input) {
  const query = String(input ?? '').trim();
  const quoted = query.match(quotedQuestion);
  if (quoted) return (quoted[1] ?? quoted[2]).trim() || query;
  const term = query.match(termQuestion)?.[1];
  // A named language or dialect needs explicit catalog resolution before extracting the term.
  if (!term || /[话语音]$/u.test(term) || /(?:在|用).+/u.test(term)) return query;
  return term;
}
