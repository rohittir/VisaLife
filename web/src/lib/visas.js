// Shape rules for content/visas.json. Shared by the tests and scripts/validate-content.mjs. Returns a list of errors.
export const GROUPS = ['Documents', 'Green card', 'Work permit'];

export function validateVisas({ visas, fields }) {
  const errors = [];
  for (const [id, f] of Object.entries(fields)) {
    const at = `fields.${id}`;
    if (f.type === 'date') {
      if (!['day', 'month'].includes(f.precision)) errors.push(`${at}: precision must be "day" or "month"`);
      if (f.precision === 'month' && !['start', 'end'].includes(f.assume)) errors.push(`${at}: month fields need assume "start" or "end"`);
      if (f.precision === 'day' && 'assume' in f) errors.push(`${at}: assume only applies to month fields`);
    } else if ('precision' in f || 'assume' in f || 'timing' in f) errors.push(`${at}: precision/assume/timing only apply to date fields`);
    // "ahead": always a future date (a leave date), so the control shows the pickers and no "already passed" choice.
    if ('timing' in f && f.timing !== 'ahead') errors.push(`${at}: timing must be "ahead"`);
    if ('question' in f && !(typeof f.question === 'string' && f.question)) errors.push(`${at}: question must be a non-empty string`);
    if (f.type === 'select' && !(f.options?.length > 0)) errors.push(`${at}: select needs options`);
    if (f.type !== 'number' && !GROUPS.includes(f.group)) errors.push(`${at}: group must be one of ${GROUPS.join(', ')}`);
  }
  for (const [visa, v] of Object.entries(visas)) {
    for (const s of v.stages) {
      const at = `${visa}.${s.id}`;
      for (const k of s.fields) if (!fields[k]) errors.push(`${at}: unknown field ${k}`);
      if (!Array.isArray(s.quick)) errors.push(`${at}: quick must be a list (empty is fine)`);
      else {
        if (s.quick.length > 2) errors.push(`${at}: at most two quick fields`);
        for (const k of s.quick) {
          if (!fields[k]) errors.push(`${at}: unknown quick field ${k}`);
          else if (fields[k].type === 'number') errors.push(`${at}: number field ${k} cannot be quick`);
          else if (!s.fields.includes(k)) errors.push(`${at}: quick field ${k} is not in the stage's fields`);
        }
      }
    }
  }
  return errors;
}
