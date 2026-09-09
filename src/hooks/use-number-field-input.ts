import { useRef } from 'react';
import { useNumberField, type AriaNumberFieldProps } from 'react-aria';
import { useNumberFieldState, type NumberFieldStateOptions } from 'react-stately';

type Props = AriaNumberFieldProps & { locale?: NumberFieldStateOptions['locale'] };

// Wraps react-aria's number field hooks (buffered text input, clamp/commit on blur or Enter,
// revert on invalid) for a single <input>, without pulling in react-aria-components' own markup.
export const useNumberFieldInput = ({ locale = 'en-US', onChange, ...props }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const state = useNumberFieldState({
    ...props,
    locale,
    // Committing an emptied field parses to NaN and still fires onChange - swallow that here so
    // callers only ever see real values, same as leaving a field untouched.
    onChange: (value) => {
      if (!Number.isNaN(value)) onChange?.(value);
    },
  });
  const { inputProps } = useNumberField({ ...props, onChange }, state, inputRef);

  return { inputRef, inputProps };
};
