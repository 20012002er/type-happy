import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/**
 * 观察元素尺寸变化,返回实时 width/height(用于游戏区域坐标计算)。
 */
export function useElementSize(el: Ref<HTMLElement | null>) {
  const width = ref(0)
  const height = ref(0)

  let ro: ResizeObserver | null = null

  function measure(): void {
    const node = el.value
    if (!node) return
    const rect = node.getBoundingClientRect()
    width.value = rect.width
    height.value = rect.height
  }

  onMounted(() => {
    measure()
    if (typeof ResizeObserver !== 'undefined' && el.value) {
      ro = new ResizeObserver(measure)
      ro.observe(el.value)
    } else {
      window.addEventListener('resize', measure)
    }
  })

  onBeforeUnmount(() => {
    ro?.disconnect()
    ro = null
    window.removeEventListener('resize', measure)
  })

  return { width, height, measure }
}
