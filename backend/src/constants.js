// Single source of truth for every enum value used across validators,
// the AI service, the /meta endpoint, and the admin queue sort order.
// db/schema.sql has its own copy in each CHECK constraint since SQL can't
// import from JS - keep the two in sync if a value here ever changes.

export const CATEGORIES = [
  'Royalty & Payments',
  'ISBN & Metadata Issues',
  'Printing & Quality',
  'Distribution & Availability',
  'Book Status & Production Updates',
  'General Inquiry',
];

// Order matters here: it's also the admin queue's urgency sort order.
export const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

// Order matters here too: it's the admin queue's status sort order
// (open/in-progress work surfaces above resolved/closed).
export const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
