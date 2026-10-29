import { CATEGORIES, PRIORITIES, STATUSES } from '../constants.js';

export function getMeta(req, res) {
  res.json({
    categories: CATEGORIES,
    priorities: PRIORITIES,
    statuses: STATUSES,
  });
}
