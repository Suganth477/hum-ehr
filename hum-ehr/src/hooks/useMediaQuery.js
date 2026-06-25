import { useEffect, useState } from 'react';
/**
 * Subscribe to a CSS media query and re-render when it starts/stops matching.
 * The single source of truth for breakpoint-driven *rendering* decisions
 * (e.g. table vs. card). Breakpoints below mirror Bootstrap 5 so JS and CSS
 * agree. For pure styling, prefer CSS media queries / Bootstrap utilities;
 * reach for these hooks only when the markup itself must differ.
 */
export const useMediaQuery = (query) => {
    const getMatch = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(query).matches
        : false);
    const [matches, setMatches] = useState(getMatch);
    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
            return undefined;
        const mql = window.matchMedia(query);
        const onChange = () => setMatches(mql.matches);
        onChange();
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, [query]);
    return matches;
};
/** True below the `md` breakpoint (< 768px) — phones. */
export const useIsMobile = () => useMediaQuery('(max-width: 767.98px)');
/** True below the `lg` breakpoint (< 992px) — phones + small tablets. */
export const useIsTabletOrBelow = () => useMediaQuery('(max-width: 991.98px)');
