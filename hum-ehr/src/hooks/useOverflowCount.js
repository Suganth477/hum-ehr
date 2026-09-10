import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

/**
 * "Priority+" overflow measuring for a single-line strip of items (a detail strip,
 * a toolbar, a tab row): tells you how many of `itemCount` items fit on one line at
 * the current width so the caller can put the rest behind a "+N More" control.
 *
 * The strip itself must never wrap — this hook replaces wrapping, it does not
 * cooperate with it. Give the measured container `flex: 1 1 0%; min-width: 0` so its
 * `clientWidth` reports the space it was *allotted* rather than its content width
 * (that also keeps the observer from feeding its own output back in).
 *
 * `containerRef` / `measureRef` are **callback refs**, not ref objects: the elements
 * are tracked in state so the ResizeObserver attaches whenever they appear. A plain
 * `useRef` breaks here — a component that renders a skeleton first mounts with the
 * ref still null, the observer effect runs once against nothing, and the strip then
 * never responds to resizes.
 *
 * Usage:
 *   const { containerRef, measureRef, visibleCount } = useOverflowCount(items.length, { reserve: 92 });
 *   // render items.slice(0, visibleCount) in the strip (ref={containerRef}),
 *   // items.slice(visibleCount) inside the More panel, and ALL items in a
 *   // visually-hidden row (ref={measureRef}) so their natural widths stay measurable.
 *
 * @param {number} itemCount total number of items
 * @param {{ reserve?: number, minVisible?: number }} [options]
 *   `reserve` — px to keep free for the "+N More" control when anything overflows.
 *   `minVisible` — never hide below this many items (default 1: the identifying one).
 * @returns {{ containerRef: (el: any) => void, measureRef: (el: any) => void, visibleCount: number }}
 */
export const useOverflowCount = (itemCount, { reserve = 0, minVisible = 1 } = {}) => {
    const [containerEl, setContainerEl] = useState(null);
    const [measureEl, setMeasureEl] = useState(null);
    const [visibleCount, setVisibleCount] = useState(itemCount);

    const recompute = useCallback(() => {
        if (!containerEl || !measureEl)
            return;
        // Widths come from the hidden measure row, which always holds every item —
        // items moved into the More panel would otherwise have no measurable width.
        const widths = Array.from(measureEl.children).map((child) => child.getBoundingClientRect().width);
        if (!widths.length)
            return;
        const available = containerEl.clientWidth;
        const countThatFits = (budget) => {
            let used = 0;
            let count = 0;
            for (const width of widths) {
                if (used + width > budget)
                    break;
                used += width;
                count += 1;
            }
            return count;
        };
        let count = countThatFits(available);
        // Anything hidden means the More control appears and takes room of its own.
        if (count < widths.length)
            count = countThatFits(available - reserve);
        setVisibleCount(Math.min(widths.length, Math.max(minVisible, count)));
    }, [containerEl, measureEl, reserve, minVisible]);

    // Measure before paint so the strip never flashes at full width.
    useLayoutEffect(() => { recompute(); }, [recompute, itemCount]);

    useEffect(() => {
        if (!containerEl || typeof ResizeObserver === 'undefined')
            return undefined;
        const observer = new ResizeObserver(recompute);
        observer.observe(containerEl);
        return () => observer.disconnect();
    }, [containerEl, recompute]);

    return { containerRef: setContainerEl, measureRef: setMeasureEl, visibleCount };
};

export default useOverflowCount;
