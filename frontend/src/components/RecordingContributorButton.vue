<template>
  <BaseButton
    v-if="recording.visibility && recording.recorder?.id"
    variant="ghost"
    text="听这位乡友的录音"
    @click="goUserDetail(recording.recorder.id)"
  />
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import { goUserDetail } from '@/services/navigation';

export default {
  components: { BaseButton },
  props: {
    recording: { type: Object, required: true },
  },
  methods: { goUserDetail },
};
</script>
