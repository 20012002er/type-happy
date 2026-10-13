/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'vue-i18n' {
  import { DefineLocaleMessage } from 'vue-i18n'
  export interface DefineLocaleMessage extends Record<string, any> {}
}

declare module '*.json5' {
  const value: any
  export default value
}
