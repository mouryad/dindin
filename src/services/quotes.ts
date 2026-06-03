// Daily motivational quotes — seeded by day-of-year so the same quote
// shows all day and changes at midnight without a network call.

const QUOTES: Array<{ text: string; author: string }> = [
  { text: 'The food you eat can be either the safest and most powerful form of medicine, or the slowest form of poison.', author: 'Ann Wigmore' },
  { text: 'Let food be thy medicine and medicine be thy food.', author: 'Hippocrates' },
  { text: 'Taking care of yourself is the most powerful way to begin to take care of others.', author: 'Bryant McGill' },
  { text: 'A healthy outside starts from the inside.', author: 'Robert Urich' },
  { text: 'Cooking is love made visible.', author: 'Unknown' },
  { text: 'The act of cooking together is itself an act of love.', author: 'Laurie Colwin' },
  { text: 'Small, consistent steps beat grand, unsustainable gestures every time.', author: 'Dindin' },
  { text: 'You don\'t have to eat less. You just have to eat right.', author: 'Unknown' },
  { text: 'Nourishing yourself is a joyful act, not a punishing one.', author: 'Dindin' },
  { text: 'Movement is medicine. Food is fuel. Rest is sacred.', author: 'Dindin' },
  { text: 'Celebrate every small win. Progress, not perfection.', author: 'Dindin' },
  { text: 'The kitchen is the heart of the home.', author: 'Alfred Meakin' },
  { text: 'Cooking is not just about feeding the body — it feeds the soul.', author: 'Julia Child' },
  { text: 'One meal at a time. One day at a time.', author: 'Dindin' },
  { text: 'What you eat in private shows in public.', author: 'Unknown' },
  { text: 'Eat well, move often, sleep deeply, love always.', author: 'Dindin' },
  { text: 'A shared meal is a shared moment of grace.', author: 'Unknown' },
  { text: 'Health is not a destination — it\'s a daily practice.', author: 'Dindin' },
  { text: 'Your body is not a temple. It\'s a home. Take care of it.', author: 'Dindin' },
  { text: 'Nothing is more romantic than cooking together.', author: 'Dindin' },
  { text: 'Gratitude is the best seasoning.', author: 'Unknown' },
  { text: 'Energy begets energy. Start with one good meal.', author: 'Dindin' },
  { text: 'Be the kind of person who takes their vitamins.', author: 'Dindin' },
  { text: 'Slow food, slower days, deeper connection.', author: 'Dindin' },
  { text: 'Your choices today build the body you live in tomorrow.', author: 'Dindin' },
  { text: 'Good nutrition is not a luxury — it\'s a right.', author: 'Dindin' },
  { text: 'Cook often. Share always.', author: 'Dindin' },
  { text: 'The secret ingredient is always love.', author: 'Unknown' },
  { text: 'A streak is just one good day, repeated.', author: 'Dindin' },
  { text: 'Wellness is a collection of tiny habits, not a single grand gesture.', author: 'Dindin' },
];

function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function getDailyQuote(): { text: string; author: string } {
  return QUOTES[getDayOfYear() % QUOTES.length];
}

export function getRandomQuote(): { text: string; author: string } {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}
