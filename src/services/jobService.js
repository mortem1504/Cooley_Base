export const jobCategories = ['All', 'Runner', 'Usher', 'Helper', 'Delivery', 'Events'];

export const jobStatusFlow = ['posted', 'accepted', 'in progress', 'completed'];

export const starterJobs = [
  {
    id: 'job-101',
    title: 'Rush coffee delivery to law library',
    description:
      'Need someone to pick up two coffees from the campus cafe and deliver them to the second floor study room.',
    price: 14,
    location: 'Law Library',
    distance: 0.4,
    category: 'Delivery',
    date: 'Today',
    time: '5:40 PM',
    urgent: true,
    instantAccept: true,
    status: 'posted',
    requester: { name: 'Ava Kim', rating: 4.8, school: 'Seoul Global University' },
    coordinates: { top: '28%', left: '62%' },
  },
  {
    id: 'job-102',
    title: 'Event usher for startup club demo night',
    description:
      'Help greet guests, point people to seating, and assist with check-in for a student startup showcase.',
    price: 32,
    location: 'Innovation Hall',
    distance: 0.9,
    category: 'Usher',
    date: 'Today',
    time: '7:00 PM',
    urgent: false,
    instantAccept: false,
    status: 'posted',
    requester: { name: 'Daniel Lee', rating: 4.7, school: 'Seoul Global University' },
    coordinates: { top: '54%', left: '38%' },
  },
  {
    id: 'job-103',
    title: 'Dorm move-in helper for one hour',
    description:
      'Carry two suitcases and a small fridge from curbside drop-off into the residence hall elevator.',
    price: 26,
    location: 'Maple Residence',
    distance: 1.2,
    category: 'Helper',
    date: 'Tomorrow',
    time: '10:30 AM',
    urgent: false,
    instantAccept: true,
    status: 'accepted',
    requester: { name: 'Sora Han', rating: 5, school: 'Seoul Global University' },
    coordinates: { top: '70%', left: '66%' },
  },
  {
    id: 'job-104',
    title: 'Runner needed for print shop pickup',
    description:
      'Pick up printed posters before 6 PM and drop them at the student union front desk.',
    price: 18,
    location: 'Student Union',
    distance: 0.7,
    category: 'Runner',
    date: 'Today',
    time: '5:15 PM',
    urgent: true,
    instantAccept: true,
    status: 'in progress',
    requester: { name: 'Jae Oh', rating: 4.9, school: 'Seoul Global University' },
    coordinates: { top: '42%', left: '20%' },
  },
];
