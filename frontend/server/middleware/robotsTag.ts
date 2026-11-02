import { isIndexableHost } from '../../utils/production-host';

/**
 * 只有正式網域（utils/production-host.ts 的 PRODUCTION_HOST 和它的 www.）可以被搜尋引擎索引。
 * 其他主機名稱（DO 演練網址 *.ondigitalocean.app、Zeabur 的 *.zeabur.app、本機）一律加上
 * X-Robots-Tag: noindex，不只依賴 canonical。
 *
 * 用主機名稱判斷而不是另外設一個開關，是為了讓「忘記設定」的結果是不被索引，而不是演練站被索引。
 * 不在 robots.txt 用 Disallow 擋：被擋的網址搜尋引擎讀不到這個標頭，反而可能留下沒有內容的索引。
 */
export default defineEventHandler((event) => {
    if (!isIndexableHost(getRequestHost(event))) {
        setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow');
    }
});
