<template>
  <view class="quiz-flow">
    <template v-if="question">
      <text class="quiz-step">
        第 {{ answers.length + 1 }} 题，共 {{ questions.length }} 题
      </text>
      <text class="quiz-prompt">
        {{ question.prompt }}
      </text>
      <BaseButton
        v-for="(option, index) in question.options"
        :key="index"
        block
        :variant="selected === index ? 'primary' : 'ghost'"
        :text="option"
        :aria-pressed="selected === index"
        @click="selected = index"
      />
      <BaseButton
        block
        :disabled="selected === null"
        :text="answers.length + 1 === questions.length ? '查看结果与解析' : '下一题'"
        @click="submit"
      />
    </template>
    <template v-else>
      <text class="quiz-prompt">
        答对 {{ score }} / {{ questions.length }} 题
      </text>
      <view
        v-for="(item, index) in questions"
        :key="index"
        class="quiz-review"
      >
        <text class="quiz-step">
          {{ index + 1 }}. {{ item.prompt }}
        </text>
        <text>你的答案 · {{ item.options[answers[index]] }}</text>
        <text>正确答案 · {{ item.options[item.answer] }}</text>
        <text>{{ item.explanation }}</text>
      </view>
      <BaseButton
        variant="ghost"
        text="再答一次"
        @click="reset"
      />
    </template>
  </view>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';

export default {
  components: { BaseButton },
  props: { questions: { type: Array, required: true } },
  data() {
    return { answers: [], selected: null };
  },
  computed: {
    question() {
      return this.questions[this.answers.length];
    },
    score() {
      return this.questions.filter((item, index) => item.answer === this.answers[index]).length;
    },
  },
  methods: {
    submit() {
      if (!this.question || this.selected === null) return;
      this.answers.push(this.selected);
      this.selected = null;
    },
    reset() {
      this.answers = [];
      this.selected = null;
    },
  },
};
</script>

<style scoped>
.quiz-flow,
.quiz-review {
  display: grid;
  gap: 10px;
  margin-top: 16px;
  line-height: 1.6;
}
.quiz-prompt {
  font-size: 19px;
  font-weight: 700;
}
.quiz-step {
  font-weight: 650;
}
.quiz-review {
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 10px;
}
</style>
