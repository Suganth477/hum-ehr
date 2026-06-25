import axios from 'axios';
import config from '../config/env';
import { getAuthToken, clearAuthToken } from './authService';
const apiClient = axios.create({
	baseURL: config.apiBaseUrl,
	timeout: 60000,
});
apiClient.interceptors.request.use((cfg) => {
	const token = getAuthToken();
	if (token) {
		cfg.headers.set('X-Auth-Token', token);
	}
	return cfg;
});
// Guards against a redirect storm: when an expired session causes several
// in-flight requests to 401 at once, only the first one drives the logout.
let isHandlingUnauthorized = false;
apiClient.interceptors.response.use(
	// Unwrap to the response body so callers receive the API envelope directly.
	(response) => response.data, (error) => {
		if (error.response?.status === 401) {
			if (!isHandlingUnauthorized) {
				isHandlingUnauthorized = true;
				clearAuthToken();
				window.location.href = `${config.apiBaseUrl}/logout`;
			}
			return Promise.reject(error);
		}
		const apiError = {
			message: error.response?.data?.message ??
				error.response?.data?.error ??
				error.message ??
				'Something went wrong. Please try again.',
			status: error.response?.status,
			cause: error,
		};
		return Promise.reject(apiError);
	});
// Because the interceptor unwraps to `response.data`, each helper resolves to T
// (the parsed body), NOT an AxiosResponse. The cast reflects that runtime reality.
export const apiGet = (url, cfg = {}) => apiClient.get(url, cfg);
export const apiPost = (url, data = {}, cfg = {}) => apiClient.post(url, data, cfg);
export const apiPut = (url, data = {}, cfg = {}) => apiClient.put(url, data, cfg);
export const apiDelete = (url, cfg = {}) => apiClient.delete(url, cfg);
export const apiPostForm = (url, data = {}, cfg = {}) => {
	const form = new URLSearchParams();
	Object.entries(data).forEach(([key, value]) => {
		if (value !== undefined && value !== null)
			form.append(key, String(value));
	});
	return apiClient.post(url, form, {
		...cfg,
		headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...cfg.headers },
	});
};
export const apiPostMultipart = (url, data = {}, cfg = {}) => {
	const form = new FormData();
	Object.entries(data).forEach(([key, value]) => {
		if (Array.isArray(value))
			value.forEach((item) => form.append(key, item));
		else if (value !== undefined && value !== null)
			form.append(key, value);
	});
	return apiClient.post(url, form, cfg);
};
export default apiClient;
