// Journey content: content/journeys/*.json (ordered stage → step ids) and content/steps/*.md.
import { marked } from 'marked';
import { parseFrontmatter } from './steps.js';

const journeys = import.meta.glob('../../content/journeys/*.json', { eager: true, import: 'default' });
const steps = import.meta.glob('../../content/steps/*.md', { eager: true, query: '?raw', import: 'default' });

export const JOURNEYS = Object.fromEntries(Object.values(journeys).map((j) => [j.visa, j]));

// Bodies are our own reviewed content (validated at build), so the rendered HTML is trusted.
export const STEPS = Object.fromEntries(
  Object.values(steps).map((raw) => {
    const { data, body } = parseFrontmatter(raw);
    return [data.id, { ...data, html: marked.parse(body) }];
  }),
);
