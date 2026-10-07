<template>
  <div class="page-header reveal-up" style="--delay: 0.04s">
    <div>
      <p class="page-eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p class="page-description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="page-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  eyebrow: string
  title: string
  description: string
}>()
</script>
