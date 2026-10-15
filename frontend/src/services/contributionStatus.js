/**
 * Subtask B for #427: executable user-facing language for the V2 contribution domain.
 *
 * Keep machine status keys in the API and translate them at the presentation
 * boundary. These messages describe workflow state, not linguistic truth or
 * institutional authority.
 */

export const CONTRIBUTION_PHASES = Object.freeze([
  '处理中',
  '已采用',
  '待补充',
  '暂不能处理',
]);

export const SUBMISSION_SUCCESS_MESSAGE = '已提交，等待审核';

const UNKNOWN_STATUS = Object.freeze({
  phase: '处理中',
  label: '状态待确认',
  description: '这条资料的状态暂未被前端识别，原始内容仍会保留。',
  nextStep: '暂时无需处理；如需继续，请打开详情查看最新信息。',
  source: '未知对象或未知状态',
  tone: 'neutral',
});

const STATUS_MAP = Object.freeze({
  entry: Object.freeze({
    draft: Object.freeze({
      phase: '待补充',
      label: '初稿',
      description: '这条词条已经记下，写法、分义或读音还可以继续补充。',
      nextStep: '可以打开词条，继续补充资料或等待整理。',
      source: 'Entry.status',
      tone: 'neutral',
    }),
    reviewed: Object.freeze({
      phase: '已采用',
      label: '已整理',
      description: '整理员已经处理过词条结构；这不等于所有说法都被判定为唯一正确。',
      nextStep: '可以查看词条详情和保留的证据。',
      source: 'Entry.status',
      tone: 'positive',
    }),
    disputed: Object.freeze({
      phase: '待补充',
      label: '有不同说法',
      description: '词条目前保留着不同的整理意见或依据。',
      nextStep: '可以查看各方依据，必要时补充自己的资料。',
      source: 'Entry.status',
      tone: 'caution',
    }),
    redirected: Object.freeze({
      phase: '已采用',
      label: '已并入另一词条',
      description: '这条词条已记录跳转关系，原有资料不会因此被当作不存在。',
      nextStep: '打开详情查看当前使用的词条。',
      source: 'Entry.status',
      tone: 'neutral',
    }),
  }),
  sense: Object.freeze({
    draft: Object.freeze({
      phase: '待补充',
      label: '初稿',
      description: '这个义项已经记下，释义或例句还可以继续补充。',
      nextStep: '可以查看词条并补充义项资料。',
      source: 'EntrySense.status',
      tone: 'neutral',
    }),
    reviewed: Object.freeze({
      phase: '已采用',
      label: '已整理',
      description: '这个义项的结构已经整理过，但不代表它是唯一解释。',
      nextStep: '可以查看释义、例句和相关证据。',
      source: 'EntrySense.status',
      tone: 'positive',
    }),
    disputed: Object.freeze({
      phase: '待补充',
      label: '有不同说法',
      description: '这个义项目前存在不同整理意见或依据。',
      nextStep: '可以查看依据，必要时补充资料。',
      source: 'EntrySense.status',
      tone: 'caution',
    }),
  }),
  writing: Object.freeze({
    draft: Object.freeze({
      phase: '待补充',
      label: '初稿',
      description: '这是一种已记录但仍待整理的写法。',
      nextStep: '可以查看词条并补充写法依据。',
      source: 'EntryWriting.status / PronunciationVariant.status',
      tone: 'neutral',
    }),
    reviewed: Object.freeze({
      phase: '已采用',
      label: '已整理',
      description: '这条写法关系已经整理过，不表示它取代了其他写法。',
      nextStep: '可以查看它与词条的关系和来源。',
      source: 'EntryWriting.status / PronunciationVariant.status',
      tone: 'positive',
    }),
    disputed: Object.freeze({
      phase: '待补充',
      label: '有不同说法',
      description: '这条写法关系目前存在不同整理意见或依据。',
      nextStep: '可以查看依据，必要时补充资料。',
      source: 'EntryWriting.status / PronunciationVariant.status',
      tone: 'caution',
    }),
    rejected: Object.freeze({
      phase: '暂不能处理',
      label: '本次未采用',
      description: '这次写法关系没有进入当前结构；原始提交记录仍会保留。',
      nextStep: '如需继续，请先查看详情中的原因和现有入口。',
      source: 'EntryWriting.status / PronunciationVariant.status',
      tone: 'muted',
    }),
  }),
  pronunciation: Object.freeze({
    draft: Object.freeze({
      phase: '待补充',
      label: '初稿',
      description: '这条地区读音已经记录，仍待进一步整理。',
      nextStep: '可以查看读音并补充地区或来源说明。',
      source: 'PronunciationVariant.status',
      tone: 'neutral',
    }),
    reviewed: Object.freeze({
      phase: '已采用',
      label: '已整理',
      description: '这条地区读音已经整理过，不表示它是该地区唯一读法。',
      nextStep: '可以查看读音、范围和证据。',
      source: 'PronunciationVariant.status',
      tone: 'positive',
    }),
    disputed: Object.freeze({
      phase: '待补充',
      label: '有不同说法',
      description: '这条地区读音目前存在不同整理意见或依据。',
      nextStep: '可以查看依据，必要时补充自己的用法或来源。',
      source: 'PronunciationVariant.status',
      tone: 'caution',
    }),
    rejected: Object.freeze({
      phase: '暂不能处理',
      label: '本次未采用',
      description: '这次地区读音没有进入当前结构；原始资料仍会保留。',
      nextStep: '如需继续，请先查看详情中的原因和现有入口。',
      source: 'PronunciationVariant.status',
      tone: 'muted',
    }),
  }),
  recording: Object.freeze({
    draft: Object.freeze({
      phase: '待补充',
      label: '初稿',
      description: '录音已经记下，后续还可以补充写法、读音或关联。',
      nextStep: '可以打开录音详情继续补充资料。',
      source: 'Recording.status',
      tone: 'neutral',
    }),
    published: Object.freeze({
      phase: '已采用',
      label: '已公开',
      description: '这段录音已经对外可见，不表示其中的说法获得官方认证。',
      nextStep: '可以播放录音并查看它关联的词条和证据。',
      source: 'Recording.status',
      tone: 'positive',
    }),
    disputed: Object.freeze({
      phase: '待补充',
      label: '有不同说法',
      description: '这段录音相关的整理目前存在不同意见或依据。',
      nextStep: '可以查看保留的意见和证据。',
      source: 'Recording.status',
      tone: 'caution',
    }),
    rejected: Object.freeze({
      phase: '暂不能处理',
      label: '本次未采用',
      description: '这段录音当前没有进入公开资料结构；原始提交记录仍会保留。',
      nextStep: '如需继续，请先查看详情中的原因和现有入口。',
      source: 'Recording.status',
      tone: 'muted',
    }),
  }),
  recording_link: Object.freeze({
    suggested: Object.freeze({
      phase: '处理中',
      label: '关联待确认',
      description: '有人提出将这段录音与该词条关联，关系还没有完成确认。',
      nextStep: '可以查看录音、词条和提出关联的依据。',
      source: 'RecordingEntryLink.status',
      tone: 'neutral',
    }),
    accepted: Object.freeze({
      phase: '已采用',
      label: '已建立关联',
      description: '这段录音与该词条的关系已经被接受，不等于录音内容获得权威认证。',
      nextStep: '可以查看关联角色、义项和证据。',
      source: 'RecordingEntryLink.status',
      tone: 'positive',
    }),
    rejected: Object.freeze({
      phase: '暂不能处理',
      label: '关联未采用',
      description: '这次录音与词条的关联没有被采用，录音和词条本身仍可独立保留。',
      nextStep: '可以查看原因，必要时从详情中的现有入口提出新的关联。',
      source: 'RecordingEntryLink.status',
      tone: 'muted',
    }),
    disputed: Object.freeze({
      phase: '待补充',
      label: '关联有不同说法',
      description: '这段录音与词条的关系存在不同解释，系统会保留相关依据。',
      nextStep: '可以查看各个解释和依据。',
      source: 'RecordingEntryLink.status',
      tone: 'caution',
    }),
  }),
  evidence_link: Object.freeze({
    submitted: Object.freeze({
      phase: '处理中',
      label: '已提交依据',
      description: '这份资料作为原始依据被记录下来，原文不会被整理结果覆盖。',
      nextStep: '可以查看原文、出处和它关联的对象。',
      source: 'EvidenceLink.status',
      tone: 'neutral',
    }),
    supports: Object.freeze({
      phase: '已采用',
      label: '支持该说法',
      description: '整理记录将这份资料作为支持依据，并不表示它单独证明了语言事实。',
      nextStep: '可以查看它支持的对象和其他依据。',
      source: 'EvidenceLink.status',
      tone: 'positive',
    }),
    disputes: Object.freeze({
      phase: '待补充',
      label: '对该说法有疑问',
      description: '整理记录将这份资料作为质疑依据，原始资料仍会保留。',
      nextStep: '可以查看质疑对象和相关依据。',
      source: 'EvidenceLink.status',
      tone: 'caution',
    }),
  }),
  usage_attestation: Object.freeze({
    active: Object.freeze({
      phase: '已采用',
      label: '已记录本地用法',
      description: '系统记录了你对该词在所选方言范围内用法的确认，不代表官方认证。',
      nextStep: '可以查看或补充这条本地使用说明。',
      source: 'UsageAttestation.active',
      tone: 'positive',
    }),
    inactive: Object.freeze({
      phase: '暂不能处理',
      label: '已撤回本地用法',
      description: '这条本地使用确认目前不再作为有效记录展示。',
      nextStep: '如仍使用该说法，可以重新提交一条说明。',
      source: 'UsageAttestation.active',
      tone: 'muted',
    }),
  }),
});

export function contributionStatus(objectType, status) {
  const key = String(status || '').trim();
  return STATUS_MAP[objectType]?.[key] || UNKNOWN_STATUS;
}

export function contributionSuccessMessage() {
  return SUBMISSION_SUCCESS_MESSAGE;
}

export function contributionStatusTypes() {
  return Object.keys(STATUS_MAP);
}

export { STATUS_MAP, UNKNOWN_STATUS };

export default contributionStatus;
