import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import FarmScene from '../../src/components/learning/FarmScene.vue'
import LearningConfirmDialog from '../../src/components/learning/LearningConfirmDialog.vue'
import { claimStarterGift, feedAnimal, plantCrop } from '../../src/learning/farm/farm'
import { createEmptyFarmState } from '../../src/learning/farm/farm-state'

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
