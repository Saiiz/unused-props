<script setup lang="ts">
defineProps<{
  label: string;
  color: string;
}>();
</script>

<template>
  <span>{{ label }}</span>
</template>
