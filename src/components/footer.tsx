import { type FC } from 'react';

export const Footer: FC = () => {
  return (
    <footer className="mt-auto border-t py-6 text-center text-sm text-muted-foreground">
      <p>
        Data powered by{' '}
        <a
          href="https://www.oxfordlearnersdictionaries.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
          title="Oxford Learner's Dictionaries"
        >
          Oxford Learner&apos;s Dictionaries
        </a>
      </p>
    </footer>
  );
};
