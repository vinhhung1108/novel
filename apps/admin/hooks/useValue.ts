import { useState, useRef, useEffect } from "react";

type SetStateAction<T> = T | ((prev: T) => T);

type UseValueReturn<T> = {
  value: T;
  setValue: (action: SetStateAction<T>) => void;
  reset: () => void;
  isControlled: boolean;
  prevValue: T | undefined;
};

/**
 * useValue - supports controlled or uncontrolled value patterns.
 *
 * Usage:
 * const { value, setValue, reset, isControlled, prevValue } = useValue(propValue, defaultValue, onChange)
 *
 * - If propValue is undefined the hook is uncontrolled and manages internal state.
 * - If propValue is provided the hook is controlled and will call onChange when setValue is used.
 */
export default function useValue<T>(
  propValue: T | undefined,
  defaultValue: T | (() => T),
  onChange?: (next: T) => void
): UseValueReturn<T> {
  const isControlled = propValue !== undefined;

  const resolveDefault = () =>
    typeof defaultValue === "function"
      ? (defaultValue as () => T)()
      : (defaultValue as T);

  const [internalValue, setInternalValue] = useState<T>(() =>
    isControlled ? (propValue as T) : resolveDefault()
  );

  const prevRef = useRef<T | undefined>(undefined);
  const wasControlledRef = useRef<boolean>(isControlled);

  // keep prevValue in sync
  useEffect(() => {
    prevRef.current = isControlled ? propValue : internalValue;
  }, [propValue, internalValue, isControlled]);

  // If control mode changes from controlled -> uncontrolled, seed internal value
  useEffect(() => {
    if (wasControlledRef.current && !isControlled) {
      // transition controlled -> uncontrolled: seed internal with last propValue or default
      setInternalValue((propValue as T) ?? resolveDefault());
    }
    wasControlledRef.current = isControlled;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled]);

  const value = (isControlled ? (propValue as T) : internalValue) as T;

  const setValue = (action: SetStateAction<T>) => {
    const next =
      typeof action === "function"
        ? (action as (prev: T) => T)(value)
        : (action as T);

    if (!isControlled) {
      setInternalValue(next);
    }

    if (onChange) {
      try {
        onChange(next);
      } catch {
        // swallow errors from consumer onChange to avoid breaking internal state flow
      }
    }
  };

  const reset = () => {
    const next = resolveDefault();
    if (!isControlled) {
      setInternalValue(next);
    }
    if (onChange) onChange(next);
  };

  return {
    value,
    setValue,
    reset,
    isControlled,
    prevValue: prevRef.current,
  };
}
