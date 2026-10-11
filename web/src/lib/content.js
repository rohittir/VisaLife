import visas from '../../content/visas.json';

const files = import.meta.glob('../../content/checks/*.json', { eager: true, import: 'default' });

export const VISAS = visas;
export const CHECKS = Object.values(files).flat();
export const stageOf = (visa, stage) => VISAS.visas[visa]?.stages.find((s) => s.id === stage);
