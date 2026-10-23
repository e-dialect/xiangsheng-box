import { describe, expect, it } from 'vitest';

import {
  CONTRIBUTION_PHASES,
  STATUS_MAP,
  SUBMISSION_SUCCESS_MESSAGE,
  contributionStatus,
  contributionStatusTypes,
  contributionSuccessMessage,
  UNKNOWN_STATUS,
} from '@/services/contributionStatus';

describe('#427 subtask B: contribution status contract', () => {
  it('maps workflow keys to neutral user-facing language', () => {
    expect(contributionStatus('recording', 'published')).toMatchObject({
      phase: '已采用',
      label: '已公开',
      tone: 'positive',
      source: 'Recording.status',
    });
    expect(contributionStatus('recording_link', 'suggested')).toMatchObject({
      phase: '处理中',
      label: '关联待确认',
      source: 'RecordingEntryLink.status',
    });
    expect(contributionStatus('evidence_link', 'supports').description).toContain('不表示');
  });

  it.each([
    [true, 'active', '已记录本地用法', '已采用'],
    [false, 'inactive', '已撤回本地用法', '暂不能处理'],
  ])('maps the API active boolean %s and preserves string compatibility', (value, key, label, phase) => {
    const status = contributionStatus('usage_attestation', value);
    expect(status).toBe(contributionStatus('usage_attestation', key));
    expect(status).toMatchObject({ label, phase, source: 'UsageAttestation.active' });
  });

  it.each(['submitted', 'supports', 'disputes'])('uses the real evidence relation field for %s', (relation) => {
    expect(contributionStatus('evidence_link', relation).source).toBe('EvidenceLink.relation_type');
  });

  it.each([null, undefined, '', 'future_state', 0, 1])('keeps unknown usage values %s unconfirmed', (value) => {
    expect(contributionStatus('usage_attestation', value)).toBe(UNKNOWN_STATUS);
  });

  it('does not interpret booleans as statuses for other object types', () => {
    expect(contributionStatus('recording', true)).toBe(UNKNOWN_STATUS);
    expect(contributionStatus('recording', false)).toBe(UNKNOWN_STATUS);
  });

  it('maps the four stable user-facing phases and keeps submission feedback separate', () => {
    expect(CONTRIBUTION_PHASES).toEqual(['处理中', '已采用', '待补充', '暂不能处理']);
    expect(contributionStatus('recording_link', 'suggested').phase).toBe('处理中');
    expect(contributionStatus('recording', 'published').phase).toBe('已采用');
    expect(contributionStatus('recording', 'disputed').phase).toBe('待补充');
    expect(contributionStatus('recording', 'rejected').phase).toBe('暂不能处理');
    expect(contributionSuccessMessage()).toBe(SUBMISSION_SUCCESS_MESSAGE);
    expect(contributionSuccessMessage()).toBe('已提交，等待审核');
  });

  it('gives every real state a phase, source, explanation and next step', () => {
    Object.values(STATUS_MAP)
      .flatMap((states) => Object.values(states))
      .forEach((status) => {
        expect(CONTRIBUTION_PHASES).toContain(status.phase);
        expect(status.source).toBeTruthy();
        expect(status.label).toBeTruthy();
        expect(status.description).toBeTruthy();
        expect(status.nextStep).toBeTruthy();
      });
  });

  it('keeps authority claims and completed-result claims out of all messages', () => {
    const messages = Object.values(STATUS_MAP)
      .flatMap((states) => Object.values(states))
      .flatMap((status) => [status.label, status.description, status.nextStep]);
    const unqualifiedAuthorityClaim = messages.filter((message) => (
      /官方认证|权威认证|审核通过|审核失败|证明正确/.test(message)
      && !/(不表示|不等于|不代表)[^。！？]*(官方认证|权威认证|审核通过|审核失败|证明正确)/.test(message)
    ));
    expect(unqualifiedAuthorityClaim).toEqual([]);
    expect(messages.join(' ')).not.toMatch(/已收录|已经修正/);
    expect(contributionSuccessMessage()).not.toMatch(/已收录|已经修正|官方认证|证明正确/);
  });

  it('does not turn unknown states into an authority claim', () => {
    expect(contributionStatus('recording', 'future_state')).toBe(UNKNOWN_STATUS);
    expect(contributionStatus('missing_type', 'published')).toBe(UNKNOWN_STATUS);
    expect(UNKNOWN_STATUS.label).not.toMatch(/官方|认证|审核失败/);
    expect(UNKNOWN_STATUS.phase).toBe('处理中');
    expect(UNKNOWN_STATUS.source).toBe('未知对象或未知状态');
  });

  it('covers the current V2 contribution object types', () => {
    expect(contributionStatusTypes()).toEqual([
      'entry',
      'sense',
      'writing',
      'pronunciation',
      'recording',
      'recording_link',
      'evidence_link',
      'usage_attestation',
    ]);
  });
});
