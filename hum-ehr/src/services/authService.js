import Cookies from 'js-cookie';
const TOKEN_COOKIE_NAME = 'X-Auth-Token';
export const getAuthToken = () => Cookies.get(TOKEN_COOKIE_NAME) ?? '';
export const clearAuthToken = () => Cookies.remove(TOKEN_COOKIE_NAME);
export const storeAuthToken = (token, options = {}) => {
	if (!token)
		return;
	// `sameSite`/`secure` are the hardening we can apply from JS. A true
	// `httpOnly` cookie can only be set by the server, so XSS-proof storage
	// remains a backend change (see review notes). `secure` is gated on HTTPS
	// so local http dev still works.
	Cookies.set(TOKEN_COOKIE_NAME, token, {
		expires: 1,
		path: '/',
		sameSite: 'Strict',
		secure: window.location.protocol === 'https:',
		...options,
	});
};
export const parseJwtToken = (token = getAuthToken()) => {
	if (!token || !token.includes('.'))
		return null;
	try {
		const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
		const json = decodeURIComponent(window
			.atob(base64)
			.split('')
			.map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
			.join(''));
		return JSON.parse(json);
	}
	catch (error) {
		console.error('Invalid auth token.', error);
		return null;
	}
};
export const getLoggedInUser = () => parseJwtToken();
export const isTokenExpired = (token = getAuthToken()) => {
	const payload = parseJwtToken(token);
	if (!payload?.exp)
		return false;
	return Date.now() >= payload.exp * 1000;
};
// NOTE: the old `mapLoginGlobals` that wrote ~15 values onto `window` is
// intentionally NOT ported. Carrying that pattern into React reintroduces
// the global mutable state the migration is meant to remove. Instead, expose
// the login data through a React context (see review notes) so components read
// it reactively and tests can inject it.
const authService = {
	getAuthToken,
	clearAuthToken,
	storeAuthToken,
	parseJwtToken,
	getLoggedInUser,
	isTokenExpired,
};
export default authService;
