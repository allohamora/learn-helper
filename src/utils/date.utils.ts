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
  return `${month}-${day}`;
};

export const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);

  return date;
};
