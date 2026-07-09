type Hook<T = unknown> = () => Promise<T> | T;

const createHook = () => {
  const hooks: Hook[] = [];

  const add = (hook: Hook) => {
    hooks.push(hook);
  };

  add.run = async () => {
    for (const hook of hooks) {
      await hook();
    }
  };

  return add;
};

export const onApplicationStop = createHook();
