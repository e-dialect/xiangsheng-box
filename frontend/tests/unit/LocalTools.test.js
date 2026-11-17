import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import LocalQuiz from '@/components/localtools/LocalQuiz.vue';
import { quizShareMessage, resolveLocalDialect } from '@/services/localTools';
import { createKinshipEngine } from '@/utils/localtools/kinshipEngine.mjs';
import quiz from '../../../backend/guantou/localtools/examples/quiz.json';
import kinship from '../../../backend/guantou/localtools/examples/kinship.json';

describe('local materials', () => {
  it('uses an explicit selection, then the shared dialect or profile', () => {
    const values = { chosen: 'other', shared: 'share', profile: 'profile', route: 'route' };
    expect(resolveLocalDialect(values)).toBe('other');
    expect(resolveLocalDialect({ ...values, chosen: '' })).toBe('share');
    expect(resolveLocalDialect({ ...values, chosen: '', shared: '' })).toBe('profile');
  });

  it('shares a pinned quiz and cold-starts a fresh copy at question one', async () => {
    const local = mount(LocalQuiz, { props: { questions: quiz.payload.questions } });
    await local.findAllComponents({ name: 'BaseButton' })[0].vm.$emit('click');
    await local.findAllComponents({ name: 'BaseButton' }).at(-1).vm.$emit('click');
    expect(local.text()).toContain('第 2 题');

    const message = quizShareMessage(quiz.dialect, { ...quiz, score: 1, answers: [0], userId: 888 });
    const url = new URL(message.path, 'https://example.test');
    expect(Object.fromEntries(url.searchParams.entries())).toEqual({
      dialect: quiz.dialect,
      tool: 'quiz',
      quiz: quiz.version,
    });
    const fresh = mount(LocalQuiz, { props: { questions: quiz.payload.questions } });
    expect(fresh.text()).toContain('第 1 题');
  });

  it('uses scoped roles and reports ambiguity or missing coverage', () => {
    const engine = createKinshipEngine(kinship.payload);
    const step = (state, field) => engine.reduce(state, { type: 'advance', field });
    const initial = engine.createSession();
    const father = step(initial, 'fa');
    expect(engine.selected(father).roleId).toBe('father');
    const uncle = step(father, 'di');
    expect(engine.selected(uncle).roleId).toBe('younger-uncle');
    const aunt = step(uncle, 'qi');
    expect(engine.selected(aunt).roleId).toBe('younger-aunt');
    expect(engine.selected(engine.reduce(aunt, { type: 'back' })).roleId).toBe('younger-uncle');
    expect(engine.reduce(aunt, { type: 'clear' }).path).toEqual([]);
    const grandfather = step(father, 'fa');
    const candidates = step(grandfather, 'zi');
    expect(candidates.candidates.map((item) => item.roleId)).toEqual(
      expect.arrayContaining(['father', 'younger-uncle', 'elder-uncle']),
    );
    expect(engine.selected(candidates)).toBeNull();
    expect(step(initial, 'zi').status).toBe('unsupported');
  });
});
