// 執行：npm test（Node 22 內建的 node:test 和 type stripping，不需要另外安裝測試套件）
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PRODUCTION_HOST, isIndexableHost, normalizeHost, productionRedirectUrl } from '../utils/production-host.ts';

describe('PRODUCTION_HOST', () => {
    it('固定是正式主網域', () => {
        assert.equal(PRODUCTION_HOST, 'laborservice5690.com');
    });
});

describe('normalizeHost', () => {
    it('小寫、去掉 port 和結尾的點', () => {
        assert.equal(normalizeHost('WWW.LaborService5690.com.:443'), 'www.laborservice5690.com');
        assert.equal(normalizeHost(undefined), '');
    });
});

describe('isIndexableHost', () => {
    it('正式主網域和 www 可以索引', () => {
        for (const host of ['laborservice5690.com', 'www.laborservice5690.com', 'LABORSERVICE5690.COM:443']) {
            assert.equal(isIndexableHost(host), true, host);
        }
    });

    it('演練、舊站、本機和相似網域都不能索引', () => {
        for (const host of [
            'jinfeng-vchs6.ondigitalocean.app',
            'jinfengv2.zeabur.app',
            'localhost:3000',
            '127.0.0.1',
            'evil-laborservice5690.com',
            'laborservice5690.com.evil.io',
            'xlaborservice5690.com',
            'do-test.laborservice5690.com',
            'www.www.laborservice5690.com',
            '',
            undefined
        ]) {
            assert.equal(isIndexableHost(host), false, String(host));
        }
    });
});

describe('productionRedirectUrl', () => {
    it('www 轉到 https 主網域，保留路徑和 query', () => {
        assert.equal(
            productionRedirectUrl('www.laborservice5690.com', 'https', '/faq', '?a=1&b=2'),
            'https://laborservice5690.com/faq?a=1&b=2'
        );
    });

    it('主網域的 http 轉成 https', () => {
        assert.equal(productionRedirectUrl('laborservice5690.com', 'http', '/', ''), 'https://laborservice5690.com/');
        assert.equal(productionRedirectUrl('laborservice5690.com', 'http, https', '/x', ''), 'https://laborservice5690.com/x');
    });

    it('主網域的 https 不轉址', () => {
        assert.equal(productionRedirectUrl('laborservice5690.com', 'https', '/faq', ''), null);
        assert.equal(productionRedirectUrl('laborservice5690.com', undefined, '/faq', ''), null);
    });

    it('其他主機名稱不轉址，包含 www 開頭的非正式網域', () => {
        for (const host of ['jinfeng-vchs6.ondigitalocean.app', 'www.evil.com', 'www.laborservice5690.com.evil.io', '']) {
            assert.equal(productionRedirectUrl(host, 'http', '/faq', ''), null, host);
        }
    });

    it('目的地主機固定，路徑無法把轉址帶到別的網域', () => {
        for (const path of ['//evil.com', '/\\evil.com', '@evil.com', '/%2F%2Fevil.com']) {
            const target = productionRedirectUrl('www.laborservice5690.com', 'https', path, '');
            assert.ok(target, path);
            assert.equal(new URL(target).host, 'laborservice5690.com', path);
        }
    });
});
