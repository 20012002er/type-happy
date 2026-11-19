import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ProbeComponent from './fixtures/ProbeComponent.vue'

describe('Vue component test environment', () => {
  it('mounts a component, handles interaction and emits an event', async () => {
    const wrapper = mount(ProbeComponent)
    const button = wrapper.get('button')

    expect(button.text()).toBe('已点击 0 次')
    await button.trigger('click')
    expect(button.text()).toBe('已点击 1 次')
    expect(wrapper.emitted('change')).toEqual([[1]])
  })
})
