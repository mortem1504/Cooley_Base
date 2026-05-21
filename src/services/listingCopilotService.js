import { jobPostCategories, rentalPostCategories } from './postService';

const JOB_CATEGORY_KEYWORDS = {
  Delivery: ['deliver', 'delivery', 'drop off', 'pickup', 'pick up', 'courier'],
  Events: ['event', 'booth', 'festival', 'concert', 'party', 'setup', 'set up'],
  Labor: ['heavy', 'lift', 'lifting', 'warehouse', 'manual', 'unload'],
  Moving: ['move', 'moving', 'boxes', 'furniture', 'pack'],
  'Quick Jobs': ['quick', 'small task', 'simple task', 'errand', 'one-time'],
  Runner: ['runner', 'buy', 'shopping', 'grab', 'pick up'],
  Services: ['clean', 'cleaning', 'wash', 'organize', 'organise', 'tutor', 'help', 'repair'],
};

const RENTAL_CATEGORY_KEYWORDS = {
  Books: ['book', 'books', 'textbook', 'novel', 'study book'],
  Camera: ['camera', 'canon', 'sony', 'lens', 'tripod', 'gopro'],
  Furniture: ['chair', 'desk', 'table', 'bed', 'shelf', 'lamp'],
  Sports: ['sports', 'bike', 'racket', 'ball', 'helmet', 'skate'],
  'Study Gear': ['calculator', 'tablet', 'monitor', 'printer', 'study', 'exam'],
  Tech: ['laptop', 'ipad', 'phone', 'macbook', 'charger', 'tech', 'device'],
};

const JOB_BUDGET_BY_CATEGORY = {
  Delivery: '20',
  Events: '45',
  Labor: '50',
  Moving: '40',
  'Quick Jobs': '18',
  Runner: '18',
  Services: '25',
};

const RENTAL_BUDGET_BY_CATEGORY = {
  Books: '12',
  Camera: '35',
  Furniture: '25',
  Sports: '18',
  'Study Gear': '15',
  Tech: '30',
};

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeWhitespace(value) {
  return normalizeString(value).replace(/\s+/g, ' ');
}

function toSentenceCase(value) {
  const text = normalizeWhitespace(value);

  if (!text) {
    return '';
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toTitleCase(value) {
  return normalizeWhitespace(value)
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function toNaturalPhrase(value) {
  const text = normalizeWhitespace(value);

  if (!text) {
    return '';
  }

  return text.charAt(0).toLowerCase() + text.slice(1);
}

function getAllowedCategories(listingType) {
  return listingType === 'rental' ? rentalPostCategories : jobPostCategories;
}

function buildSearchText(payload) {
  return [
    payload.prompt,
    payload.draft.title,
    payload.draft.description,
    payload.draft.category,
    payload.draft.location,
  ]
    .map((value) => normalizeWhitespace(value).toLowerCase())
    .filter(Boolean)
    .join(' ');
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function inferCategory(listingType, text, currentCategory) {
  const keywordMap = listingType === 'rental' ? RENTAL_CATEGORY_KEYWORDS : JOB_CATEGORY_KEYWORDS;

  for (const [category, keywords] of Object.entries(keywordMap)) {
    if (includesAny(text, keywords)) {
      return category;
    }
  }

  return currentCategory || getAllowedCategories(listingType)[0];
}

function inferUrgency(payload, text) {
  if (payload.draft.urgent) {
    return true;
  }

  return includesAny(text, ['urgent', 'asap', 'today', 'tonight', 'now', 'immediately']);
}

function inferDuration(listingType, listingMode, category, text, existingDuration) {
  if (existingDuration) {
    return existingDuration;
  }

  if (listingType === 'rental' && listingMode === 'sell') {
    return '';
  }

  if (listingType === 'rental') {
    if (includesAny(text, ['weekend', '3 day', 'few days'])) {
      return '3 days';
    }

    if (includesAny(text, ['week', 'weekly'])) {
      return '1 week';
    }

    return '1 day';
  }

  if (category === 'Moving' || includesAny(text, ['boxes', 'furniture', 'move'])) {
    return '3 hours';
  }

  if (category === 'Delivery' || category === 'Runner') {
    return '1 hour';
  }

  if (category === 'Events') {
    return '4 hours';
  }

  if (includesAny(text, ['clean', 'cleaning', 'organize', 'organise'])) {
    return '2 hours';
  }

  return '2 hours';
}

function inferBudget(listingType, category, existingBudget, urgent) {
  if (existingBudget) {
    return existingBudget;
  }

  const budgetMap = listingType === 'rental' ? RENTAL_BUDGET_BY_CATEGORY : JOB_BUDGET_BY_CATEGORY;
  const baseBudget = budgetMap[category] || (listingType === 'rental' ? '20' : '25');

  if (!urgent) {
    return baseBudget;
  }

  return String(Math.round(Number(baseBudget) * 1.25));
}

function buildJobTitle(subject, category, urgent, location) {
  if (category === 'Moving') {
    return `Need Help with Moving${location ? ` in ${location}` : ''}`;
  }

  if (category === 'Delivery') {
    return `Need Help with Delivery${location ? ` in ${location}` : ''}`;
  }

  if (category === 'Runner') {
    return `Need a Runner for a Quick Task${location ? ` in ${location}` : ''}`;
  }

  if (subject) {
    const normalizedSubject = toTitleCase(subject);

    if (/^(need|looking|help)/i.test(normalizedSubject)) {
      return `${urgent ? 'Urgent: ' : ''}${normalizedSubject}`;
    }

    return `${urgent ? 'Urgent: ' : ''}Need Help with ${normalizedSubject}`;
  }

  return `${urgent ? 'Urgent: ' : ''}Need Help with a ${category} Task`;
}

function buildRentalTitle(subject, category, listingMode) {
  if (subject) {
    const normalizedSubject = toTitleCase(subject);

    if (/for sale$/i.test(normalizedSubject) || /for rent$/i.test(normalizedSubject)) {
      return normalizedSubject;
    }

    return listingMode === 'sell'
      ? `${normalizedSubject} for Sale`
      : `${normalizedSubject} for Rent`;
  }

  if (listingMode === 'sell') {
    return `${category} Item for Sale`;
  }

  return `${category} Item for Rent`;
}

function trimTrailingPeriod(value) {
  return normalizeWhitespace(value).replace(/[.]+$/g, '');
}

function buildJobDescription(subject, category, duration, location, urgent) {
  const normalizedSubject = toNaturalPhrase(trimTrailingPeriod(subject)) || 'this task';
  const sentences = [
    `Looking for help with ${normalizedSubject}${location ? ` in ${location}` : ''}.`,
  ];

  if (category === 'Services' && includesAny(normalizedSubject.toLowerCase(), ['clean', 'cleaning'])) {
    sentences.push('Tasks may include tidying, wiping surfaces, and basic cleaning support.');
  } else if (category === 'Moving') {
    sentences.push('This may involve lifting, carrying, and helping move items safely.');
  } else if (category === 'Delivery' || category === 'Runner') {
    sentences.push('The task is straightforward and best for someone available for a quick errand.');
  } else if (category === 'Events') {
    sentences.push('Help may include setup, coordination, or simple event support tasks.');
  } else {
    sentences.push('Please message if you are available and interested in helping.');
  }

  if (duration) {
    sentences.push(`Expected duration is about ${duration}.`);
  }

  sentences.push(
    urgent
      ? 'Please reach out if you can help as soon as possible.'
      : 'Please reach out if you are available for this task.'
  );

  return sentences.join(' ');
}

function buildRentalDescription(subject, category, duration, location, listingMode, urgent) {
  const normalizedSubject =
    toNaturalPhrase(trimTrailingPeriod(subject)) || `this ${category.toLowerCase()} item`;
  const sentences = [
    listingMode === 'sell'
      ? `Listing ${normalizedSubject}${location ? ` in ${location}` : ''} for sale.`
      : `Listing ${normalizedSubject}${location ? ` in ${location}` : ''} for rent.`,
  ];

  if (category === 'Camera') {
    sentences.push('Please check availability, included accessories, and condition before confirming.');
  } else if (category === 'Tech') {
    sentences.push('Happy to share more details about condition, compatibility, and what is included.');
  } else if (category === 'Books') {
    sentences.push('Good option for students who need it for class, study sessions, or short-term use.');
  } else {
    sentences.push('Message for more details about condition, pickup, and availability.');
  }

  if (duration) {
    sentences.push(
      listingMode === 'sell'
        ? `Pickup can be arranged around your schedule.`
        : `Suggested rental period is ${duration}.`
    );
  }

  if (urgent) {
    sentences.push(listingMode === 'sell' ? 'Available now for quick pickup.' : 'Available now.');
  }

  return sentences.join(' ');
}

function buildQualityWarnings(listingType, listingMode, text, draft, category) {
  const warnings = [];

  if (!draft.location) {
    warnings.push('Add the exact area or meetup location.');
  }

  if (listingType === 'job') {
    if (!includesAny(text, ['today', 'tonight', 'tomorrow', 'weekend', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])) {
      warnings.push('Mention when you need the help.');
    }

    if (!draft.duration) {
      warnings.push('Say how long the task should take.');
    }

    if (category === 'Services' && includesAny(text, ['clean', 'cleaning']) && !includesAny(text, ['studio', 'bedroom', 'room', 'apartment', 'bathroom', 'kitchen'])) {
      warnings.push('Mention the room or space that needs cleaning.');
    }

    if (category === 'Moving' && !includesAny(text, ['box', 'boxes', 'chair', 'desk', 'furniture', 'bags'])) {
      warnings.push('Mention what items need to be moved.');
    }
  } else {
    if (!includesAny(text, ['good condition', 'used', 'new', 'working', 'clean'])) {
      warnings.push('Mention the item condition.');
    }

    if (listingMode === 'rent' && !draft.duration) {
      warnings.push('Mention the expected rental period.');
    }

    if (category === 'Camera' && !includesAny(text, ['lens', 'charger', 'battery', 'bag'])) {
      warnings.push('Mention what accessories are included.');
    }
  }

  return warnings.slice(0, 4);
}

function pickBaseSubject(payload) {
  return normalizeWhitespace(payload.prompt || payload.draft.title || payload.draft.description);
}

export function buildListingCopilotPayload({
  listingType,
  listingMode,
  title,
  description,
  category,
  budget,
  duration,
  location,
  urgent,
  prompt,
}) {
  const normalizedListingType = listingType === 'rental' ? 'rental' : 'job';
  const normalizedListingMode =
    normalizedListingType === 'rental' && listingMode === 'sell' ? 'sell' : 'rent';
  const allowedCategories = getAllowedCategories(normalizedListingType);

  return {
    allowedCategories,
    draft: {
      budget: normalizeWhitespace(budget),
      category: allowedCategories.includes(category) ? category : allowedCategories[0],
      description: normalizeWhitespace(description),
      duration: normalizeWhitespace(duration),
      location: normalizeWhitespace(location),
      title: normalizeWhitespace(title),
      urgent: Boolean(urgent),
    },
    listingMode: normalizedListingMode,
    listingType: normalizedListingType,
    prompt: normalizeWhitespace(prompt),
  };
}

export function normalizeListingCopilotSuggestion(rawSuggestion, payload) {
  const allowedCategories = payload.allowedCategories || getAllowedCategories(payload.listingType);
  const nextCategory = normalizeWhitespace(rawSuggestion?.category);

  return {
    budget: normalizeWhitespace(rawSuggestion?.budget),
    category: allowedCategories.includes(nextCategory)
      ? nextCategory
      : payload.draft.category || allowedCategories[0],
    description: toSentenceCase(rawSuggestion?.description),
    duration:
      payload.listingType === 'rental' && payload.listingMode === 'sell'
        ? ''
        : normalizeWhitespace(rawSuggestion?.duration),
    qualityWarnings: Array.isArray(rawSuggestion?.qualityWarnings)
      ? rawSuggestion.qualityWarnings.map((warning) => normalizeWhitespace(warning)).filter(Boolean).slice(0, 4)
      : [],
    title: toTitleCase(rawSuggestion?.title),
    urgent:
      typeof rawSuggestion?.urgent === 'boolean'
        ? rawSuggestion.urgent
        : Boolean(payload.draft.urgent),
  };
}

export async function requestListingCopilotSuggestions(input) {
  const payload = buildListingCopilotPayload(input);
  const baseSubject = pickBaseSubject(payload);

  if (!baseSubject && !payload.draft.location) {
    throw new Error('Add a short prompt or a few draft details first so the copilot can help.');
  }

  const searchText = buildSearchText(payload);
  const category = inferCategory(payload.listingType, searchText, payload.draft.category);
  const urgent = inferUrgency(payload, searchText);
  const duration = inferDuration(
    payload.listingType,
    payload.listingMode,
    category,
    searchText,
    payload.draft.duration
  );
  const budget = inferBudget(payload.listingType, category, payload.draft.budget, urgent);
  const title =
    payload.listingType === 'job'
      ? buildJobTitle(baseSubject, category, urgent, payload.draft.location)
      : buildRentalTitle(baseSubject, category, payload.listingMode);
  const description =
    payload.listingType === 'job'
      ? buildJobDescription(baseSubject, category, duration, payload.draft.location, urgent)
      : buildRentalDescription(
          baseSubject,
          category,
          duration,
          payload.draft.location,
          payload.listingMode,
          urgent
        );
  const qualityWarnings = buildQualityWarnings(
    payload.listingType,
    payload.listingMode,
    searchText,
    payload.draft,
    category
  );

  return normalizeListingCopilotSuggestion(
    {
      budget,
      category,
      description,
      duration,
      qualityWarnings,
      title,
      urgent,
    },
    payload
  );
}
