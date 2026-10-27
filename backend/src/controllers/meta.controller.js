import { CATEGORIES } from '../services/knowledgeBase.js';

export function getMeta(req, res) {
  res.json({
    categories: CATEGORIES,
    priorities: ['Critical', 'High', 'Medium', 'Low'],
    statuses: ['Open', 'In Progress', 'Resolved', 'Closed'],
  });
}
