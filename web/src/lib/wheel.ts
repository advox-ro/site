// The results wheel, clockwise from the top. "Viața ta" (the general questions) is always at the
// top and always open; the other areas are topics, three of them picked at the start of the quiz.
// Axis ids as in the question pool (quiz.json, from the redactor: lib/redactor.ts); their indices there are what D1 stores (answers.axis, expected.axis), so order lives here.
export const WHEEL = ['viata', 'bani', 'munca', 'educatie', 'sanatate', 'siguranta', 'stat', 'infra', 'local'] as const;
export const GENERAL = 'viata';
