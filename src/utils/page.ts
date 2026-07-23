export const APP_NAME = 'Learn Helper';

// TanStack Start does not provide a root-level title template, so routes use these helpers to append the app name.
export const pageTitle = (page: string) => `${page} | ${APP_NAME}`;

export const pageHead = (page: string) => ({ meta: [{ title: pageTitle(page) }] });
