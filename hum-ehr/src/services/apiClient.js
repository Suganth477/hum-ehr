import axios from 'axios';
import { getAuthToken, clearAuthToken } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const apiClient = axios.create({
	baseURL: API_BASE_URL,
	timeout: 60000,
});

apiClient.interceptors.request.use(
	(config) => {
		const token = getAuthToken();

		if (token) {
			config.headers['X-Auth-Token'] = token;
		}

		return config;
	},
	(error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
	(response) => response.data,
	(error) => {
		if (error.response?.status === 401) {
			// clearAuthToken();
			// window.location.href = `${env.BASE_URL || ''}/logout`;
			return Promise.reject(error);
		}

		const message =
			error.response?.data?.message ||
			error.response?.data?.error ||
			error.message ||
			'Something went wrong. Please try again.';

		return Promise.reject({ ...error, message });
	}
);

export const apiGet = (url, config = {}) => apiClient.get(url, config);

export const apiPost = (url, data = {}, config = {}) => apiClient.post(url, data, config);

export const apiPostForm = (url, data = {}, config = {}) => {
	const formData = new URLSearchParams();

	Object.entries(data || {}).forEach(([key, value]) => {
		if (value !== undefined && value !== null) {
			formData.append(key, value);
		}
	});

	return apiClient.post(url, formData, {
		...config,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			...(config.headers || {}),
		},
	});
};

export const apiPostMultipart = (url, data = {}, config = {}) => {
	const formData = new FormData();

	Object.entries(data || {}).forEach(([key, value]) => {
		if (Array.isArray(value)) {
			value.forEach((item) => formData.append(key, item));
		} else if (value !== undefined && value !== null) {
			formData.append(key, value);
		}
	});

	return apiClient.post(url, formData, config);
};

export const apiPut = (url, data = {}, config = {}) => apiClient.put(url, data, config);

export const apiDelete = (url, config = {}) => apiClient.delete(url, config);

export default apiClient;
