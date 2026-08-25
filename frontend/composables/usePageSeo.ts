import type { PageSeoOptions } from '~/types/seo';

/**
 * 集中設定單一頁面的 title / description / canonical / OG / Twitter Card，
 * 避免每個頁面重複寫相同 meta。使用官方推薦的 useSeoMeta。
 */
export function usePageSeo(options: PageSeoOptions) {
    const site = useLaborSiteConfig();
    const canonical = useCanonicalUrl(options.path);
    const image = options.image
        ? options.image.startsWith('http')
            ? options.image
            : `${site.url}${options.image}`
        : site.defaultOgImage;

    useSeoMeta({
        title: options.title,
        description: options.description,
        ogTitle: options.title,
        ogDescription: options.description,
        ogType: options.type ?? 'website',
        ogUrl: canonical,
        ogImage: image,
        ogLocale: site.locale,
        ogSiteName: site.shortName,
        twitterCard: 'summary_large_image',
        twitterTitle: options.title,
        twitterDescription: options.description,
        twitterImage: image,
        robots: options.noindex ? 'noindex, nofollow' : 'index, follow'
    });

    useHead({
        link: [{ rel: 'canonical', href: canonical }]
    });

    return { canonical, image };
}
