const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
};

const DEFAULT_JOB_CATEGORIES = [
  'Quick Jobs',
  'Runner',
  'Events',
  'Moving',
  'Delivery',
  'Services',
  'Labor',
];

const DEFAULT_RENTAL_CATEGORIES = [
  'Tech',
  'Camera',
  'Books',
  'Furniture',
  'Sports',
  'Study Gear',
];

function buildJsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  });
}

function normalizeString(value: unknown) {
  return String(value || '').trim();
}

function getAllowedCategories(body: Record<string, unknown>, listingType: string) {
  const rawCategories = Array.isArray(body.allowedCategories) ? body.allowedCategories : [];
  const categories = rawCategories
    .map((value) => normalizeString(value))
    .filter(Boolean);

  if (categories.length) {
    return categories;
  }

  return listingType === 'rental' ? DEFAULT_RENTAL_CATEGORIES : DEFAULT_JOB_CATEGORIES;
}

function extractOutputText(responsePayload: Record<string, unknown>) {
  const output = Array.isArray(responsePayload.output) ? responsePayload.output : [];
  const parts: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as Array<Record<string, unknown>>)
      : [];

    for (const entry of content) {
      const text = typeof entry.text === 'string' ? entry.text : '';

      if (text) {
        parts.push(text);
      }
    }
  }

  return parts.join('').trim();
}

function buildDraftSummary(draft: Record<string, unknown>, listingType: string, listingMode: string) {
  const lines = [
    `Listing type: ${listingType}`,
    `Listing mode: ${listingMode}`,
    `Title draft: ${normalizeString(draft.title) || '(empty)'}`,
    `Description draft: ${normalizeString(draft.description) || '(empty)'}`,
    `Category draft: ${normalizeString(draft.category) || '(empty)'}`,
    `Budget draft: ${normalizeString(draft.budget) || '(empty)'}`,
    `Duration draft: ${normalizeString(draft.duration) || '(empty)'}`,
    `Location draft: ${normalizeString(draft.location) || '(empty)'}`,
    `Urgent flag: ${draft.urgent ? 'true' : 'false'}`,
  ];

  return lines.join('\n');
}

function sanitizeSuggestion(
  rawSuggestion: Record<string, unknown>,
  allowedCategories: string[],
  draft: Record<string, unknown>,
  listingType: string,
  listingMode: string
) {
  const nextCategory = normalizeString(rawSuggestion.category);
  const rawWarnings = Array.isArray(rawSuggestion.qualityWarnings)
    ? rawSuggestion.qualityWarnings
    : [];

  return {
    budget: normalizeString(rawSuggestion.budget),
    category: allowedCategories.includes(nextCategory)
      ? nextCategory
      : normalizeString(draft.category) || allowedCategories[0],
    description: normalizeString(rawSuggestion.description),
    duration:
      listingType === 'rental' && listingMode === 'sell'
        ? ''
        : normalizeString(rawSuggestion.duration),
    qualityWarnings: rawWarnings
      .map((value) => normalizeString(value))
      .filter(Boolean)
      .slice(0, 4),
    title: normalizeString(rawSuggestion.title),
    urgent:
      typeof rawSuggestion.urgent === 'boolean'
        ? rawSuggestion.urgent
        : Boolean(draft.urgent),
  };
}

function buildInstructions(listingType: string, listingMode: string, allowedCategories: string[]) {
  const listingFocus =
    listingType === 'job'
      ? 'Clarify the task, time, effort, and what the helper should expect.'
      : listingMode === 'sell'
        ? 'Clarify item condition, what is included, and simple sale terms.'
        : 'Clarify item condition, rental period, pickup/return expectations, and included accessories.';

  return [
    'You are Cooley AI Listing Copilot for a student marketplace.',
    'Improve the user draft without changing its intent.',
    'Do not invent facts, addresses, timing, or item condition that the user did not imply.',
    'Use concise, trustworthy, student-friendly language.',
    listingFocus,
    `Choose category from this list only: ${allowedCategories.join(', ')}.`,
    'Return stronger copy, but if information is missing, keep the wording general and mention gaps in qualityWarnings.',
    'budget should be a plain number string with no currency symbol when you can make a reasonable suggestion. Otherwise return an empty string.',
    'duration should be short natural language like "2 hours" or "3 days". Return an empty string when not applicable.',
    'urgent should reflect whether the listing reads as time-sensitive or available now.',
  ].join(' ');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  if (request.method !== 'POST') {
    return buildJsonResponse(405, {
      error: 'Method not allowed.',
    });
  }

  try {
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    const openAiModel = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';

    if (!openAiKey) {
      return buildJsonResponse(500, {
        error: 'OPENAI_API_KEY is not configured for the listing-copilot function.',
      });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const listingType = body.listingType === 'rental' ? 'rental' : 'job';
    const listingMode =
      listingType === 'rental' && body.listingMode === 'sell' ? 'sell' : 'rent';
    const draft =
      body.draft && typeof body.draft === 'object'
        ? (body.draft as Record<string, unknown>)
        : {};
    const prompt = normalizeString(body.prompt);
    const allowedCategories = getAllowedCategories(body, listingType);

    if (
      !prompt &&
      !normalizeString(draft.title) &&
      !normalizeString(draft.description) &&
      !normalizeString(draft.location)
    ) {
      return buildJsonResponse(400, {
        error: 'Add a short prompt or a few draft details first so AI has something to improve.',
      });
    }

    const schema = {
      type: 'object',
      additionalProperties: false,
      required: [
        'title',
        'description',
        'category',
        'budget',
        'duration',
        'urgent',
        'qualityWarnings',
      ],
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        category: {
          type: 'string',
          enum: allowedCategories,
        },
        budget: { type: 'string' },
        duration: { type: 'string' },
        urgent: { type: 'boolean' },
        qualityWarnings: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 4,
        },
      },
    };

    const input = [
      prompt ? `User prompt: ${prompt}` : 'User prompt: (none)',
      buildDraftSummary(draft, listingType, listingMode),
    ].join('\n\n');

    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input,
        instructions: buildInstructions(listingType, listingMode, allowedCategories),
        model: openAiModel,
        store: false,
        temperature: 0.4,
        text: {
          format: {
            type: 'json_schema',
            name: 'listing_copilot_suggestion',
            schema,
            strict: true,
          },
        },
      }),
    });

    const responsePayload = (await openAiResponse.json()) as Record<string, unknown>;

    if (!openAiResponse.ok) {
      const apiMessage =
        typeof responsePayload.error === 'object' &&
        responsePayload.error &&
        typeof (responsePayload.error as Record<string, unknown>).message === 'string'
          ? ((responsePayload.error as Record<string, unknown>).message as string)
          : 'OpenAI request failed.';

      return buildJsonResponse(openAiResponse.status, {
        error: apiMessage,
      });
    }

    const outputText = extractOutputText(responsePayload);

    if (!outputText) {
      return buildJsonResponse(502, {
        error: 'OpenAI returned an empty listing suggestion.',
      });
    }

    const parsedSuggestion = JSON.parse(outputText) as Record<string, unknown>;
    const suggestion = sanitizeSuggestion(
      parsedSuggestion,
      allowedCategories,
      draft,
      listingType,
      listingMode
    );

    return buildJsonResponse(200, {
      suggestion,
    });
  } catch (error) {
    return buildJsonResponse(500, {
      error: error instanceof Error ? error.message : 'Unexpected listing copilot error.',
    });
  }
});
