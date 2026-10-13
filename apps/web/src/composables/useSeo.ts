import { computed, type ComputedRef } from 'vue'
import { useHead } from '@unhead/vue'

export const SITE_NAME = '打字乐园'

/**
 * 站点对外地址(canonical/OG/sitemap 使用)。
 * 生产构建可用 VITE_SITE_URL 覆盖(Docker 构建时由 SITE_URL 参数注入);
 * 未设置时:开发环境用当前 origin,生产构建回退到线上域名,
 * 保证预渲染快照里烧录的是对外地址而非预渲染机地址。
 */
const envSiteUrl = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/+$/, '')
export const SITE_ORIGIN =
  envSiteUrl || (import.meta.env.DEV ? window.location.origin : 'https://type.toby-blog.com')

export interface Crumb {
  name: string
  path: string
}

/** 页面完整标题:`{标题} · 打字乐园` */
export function withSite(title: string): string {
  return title ? `${title} · ${SITE_NAME}` : SITE_NAME
}

/** 注入 BreadcrumbList JSON-LD(面包屑结构化数据) */
export function useBreadcrumb(crumbs: ComputedRef<Crumb[]>): void {
  useHead({
    script: computed(() => [
      {
        type: 'application/ld+json',
        textContent: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: crumbs.value.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: c.name,
            item: SITE_ORIGIN + c.path,
          })),
        }),
      },
    ]),
  })
}

/** 注入 ItemList JSON-LD(列表页结构化数据,数据未就绪时不输出) */
export function useItemListSeo(name: string, items: ComputedRef<Crumb[]>): void {
  useHead({
    script: computed(() =>
      items.value.length === 0
        ? []
        : [
            {
              type: 'application/ld+json',
              textContent: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                name,
                itemListElement: items.value.map((item, i) => ({
                  '@type': 'ListItem',
                  position: i + 1,
                  name: item.name,
                  url: SITE_ORIGIN + item.path,
                })),
              }),
            },
          ],
    ),
  })
}
