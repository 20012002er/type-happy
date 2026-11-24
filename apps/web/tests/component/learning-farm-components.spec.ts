import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import FarmScene from '../../src/components/learning/FarmScene.vue'
import LearningConfirmDialog from '../../src/components/learning/LearningConfirmDialog.vue'
import { claimStarterGift, feedAnimal, plantCrop } from '../../src/learning/farm/farm'
import { createEmptyFarmState } from '../../src/learning/farm/farm-state'
import { FARM_SCENE_ASSETS, type FarmPixiModule } from '../../src/learning/farm/scene-renderer'
import type { ProcessingState } from '../../src/learning/processing/state'
import { createPixiTestDouble } from '../helpers/pixi'

const NOW = new Date(2026, 10, 20, 12).getTime()
const MINUTE = 60_000

function growingFarm() {
  let farm = claimStarterGift(createEmptyFarmState(), { actionId: 'gift', now: NOW })
  farm = plantCrop(farm, { actionId: 'plant', now: NOW, plotId: 'plot-1', cropId: 'radish' })
  return feedAnimal(farm, { actionId: 'feed', now: NOW, animalId: 'chicken-1' })
}

describe('FarmScene', () => {
  it('shows text and pixel graphics for locked, empty, growing and producing states', async () => {
    const wrapper = mount(FarmScene, {
      props: { farm: growingFarm(), now: NOW, selectedKey: null, busy: false },
    })
    expect(wrapper.findAll('.farm-plot')).toHaveLength(8)
    expect(wrapper.findAll('.farm-plot:disabled')).toHaveLength(4)
    expect(wrapper.find('.farm-crop--radish').exists()).toBe(true)
    expect(wrapper.find('.farm-chicken-pixel').exists()).toBe(true)
    expect(wrapper.text()).toContain('萝卜 · 生长中')
    expect(wrapper.text()).toContain('空地 · 可播种')
    expect(wrapper.text()).toContain('生产中')
    expect(wrapper.text()).toContain('尚未解锁')

    await wrapper.find('.farm-plot:not(:disabled)').trigger('click')
    await wrapper.find('.farm-animal').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['plot:plot-1'], ['animal:chicken-1']])

    await wrapper.setProps({ now: NOW + 60 * MINUTE, selectedKey: 'plot:plot-1' })
    expect(wrapper.text()).toContain('萝卜 · 可收获')
    expect(wrapper.text()).toContain('鸡蛋 · 可收取')
    expect(wrapper.find('.farm-crop.is-ready').exists()).toBe(true)
    expect(wrapper.find('.farm-animal.is-ready').exists()).toBe(true)
    expect(wrapper.find('.farm-plot[aria-pressed="true"]').exists()).toBe(true)
  })
})

describe('FarmScene Pixi integration (WP09)', () => {
  function pixiDouble() {
    const resources = Object.fromEntries(
      FARM_SCENE_ASSETS.map((asset) => [asset.src, { id: asset.alias }]),
    )
    const pixi = createPixiTestDouble(resources)
    const applications: InstanceType<typeof pixi.Application>[] = []
    class TrackedApplication extends pixi.Application {
      constructor() {
        super()
        applications.push(this)
      }
    }
    return {
      pixi,
      applications,
      module: { ...pixi, Application: TrackedApplication } as unknown as FarmPixiModule,
    }
  }

  function stubRects(element: HTMLElement): void {
    element.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 600, bottom: 400, width: 600, height: 400 }) as DOMRect
    element.querySelectorAll<HTMLElement>('[data-scene-anchor]').forEach((anchor, index) => {
      anchor.getBoundingClientRect = () =>
        ({
          left: index * 50,
          top: 10,
          right: index * 50 + 40,
          bottom: 50,
          width: 40,
          height: 40,
        }) as DOMRect
    })
  }

  async function flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0))
    await nextTick()
  }

  it('mounts an aria-hidden canvas layer while keeping DOM text and buttons interactive', async () => {
    const { module, applications } = pixiDouble()
    const wrapper = mount(FarmScene, {
      props: { farm: growingFarm(), now: NOW, selectedKey: null, busy: false, pixi: module },
      attachTo: document.body,
    })
    stubRects(wrapper.element as HTMLElement)
    await flush()
    expect(wrapper.find('.farm-scene--pixi').exists()).toBe(true)
    const canvas = wrapper.find('.farm-scene__canvas canvas')
    expect(canvas.exists()).toBe(true)
    expect(canvas.attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toContain('萝卜 · 生长中')
    await wrapper.find('.farm-plot:not(:disabled)').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['plot:plot-1']])
    expect(applications[0].ticker.listenerCount).toBe(1)
    wrapper.unmount()
    expect(applications[0].destroyed).toBe(true)
    expect(applications[0].ticker.listenerCount).toBe(0)
    expect(document.body.querySelector('.farm-scene__canvas canvas')).toBeNull()
  })

  it('falls back to the static DOM scene when assets fail, operations still work', async () => {
    const { module, pixi } = pixiDouble()
    pixi.Assets.failNext(FARM_SCENE_ASSETS[0].src)
    const wrapper = mount(FarmScene, {
      props: { farm: growingFarm(), now: NOW, selectedKey: null, busy: false, pixi: module },
    })
    await flush()
    expect(wrapper.find('.farm-scene--pixi').exists()).toBe(false)
    expect(wrapper.find('.farm-scene__canvas canvas').exists()).toBe(false)
    expect(wrapper.text()).toContain('萝卜 · 生长中')
    await wrapper.find('.farm-animal').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['animal:chicken-1']])
    wrapper.unmount()
  })

  it('honors reduced motion with a static canvas and exposes save-success feedback', async () => {
    const { module, applications } = pixiDouble()
    const wrapper = mount(FarmScene, {
      props: {
        farm: growingFarm(),
        now: NOW,
        selectedKey: null,
        busy: false,
        pixi: module,
        motionReduced: true,
      },
      attachTo: document.body,
    })
    stubRects(wrapper.element as HTMLElement)
    await flush()
    expect(applications[0].ticker.started).toBe(false)
    const vm = wrapper.vm as unknown as {
      playFeedback: (id: string, kind: 'harvest') => void
      playCoins: (amount: number) => void
    }
    const stageCount = applications[0].stage.children.length
    vm.playFeedback('plot:plot-1', 'harvest')
    vm.playCoins(3)
    expect(applications[0].stage.children.length).toBe(stageCount)
    await wrapper.setProps({ motionReduced: false })
    expect(applications[0].ticker.started).toBe(true)
    vm.playCoins(3)
    expect(applications[0].stage.children.length).toBe(stageCount + 1)
    wrapper.unmount()
  })

  it('shows processing workshop text states without relying on the canvas', () => {
    const farm = growingFarm()
    const locked = mount(FarmScene, {
      props: { farm, now: NOW, selectedKey: null, busy: false },
    })
    expect(locked.text()).toContain('加工坊')
    expect(locked.text()).toContain('累计手动收获 0 / 3 份后解锁购买')
    locked.unmount()

    const purchased: ProcessingState = {
      workshop: {
        purchased: true,
        activeTask: null,
        pendingOutput: { taskId: 't', productId: 'flour', quantity: 1, completedAt: NOW },
      },
      actions: {},
    }
    const ready = mount(FarmScene, {
      props: { farm, now: NOW, selectedKey: null, busy: false, processing: purchased },
    })
    expect(ready.text()).toContain('加工品可收取 × 1')
    expect(ready.text()).toContain('待收 1 份')
    ready.unmount()
  })
})

describe('LearningConfirmDialog', () => {
  it('traps focus, supports Escape and restores the invoking control', async () => {
    const invoker = document.createElement('button')
    invoker.textContent = '购买土地'
    document.body.append(invoker)
    invoker.focus()
    const wrapper = mount(LearningConfirmDialog, {
      attachTo: document.body,
      props: {
        title: '购买第 5 块土地？',
        description: '确认扣款与容量',
        lines: ['总价：100 学习金币', '土地数量：4 → 5 块'],
        confirmLabel: '确认支付 100 金币',
      },
    })
    await nextTick()
    const dialog = document.body.querySelector('.farm-dialog')!
    const cancel = document.body.querySelector<HTMLButtonElement>('.farm-dialog__cancel')!
    const confirm = document.body.querySelector<HTMLButtonElement>('.farm-dialog__confirm')!
    expect(document.activeElement).toBe(cancel)
    expect(dialog.textContent).toContain('总价：100 学习金币')

    cancel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
    )
    expect(document.activeElement).toBe(confirm)
    confirm.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(cancel)
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    await confirm.click()
    expect(wrapper.emitted('confirm')).toHaveLength(1)

    wrapper.unmount()
    expect(document.activeElement).toBe(invoker)
    invoker.remove()
  })

  it('does not cancel while an operation is being saved', async () => {
    const wrapper = mount(LearningConfirmDialog, {
      props: { title: '出售全部？', busy: true },
    })
    await nextTick()
    document.body
      .querySelector('.farm-dialog')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('cancel')).toBeUndefined()
    expect(document.body.querySelector<HTMLButtonElement>('.farm-dialog__confirm')!.disabled).toBe(
      true,
    )
    wrapper.unmount()
  })
})
