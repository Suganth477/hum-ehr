import Cookies from 'js-cookie';

const TOKEN_COOKIE_NAME = 'X-Auth-Token';

export const getAuthToken = () => Cookies.get(TOKEN_COOKIE_NAME) || '';

export const clearAuthToken = () => Cookies.remove(TOKEN_COOKIE_NAME);

export const parseJwtToken = (token = getAuthToken()) => {
	if (!token || !token.includes('.')) return null;

	try {
		const base64Url = token.split('.')[1];
		const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
		const jsonPayload = decodeURIComponent(
			window
				.atob(base64)
				.split('')
				.map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
				.join('')
		);

		return JSON.parse(jsonPayload);
	} catch (error) {
		console.error('Invalid auth token.', error);
		return null;
	}
};

export const getLoggedInUser = () => parseJwtToken();

export const isTokenExpired = (token = getAuthToken()) => {
	const payload = parseJwtToken(token);
	if (!payload?.exp) return false;
	return Date.now() >= payload.exp * 1000;
};

const authService = {
	getAuthToken,
	clearAuthToken,
	parseJwtToken,
	getLoggedInUser,
	isTokenExpired,
};

export default authService;

export const storeAuthToken = (token, options = {}) => {
	if (!token) return;
	Cookies.set(TOKEN_COOKIE_NAME, token, { expires: 1, path: '/', ...options });
};

export const mapLoginGlobals = (loginResponse = {}) => {
	const data = loginResponse.data || {};
	window.url = window.location.origin;
	window.env = data.environment?.RPM_DEVICE_ENV || 'TEST';
	window.productUrl = `${window.location.origin}/${data.user?.programCode || ''}`;
	window.api = data.environment?.JAVA_URL;
	window.appVersion = data.environment?.APP_VERSION;
	window.screenLockDuration = (data.user?.timeOutDuration || 0) * 60 * 1000;
	window.WRIGHT_CENTER_CARE_GROUP_ID = data.environment?.WRIGHT_CENTER_ID;
	window.EAST_ALABAMA_CARE_GROUP_ID = data.environment?.EAST_ALABAMA_CARE_GROUP_ID;
	window.DEVICE_ORDER_PILOT_CAREGROUP = data.environment?.DEVICE_ORDER_PILOT_CAREGROUP;
	window.EHR_ELIGIBLE_CARE_GROUP = data.environment?.EHR_ELIGIBLE_CARE_GROUP;
	window.CARE_TEAM_COMMUNICATION = data.environment?.CARE_TEAM_COMMUNICATION;
	window.SDOHVisitCompletedFlag = 'Y';
};
