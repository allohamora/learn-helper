export const nanoDollarsToDollars = (nanoDollars: number) => nanoDollars / 1_000_000_000;

export const formatDollars = (dollars: number) =>
  dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
