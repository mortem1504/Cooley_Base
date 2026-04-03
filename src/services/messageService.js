function buildInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const now = Date.now();

export const starterThreads = [
  {
    id: 'thread-101',
    participant: {
      id: 'participant-ava-kim',
      name: 'Ava Kim',
      initials: buildInitials('Ava Kim'),
      school: 'Seoul Global University',
      verified: true,
    },
    listingType: 'job',
    listingTitle: 'Rush coffee delivery to law library',
    subtitle: 'Law Library',
    preview: 'Can you arrive in 15 minutes?',
    updatedAt: now - 4 * 60 * 1000,
    unreadCount: 2,
    jobId: 'job-101',
  },
  {
    id: 'thread-102',
    participant: {
      id: 'participant-daniel-lee',
      name: 'Daniel Lee',
      initials: buildInitials('Daniel Lee'),
      school: 'Seoul Global University',
      verified: true,
    },
    listingType: 'job',
    listingTitle: 'Event usher for startup club demo night',
    subtitle: 'Innovation Hall',
    preview: 'Doors open at 6:45 PM. Thanks again.',
    updatedAt: now - 2 * 60 * 60 * 1000,
    unreadCount: 0,
    jobId: 'job-102',
  },
  {
    id: 'thread-201',
    participant: {
      id: 'participant-hana-choi',
      name: 'Hana Choi',
      initials: buildInitials('Hana Choi'),
      school: 'Seoul Global University',
      verified: true,
    },
    listingType: 'rental',
    listingTitle: 'Desk lamp rental near residence hall',
    subtitle: 'Maple Residence',
    preview: 'I can return it by Sunday evening.',
    updatedAt: now - 26 * 60 * 60 * 1000,
    unreadCount: 1,
  },
];

export const starterMessagesByThread = {
  'thread-101': [
    {
      id: 'message-101-1',
      senderId: 'participant-ava-kim',
      text: 'Hi, are you close to the campus cafe right now?',
      createdAt: now - 18 * 60 * 1000,
    },
    {
      id: 'message-101-2',
      senderId: 'student-001',
      text: 'Yes, I am five minutes away and can head there now.',
      createdAt: now - 13 * 60 * 1000,
    },
    {
      id: 'message-101-3',
      senderId: 'participant-ava-kim',
      text: 'Perfect. Can you arrive in 15 minutes?',
      createdAt: now - 4 * 60 * 1000,
    },
  ],
  'thread-102': [
    {
      id: 'message-102-1',
      senderId: 'participant-daniel-lee',
      text: 'Thanks for helping tonight. Please come through the north entrance.',
      createdAt: now - 3 * 60 * 60 * 1000,
    },
    {
      id: 'message-102-2',
      senderId: 'student-001',
      text: 'Got it. I will be there a little before 6:45 PM.',
      createdAt: now - 150 * 60 * 1000,
    },
    {
      id: 'message-102-3',
      senderId: 'participant-daniel-lee',
      text: 'Doors open at 6:45 PM. Thanks again.',
      createdAt: now - 2 * 60 * 60 * 1000,
    },
  ],
  'thread-201': [
    {
      id: 'message-201-1',
      senderId: 'participant-hana-choi',
      text: 'Hi, is the lamp still available for a two-day rental?',
      createdAt: now - 30 * 60 * 60 * 1000,
    },
    {
      id: 'message-201-2',
      senderId: 'student-001',
      text: 'Yes, you can pick it up from Maple Residence after 7 PM.',
      createdAt: now - 28 * 60 * 60 * 1000,
    },
    {
      id: 'message-201-3',
      senderId: 'participant-hana-choi',
      text: 'I can return it by Sunday evening.',
      createdAt: now - 26 * 60 * 60 * 1000,
    },
  ],
};

export function createJobConversationSeed(job) {
  const createdAt = Date.now();
  const participantName = job.requester?.name || 'Requester';
  const participantId = `participant-${job.id}`;
  const introText = 'Hi, thanks for checking this task. Ask me anything you need before accepting.';

  return {
    thread: {
      id: `thread-${job.id}`,
      participant: {
        id: participantId,
        name: participantName,
        initials: buildInitials(participantName),
        school: job.requester?.school || 'Seoul Global University',
        verified: true,
      },
      listingType: 'job',
      listingTitle: job.title,
      subtitle: job.location,
      preview: introText,
      updatedAt: createdAt,
      unreadCount: 0,
      jobId: job.id,
    },
    messages: [
      {
        id: `message-${job.id}-intro`,
        senderId: participantId,
        text: introText,
        createdAt,
      },
    ],
  };
}
