import axios from 'axios';
import { isSessionExpiredStatus, notifySessionExpired } from './lib/session';
window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
window.axios.defaults.withXSRFToken = true;

// Background requests (loading a stock-out to edit, POS lookups, ...) that
// hit an ended session explain it instead of failing with a vague error.
window.axios.interceptors.response.use(undefined, (error) => {
    if (isSessionExpiredStatus(error?.response?.status)) {
        notifySessionExpired();
    }

    return Promise.reject(error);
});
