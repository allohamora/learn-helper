export const endOfDay = (date = new Date()) => {
  const result = new Date(date);
  result.setUTCHours(23, 59, 59, 999);

  return result;
};

export const startOfDay = (date = new Date()) => {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);

  return result;
};

export const toDateOnlyString = (date: Date) => {
  const [dateOnly] = date.toISOString().split('T');
  // type-guard
  if (!dateOnly) {
    throw new Error('Failed to format date');
  }

  return dateOnly;
};

export const toDateWithoutYear = (dateString: string) => {
  const [, month, day] = dateString.split('-');
  // type-guard
  if (!month || !day) {
    throw new Error('Failed to format date without year');
  }

  return `${month}-${day}`;
};

export const daysAgo = (days: number, date = new Date()) => {
  const result = new Date(date);
  result.setDate(result.getDate() - days);

  return result;
};
