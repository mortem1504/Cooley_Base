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
  const candidates = Array.isArray(responsePayload.candidates) ? responsePayload.candidates : [];
  const firstCandidate =
    candidates[0] && typeof candidates[0] === 'object'
      ? (candidates[0] as Record<string, unknown>)
      : null;
  const content =
    firstCandidate?.content && typeof firstCandidate.content === 'object'
      ? (firstCandidate.content as Record<string, unknown>)
      : null;
  const parts = Array.isArray(content?.parts) ? (content.parts as Array<Record<string, unknown>>) : [];

  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
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

function buildPrompt(listingType: string, listingMode: string, allowedCategories: string[]) {
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
    `Choose category only from this list: ${allowedCategories.join(', ')}.`,
    'If details are missing, keep the copy general and mention the missing details in qualityWarnings.',
    'budget must be a plain number string with no currency symbol when you can make a reasonable suggestion.',
    'duration should be short natural language like "2 hours" or "3 days". Use an empty string when not applicable.',
    'urgent should reflect whether the listing reads as time-sensitive or available now.',
    'Return only the structured JSON requested by the schema.',
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
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const geminiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash';

    if (!geminiKey) {
      return buildJsonResponse(500, {
        error: 'GEMINI_API_KEY is not configured for the listing-copilot function.',
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
        error: 'Add a short prompt or a few draft details first so AI Listing Copilot has something to improve.',
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
        title: {
          type: 'string',
          description: 'A concise listing title that matches the user intent.',
        },
        description: {
          type: 'string',
          description: 'A short, clear listing description for students.',
        },
        category: {
          type: 'string',
          enum: allowedCategories,
          description: 'One category from the allowed list.',
        },
        budget: {
          type: 'string',
          description: 'Plain number string with no currency symbol.',
        },
        duration: {
          type: 'string',
          description: 'Short natural-language duration like 2 hours or 3 days, or empty string.',
        },
        urgent: {
          type: 'boolean',
          description: 'Whether the listing should be marked urgent or available now.',
        },
        qualityWarnings: {
          type: 'array',
          description: 'Short suggestions for missing details that would improve the listing.',
          items: {
            type: 'string',
          },
          maxItems: 4,
        },
      },
    };

    const contentText = [
      prompt ? `User prompt: ${prompt}` : 'User prompt: (none)',
      buildDraftSummary(draft, listingType, listingMode),
    ].join('\n\n');

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: contentText }],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            responseFormat: {
              text: {
                mimeType: 'application/json',
                schema,
              },
            },
          },
          systemInstruction: {
            parts: [{ text: buildPrompt(listingType, listingMode, allowedCategories) }],
          },
        }),
      }
    );

    const responsePayload = (await geminiResponse.json()) as Record<string, unknown>;

    if (!geminiResponse.ok) {
      const apiMessage =
        typeof responsePayload.error === 'object' &&
        responsePayload.error &&
        typeof (responsePayload.error as Record<string, unknown>).message === 'string'
          ? ((responsePayload.error as Record<string, unknown>).message as string)
          : 'Gemini API request failed.';

      return buildJsonResponse(geminiResponse.status, {
        error: apiMessage,
      });
    }

    const outputText = extractOutputText(responsePayload);

    if (!outputText) {
      return buildJsonResponse(502, {
        error: 'Gemini returned an empty listing suggestion.',
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
