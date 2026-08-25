import helmet from 'helmet';
import type { IncomingMessage, ServerResponse } from 'http';

export default defineEventHandler((event) => {
    try {
        const req = event.node.req as IncomingMessage;
        const res = event.node.res as ServerResponse;

        helmet({
            contentSecurityPolicy: false,
            referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
            xXssProtection: true,
            xFrameOptions: false
        })(req, res, () => {});
    } catch (error) {
        console.error('[helmet middleware] error:', error);
    }
});

