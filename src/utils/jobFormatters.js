import { formatMetaLine, formatPrice, titleCase } from './formatters';

export function formatJobPrice(price) {
  return formatPrice(price);
}

export function formatJobStatus(status) {
  return titleCase(status);
}

export function formatJobDistance(distance) {
  if (!Number.isFinite(Number(distance))) {
    return 'Nearby';
  }

  const numericDistance = Number(distance);
  return `${numericDistance < 10 ? numericDistance.toFixed(1) : Math.round(numericDistance)} km`;
}

export function formatJobSummaryMeta(job) {
  return formatMetaLine([job.location, formatJobDistance(job.distance), `${job.date}, ${job.time}`]);
}

export function formatMapJobMeta(job) {
  return formatMetaLine([job.location, formatJobDistance(job.distance), job.time]);
}
