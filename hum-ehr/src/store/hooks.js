import { useDispatch, useSelector } from 'react-redux';
/**
 * Use these wrappers instead of importing `useDispatch`/`useSelector` from
 * `react-redux` directly. Having a single entry point keeps imports consistent
 * across the app and gives us one place to add typed versions if the project
 * later adopts TypeScript (the standard `withTypes` pattern).
 */
export const useAppDispatch = useDispatch;
export const useAppSelector = useSelector;
