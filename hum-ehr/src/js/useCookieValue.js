import { useEffect, useState } from 'react';

export const useCookieValue = (cookieName) => {
  const [cookieValue, setCookieValue] = useState(null);

  useEffect(() => {
    const value = document.cookie
      .split('; ')
      .find(row => row.startsWith(cookieName + '='))
      ?.split('=')[1];

    setCookieValue(value || null);
  }, [cookieName]);

  return cookieValue;
};
