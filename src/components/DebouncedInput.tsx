"use client";

import { useState, useEffect } from "react";

interface DebouncedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onDebouncedChange: (value: string) => void;
  debounceMs?: number;
}

export default function DebouncedInput({ value, onDebouncedChange, debounceMs = 300, ...props }: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localValue !== value) {
        onDebouncedChange(localValue);
      }
    }, debounceMs);

    return () => {
      clearTimeout(handler);
    };
  }, [localValue, value, onDebouncedChange, debounceMs]);

  return (
    <input
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      {...props}
    />
  );
}
