import { type FC } from 'react';

export const IndexPage: FC = () => {
  return (
    <div className="flex flex-col items-center justify-center px-4 pt-16 text-center">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
          Master English with
          <span className="block text-primary">Learn Helper</span>
        </h1>

        <p className="mb-8 max-w-2xl text-xl text-muted-foreground">
          Discover thousands of Oxford words and phrases. Build your vocabulary with interactive lessons and track your
          progress.
        </p>
      </div>
    </div>
  );
};
