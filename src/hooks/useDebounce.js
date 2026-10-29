/**
 * useDebounce
 * -----------
 * Returns a debounced version of `value` that only updates after
 * `delay` milliseconds have elapsed without another value change.
 *
 * Usage:
 *   const debouncedSearch = useDebounce(searchInput, 400);
 *   // use `debouncedSearch` to trigger API calls
 */
import { useState, useEffect } from "react";

/**
 * @param {*}      value - The value to debounce
 * @param {number} delay - Debounce delay in milliseconds (default 400ms)
 * @returns {*} Debounced value
 */
export function useDebounce(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
