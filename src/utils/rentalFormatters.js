import { titleCase } from './formatters';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function parseRentalDateInput(value) {
  const trimmedValue = String(value || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    return null;
  }

  const [yearText, monthText, dayText] = trimmedValue.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const day = Number(dayText);
  const parsedDate = new Date(year, monthIndex, day);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const isValidLocalDate =
    parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === monthIndex &&
    parsedDate.getDate() === day;

  return isValidLocalDate ? parsedDate : null;
}

export function isValidRentalDateInput(value) {
  return Boolean(parseRentalDateInput(value));
}

export function calculateRentalDays(startDate, endDate) {
  const parsedStartDate = parseRentalDateInput(startDate);
  const parsedEndDate = parseRentalDateInput(endDate);

  if (!parsedStartDate || !parsedEndDate || parsedEndDate < parsedStartDate) {
    return null;
  }

  return Math.floor((parsedEndDate.getTime() - parsedStartDate.getTime()) / DAY_IN_MS) + 1;
}

export function calculateRentalTotal(ratePerDay, startDate, endDate) {
  const rentalDays = calculateRentalDays(startDate, endDate);
  const numericRate = Number(ratePerDay);

  if (!rentalDays || !Number.isFinite(numericRate)) {
    return null;
  }

  return Number((numericRate * rentalDays).toFixed(2));
}

export function formatRentalPrice(amount) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return '$0.00';
  }

  return `$${numericAmount.toFixed(2)}`;
}

export function formatRentalDate(dateInput) {
  const parsedDate =
    dateInput instanceof Date ? dateInput : parseRentalDateInput(dateInput);

  if (!parsedDate) {
    return 'TBD';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsedDate);
}

export function formatRentalDateRange(startDate, endDate) {
  const formattedStartDate = formatRentalDate(startDate);
  const formattedEndDate = formatRentalDate(endDate);

  if (formattedStartDate === 'TBD' || formattedEndDate === 'TBD') {
    return 'Dates pending';
  }

  return `${formattedStartDate} - ${formattedEndDate}`;
}

export function formatRentalRequestStatus(status) {
  if (!status) {
    return '';
  }

  if (status === 'requested') {
    return 'Requested';
  }

  if (status === 'ongoing') {
    return 'Ongoing';
  }

  return titleCase(status);
}

export function canLeaveRentalReview(request, userId) {
  if (!request || request.status !== 'completed' || !userId) {
    return false;
  }

  return !request.reviews.some((review) => review.reviewerId === userId);
}
