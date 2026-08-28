// UX guard only — keeps a logged-out visitor from landing on an empty/erroring admin
// page before the API calls fail. The real authorization boundary is the backend's
// `authenticate -> requireAdmin` chain (specs/backend/laravel-to-node-parity.md §10.13);
// this middleware never decodes the token or checks admin status, it only checks presence.
export default defineNuxtRouteMiddleware((to) => {
    if (!to.path.startsWith('/admin')) return;
    // No localStorage on the server — defer the check to the client render/navigation.
    if (process.server) return;

    const token = localStorage.getItem('token');
    if (!token) {
        return navigateTo('/auth');
    }
});
