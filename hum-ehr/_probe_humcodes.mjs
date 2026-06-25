// Throwaway probe: discover the real response shape of /hum-codes/* for allergy metadata.
const BASE = 'https://dev-api.humhealth.com/HumHealthDevAPI';
const USER = 'aphysician';
const PASS = 'Humworld@1';

const login = async () => {
  const res = await fetch(`${BASE}/login-web`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS, isWebLogin: 'Y' }),
  });
  const json = await res.json();
  return json?.data?.token;
};

const getHumCodes = async (token, groupCode) => {
  const res = await fetch(`${BASE}/hum-codes/${groupCode}`, {
    headers: { 'X-Auth-Token': token },
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
};

const describe = (label, body) => {
  console.log(`\n========== ${label} ==========`);
  console.log('typeof body        :', typeof body);
  console.log('body.status        :', body?.status);
  const data = body?.data;
  console.log('typeof body.data   :', Array.isArray(data) ? 'array' : typeof data);
  if (Array.isArray(data)) {
    console.log('data.length        :', data.length);
    console.log('data[0]            :', JSON.stringify(data[0], null, 2));
  } else if (data && typeof data === 'object') {
    const keys = Object.keys(data);
    console.log('data keys          :', JSON.stringify(keys));
    console.log('full data object   :', JSON.stringify(data, null, 2));
  } else {
    console.log('data value         :', JSON.stringify(data));
  }
  console.log('FULL RAW BODY      :', JSON.stringify(body, null, 2));
};

const main = async () => {
  const token = await login();
  console.log('token acquired     :', token ? `yes (len ${token.length})` : 'NO');
  if (!token) return;
  const types = await getHumCodes(token, 'PATI-ALRG');
  describe('PATI-ALRG (allergy types)', types);
  const clinical = await getHumCodes(token, 'ALLERGY-CLINICAL-STATUS');
  describe('ALLERGY-CLINICAL-STATUS (clinical statuses)', clinical);
};

main().catch((e) => console.error('PROBE ERROR:', e));
