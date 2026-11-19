<template>
  <text class="tag-chip" :style="{ background: color, color: textColor }" @tap="onTap">{{ name }}</text>
</template>

<script>
export default {
  name: 'TagChip',
  props: {
    name: { type: String, default: '' },
    color: { type: String, default: '#e4e7ed' },
    active: { type: Boolean, default: false }
  },
  computed: {
    textColor: function () { return this.active ? '#fff' : '#606266' }
  },
  methods: {
    onTap: function () { this.$emit('tap', this.name) }
  }
}
</script>

<style scoped>
.tag-chip { display: inline-block; font-size: 22rpx; padding: 6rpx 18rpx; border-radius: 999rpx; margin-right: 12rpx; opacity: 0.92; }
</style>
