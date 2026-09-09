import { useRef } from 'react';
import { useNumberField, type AriaNumberFieldProps } from 'react-aria';
import { useNumberFieldState, type NumberFieldStateOptions } from 'react-stately';

type Props = AriaNumberFieldProps & {
  locale?: NumberFieldStateOptions['locale'];
  // Not part of AriaNumberFieldProps, but react-aria's underlying useTextField forwards it to the
  // native input regardless - typed here so callers can opt out of the browser/OS inferring "next"
  // and advancing focus to whatever input follows in the DOM.
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
};

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
  const { inputProps } = useNumberField(
    {
      ...props,
      onChange,
      // enterKeyHint: 'done' only labels the on-screen keyboard's key - it doesn't blur the
      // field on its own, so without this the keyboard (and focus) would stick around after commit.
      // On keyup, not keydown: react-aria's own Enter handling (which commits the value) is chained
      // ahead of a keydown handler passed in here, so blurring on keydown would race it and revert
      // to the pre-edit value. commit() has always finished by the time the key is released.
      onKeyUp: (e) => {
        props.onKeyUp?.(e);
        if (props.enterKeyHint === 'done' && e.key === 'Enter') inputRef.current?.blur();
      },
    },
    state,
    inputRef,
  );

  return { inputRef, inputProps };
};
