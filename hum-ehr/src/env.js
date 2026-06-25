// Backwards-compatible shim for legacy modules that still `import env from '../env'`.
// NO secrets here — see config/env.ts for the rationale. Only browser-safe values,
// read from Vite env vars. Prefer importing from `config/env` in new code.
import { config } from './config/env';
const env = {
    BASE_URL: config.apiBaseUrl,
    APP_VERSION: config.appVersion,
    RPM_DEVICE_ENV: config.deviceEnv,
};
export default env;
