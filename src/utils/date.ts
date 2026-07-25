export const toShortDate = (date: string) => {
  const [, month, day] = date.split('-');
  if (!month || !day) throw new Error(`Invalid statistics date: ${date}`);

  return `${month}-${day}`;
};

export const getBrowserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
