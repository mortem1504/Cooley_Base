export function capitalize(value) {
  if (!value) {
    return '';
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function titleCase(value) {
  if (!value) {
    return '';
  }

  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => capitalize(word))
    .join(' ');
}

export function formatMetaLine(items) {
  return items.filter(Boolean).join(' - ');
}

export function formatPrice(amount) {
  return `$${amount}`;
}
