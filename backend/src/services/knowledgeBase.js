// BookLeaf's operating policies, structured by ticket category so the AI
// service can inject only the relevant slice into a prompt instead of the
// entire knowledge base on every call (see ai.service.js for how this is used).

export const CATEGORIES = [
  'Royalty & Payments',
  'ISBN & Metadata Issues',
  'Printing & Quality',
  'Distribution & Availability',
  'Book Status & Production Updates',
  'General Inquiry',
];

export const COMPANY_OVERVIEW = `
BookLeaf Publishing is a self-publishing company operating in India and the US.
Packages: Standard Free (no upfront cost) and Bestseller Breakthrough (premium, paid, with marketing/distribution add-ons).
BookLeaf handles cover design, typesetting, ISBN assignment, printing, distribution, and royalty management.
In-house printing and warehouse: Delhi. Print partners: Repro India, Epitome Books.
`.trim();

export const TONE_GUIDELINES = `
- Empathetic and professional. Authors are partners, not customers to be managed.
- Acknowledge the author's concern before offering a solution.
- Be specific: real numbers, dates, and statuses instead of vague reassurance.
- If it's BookLeaf's fault (delayed royalty, ISBN error), own it directly. No deflection.
- If escalation/investigation is needed, give a concrete timeline (e.g. "within 48 hours"), never open-ended.
- End with a clear next step for the author and/or the BookLeaf team.
`.trim();

const KB_BY_CATEGORY = {
  'Royalty & Payments': `
- Split: 80% of net profit to the author, 20% to BookLeaf.
- Net profit = MRP minus printing cost, platform commission (Amazon/Flipkart), and shipping.
- Royalties are calculated quarterly and paid within 45 days of quarter end.
- Minimum payout threshold: Rs.1,000. Below that, it rolls over to the next quarter.
- Payouts go via bank transfer to the account linked in the author's dashboard.
- A full per-platform sales/royalty breakdown is available in the author's dashboard.
`.trim(),

  'ISBN & Metadata Issues': `
- Every book gets a unique ISBN assigned by BookLeaf, registered under BookLeaf's imprint.
- An author wanting their own imprint's ISBN must obtain it independently.
- ISBN errors (duplicate, wrong book linked) are treated as high priority and escalated to production immediately.
`.trim(),

  'Printing & Quality': `
- In-house printing handles most orders; overflow/special formats go to Repro India or Epitome Books.
- Standard print turnaround: 5-7 business days from order confirmation.
- Quality issues (misprints, binding defects, color problems) get a free reprint after verification; ask the author for photos of the defective copy.
`.trim(),

  'Distribution & Availability': `
- Books are listed on Amazon India, Flipkart, Amazon US, Amazon UK, and the BookLeaf Store.
- New listings typically go live 7-10 business days after publication completes.
- "Unavailable" on a platform is usually a stock sync issue; BookLeaf can trigger a re-sync within 24-48 hours.
`.trim(),

  'Book Status & Production Updates': `
- Stages: Manuscript Received -> Editing (if opted) -> Cover Design -> Typesetting -> Proofreading -> ISBN Assignment -> Printing -> Distribution Setup -> Published & Live.
- Authors get an email at each stage. Delays usually happen at Cover Design (waiting on author approval) and Proofreading (revision rounds).
`.trim(),

  'General Inquiry': `
- Metadata updates (description, etc.) after a book is live can be submitted via dashboard or email; changes reflect on platforms in 3-5 business days.
`.trim(),
};

export function getKnowledgeBaseExcerpt(category) {
  const section = KB_BY_CATEGORY[category] ?? KB_BY_CATEGORY['General Inquiry'];
  return `${COMPANY_OVERVIEW}\n\nRelevant policy (${category}):\n${section}`;
}
