/**
 * 產生正式網址格式的 canonical URL，全站統一「無結尾斜線」格式（首頁除外，首頁即為網域根目錄）。
 * @param path 選填，未提供時取目前路由路徑
 */
export function useCanonicalUrl(path?: string) {
    const { url } = useLaborSiteConfig();
    const route = useRoute();
    const rawPath = path ?? route.path;
    const trimmed = rawPath.replace(/\/+$/, '');

    return trimmed === '' || trimmed === '/' ? url : `${url}${trimmed}`;
}
