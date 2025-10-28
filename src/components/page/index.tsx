import { type FC } from 'react';

export const IndexPage: FC = () => {
  return (
    <div className="flex flex-col items-center justify-center px-4 pt-4 text-center md:pt-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 text-3xl font-bold tracking-tight md:mb-6 md:text-6xl">
          Master English with
          <span className="block text-primary">Learn Helper</span>
        </h1>

        <p className="mb-6 max-w-2xl text-base text-muted-foreground md:mb-8 md:text-xl">
          Discover thousands of Oxford words and phrases. Build your vocabulary with interactive lessons and track your
          progress.
        </p>
      </div>
    </div>
  );
};
