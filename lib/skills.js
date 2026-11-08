// Skills, not search — versioned P3 skill pack.
// Pip (live or canned) must open the EXACT method below for the child's
// level, instead of searching the web or giving a generic answer.
// Version the pack: bump SKILL_PACK_VERSION whenever a method changes,
// and show the version in the app so a grown-up can see which method
// Pip is teaching. One skill per topic/method; every one of the 14
// Learn topics maps to exactly one skill.
'use strict';

const SKILL_PACK_VERSION = 'skills-v1';
const SKILL_PACK_LEVEL = 'Singapore Primary 3 (age 8-9)';

function S(id, topicId, subject, name, method, steps, example, watchOut, keywords) {
  return { id, topicId, subject, name, method, steps, example, watchOut, keywords };
}

const SKILLS = [
  S('vocab-story', 'eng-story', 'English', 'Story Words',
    'Read the whole sentence, then pick the word that fits what happened.',
    ['Read the whole mini-story, not just the blank.', 'Picture what happened.', 'Try each word in the blank and listen — only one sounds right.', 'Check: does the word match the feeling or the action?'],
    'Mina ate her noodles in two minutes. She was really STARVING — "starving" means super, super hungry.',
    'Do not pick a word just because you like it — it must fit the story.',
    ['story', 'word', 'vocabulary', 'hungry', 'tired', 'friendly', 'adjective']),
  S('tenses', 'eng-tense', 'English', 'Tenses Trek',
    'Find the time word first (yesterday / every day / tomorrow / now), then pick the verb for that time.',
    ['Find the time word: yesterday = past, every day = present habit, tomorrow = future, now = -ing.', 'Past: add -ed, or use the special past word (go→went, sing→sang).', 'Present habit with he/she: add -s or -es.', 'Future: add "will" before the verb.'],
    'Yesterday we WENT to the zoo. "Yesterday" = past, so go becomes went.',
    'Do not use "go" for yesterday — the time word always decides.',
    ['tense', 'yesterday', 'tomorrow', 'verb', 'past', 'present', 'future', 'went', 'brushes', 'goes']),
  S('story-next', 'eng-story2', 'English', 'Finish the Story',
    'Pick the next sentence that is kind, sensible and keeps the story going.',
    ['What just happened in the story?', 'What would a kind, sensible person do next?', 'Throw out silly or unkind endings.', 'Pick the ending that fits the place and the feeling.'],
    'It rained heavily. Mei opened her umbrella and ran to the void deck — sensible, and it fits Singapore.',
    'A magical story still needs a sensible next step.',
    ['tell me a story', 'story', 'next', 'author', 'ending', 'sentence']),
  S('punctuation', 'eng-punct', 'English', 'Punctuation Pond',
    'Every sentence starts with a capital letter and ends with the right mark: full stop for telling, ? for asking, ! for strong feeling.',
    ['Is it telling, asking, or shouting? Telling = ., asking = ?, strong feeling = !', 'Start with a capital letter — names and places too (Singapore).', 'Lists use commas between items.', 'Read it aloud: a comma is a tiny pause.'],
    '"Where is my pencil?" — capital W, because it asks something, so it ends with ?',
    'A question needs BOTH a capital letter and a question mark.',
    ['punctuation', 'capital', 'full stop', 'question mark', 'comma', 'sentence', 'sentence is correct']),
  S('add-subtract', 'math-mrt', 'Maths', 'MRT Numbers — Add & Subtract',
    'Make a round number first, then add the rest. For subtraction, count up from the smaller number.',
    ['For adding: make 10 or 20 first (14 + 6 = 20, then + 3).', 'For subtracting: take away 10, then the rest (46 − 18: take 10, then 8).', 'For money change: count up from the price to what you paid.', 'Check backwards: answer + what you took away = what you started with.'],
    '14 + 9: make 20 first — 14 + 6 = 20, then + 3 = 23.',
    'Do not rush the ones column — the round-number step is the whole trick.',
    ['add', 'plus', 'subtract', 'minus', 'mrt', 'train', 'stations', 'change', 'total']),
  S('money-change', 'math-hawker', 'Maths', 'Hawker Change',
    'Add the dollars first, then the cents. 50 cents + 50 cents = $1.',
    ['Add cents first: 50¢ + 50¢ = $1.', 'Then add dollars.', 'For change: count up from the price to the money paid.', 'Write $ and the decimal point in the right place.'],
    'Chicken rice $3.50 + drink $1.50: 50¢ + 50¢ = $1, so $3 + $1 + $1 = $5.',
    '50 cents is $0.50, not $0.05.',
    ['money', 'change', 'hawker', 'chicken rice', 'dollar', 'cents', 'price', 'cost', '$', 'total']),
  S('times-tables', 'math-ntuc', 'Maths', 'Times Tables',
    'Count in groups, and learn the famous tricky ones by heart: 7 × 8 = 56, 6 × 7 = 42.',
    ['Say the table out loud in groups (6, 12, 18, 24…).', 'Use what you know: 6 × 4 is double 3 × 4.', 'Learn 7 × 8 = 56 and 6 × 7 = 42 by heart.', 'Check: multiplication is repeated adding — 6 × 4 = 6 + 6 + 6 + 6.'],
    'Apples in bags of 6, 4 bags: 6 × 4 = 24. Count in sixes: 6, 12, 18, 24.',
    'Do not mix up 7 × 8 (56) with 6 × 8 (48).',
    ['times', 'multiply', 'multiplication', 'table', '7 x 8', '7 × 8', 'groups', 'bags']),
  S('fractions', 'math-frac', 'Maths', 'Fractions Feast',
    'Bottom number = how many equal pieces. Top number = how many you have. Fewer pieces = bigger pieces.',
    ['Count the total equal pieces — that is the bottom number.', 'Count how many you have — that is the top number.', 'Fewer pieces means BIGGER pieces: 1/2 beats 1/4.', 'Top = bottom means one whole (4/4 = 1).'],
    'Pizza cut into 8 slices, you eat 2: you ate 2/8.',
    'Do not count unequal pieces — fractions only work with equal pieces.',
    ['fraction', 'half', 'quarter', 'pizza', 'slice', 'share']),
  S('life-cycle-frog', 'sci-frog', 'Science', 'Frog Life Cycle',
    'Egg → tadpole → froglet → frog. Each stage lives differently.',
    ['Eggs are laid in water, in jelly.', 'Tadpole: gills, tail, eats plants and algae.', 'Froglet: legs grow, tail shrinks, lungs grow.', 'Adult frog: lungs and skin, lives on land and in water.'],
    'A tadpole breathes with gills because it lives in water like a fish.',
    'A froglet is NOT a baby frog with a tail — the tail is shrinking away.',
    ['frog', 'tadpole', 'froglet', 'egg', 'amphibian', 'hop']),
  S('life-cycle-butterfly', null, 'Science', 'Butterfly Life Cycle',
    'Egg → caterpillar (larva) → chrysalis (pupa) → butterfly. This is metamorphosis — a big change of body.',
    ['Eggs are laid on a leaf.', 'Caterpillar (larva): eats leaves and grows bigger, moulting its skin.', 'Chrysalis (pupa): the caterpillar rests inside a hard case and changes its body.', 'Adult butterfly: wings, six legs, sips nectar with a long tongue.'],
    'A caterpillar does not turn into a butterfly in one step — it must rest inside a chrysalis first.',
    'A chrysalis is NOT a cocoon — a cocoon is made by moth caterpillars; a butterfly makes a chrysalis. And a caterpillar is NOT a worm.',
    ['butterfly', 'caterpillar', 'chrysalis', 'pupa', 'metamorphosis', 'larva', 'cocoon', 'moth']),
  S('magnets', 'sci-magnet', 'Science', 'Magnet Lab',
    'Test with a real magnet. Magnets attract iron and steel only. Same poles repel, opposite poles attract.',
    ['Bring a magnet near it — that is the test.', 'Iron and steel stick. Plastic, wood, rubber, aluminium do not.', 'Same poles (N–N, S–S) push away. Opposite poles (N–S) pull together.', 'The ends of a magnet are its poles — the strongest parts.'],
    'An iron nail sticks; a plastic ruler does not. Steel scissors stick too.',
    'Aluminium looks like metal but is NOT magnetic.',
    ['magnet', 'attract', 'repel', 'pole', 'iron', 'steel', 'paperclip']),
  S('plants', 'sci-plants', 'Science', 'Garden & Plants',
    'Plants make food with sunlight, water and air. Roots drink, leaves cook.',
    ['Roots drink water from the soil.', 'Leaves use sunlight to make food (photosynthesis).', 'Seeds need water and warmth to wake up and grow.', 'Bees carry pollen between flowers — that is how seeds are made.'],
    'A plant in a dark cupboard turns yellow and weak — no sunlight, no food.',
    'Soil is NOT the food — sunlight, water and air are.',
    ['plant', 'photosynthesis', 'leaf', 'root', 'seed', 'flower', 'sunlight', 'bee']),
  S('chinese-listening', 'chi-listen', 'Chinese', '听一听 Listening',
    'Listen first, say it out loud, then pick. Your ears teach your brain.',
    ['Tap Listen and hear the word slowly.', 'Say it out loud three times.', 'Think of the picture: 妈妈 = mother, 苹果 = apple.', 'Check the pinyin tone — mā is not mà.'],
    '妈妈 (mā ma) = mother — the first word many babies say.',
    'Do not guess from the characters alone — listen first.',
    ['chinese', '华文', 'listen', '听', '妈妈', 'mama', 'baba', 'pinyin', '苹果']),
  S('chinese-family', 'chi-family', 'Chinese', '家庭 Family Words',
    'Learn family words in pairs: big brother 哥哥, little brother 弟弟, big sister 姐姐, little sister 妹妹.',
    ['哥 = big brother, 弟 = little brother.', '姐 = big sister, 妹 = little sister.', '奶奶 = grandmother, 爷爷 = grandfather.', 'Say each word to the real person at home — that is how it sticks.'],
    '哥哥 (gē ge) is your elder brother. 弟弟 (dì di) is your younger brother.',
    '哥 and 弟 are opposites — big and little. Do not swap them.',
    ['family', '哥哥', '弟弟', '姐姐', '妹妹', '奶奶', '爷爷', '家庭', 'mama', 'baba', 'mother', 'father', 'brother', 'sister']),
  S('chinese-school', 'chi-school', 'Chinese', '学校 School Day',
    'School words. Spelling lists live in Learn under My spelling tests, where Pip plans the practice days.',
    ['Learn school words in pairs — say each one out loud.', 'Practise spelling lists in Learn under My spelling tests.', 'Redo the words you missed — Pip keeps them safe for you.', 'Recap the whole list once before the week ends.'],
    '听写 (tīng xiě) = spelling test: 听 = listen, 写 = write.',
    'Do not just copy the list — say each word out loud first.',
    ['school', '学校', '老师', '听写', 'spelling', '书包', '读书', '同学']),
  S('spelling-lscwc', null, 'English', 'Spelling — Look, Say, Cover, Write, Check',
    'Look–Say–Cover–Write–Check, one word at a time. Never copy while looking.',
    ['LOOK at the word carefully.', 'SAY it out loud, letter by letter.', 'COVER it up.', 'WRITE it from memory.', 'CHECK it — if it is wrong, do it again.'],
    'Spelling "because": look, say B-E-C-A-U-S-E, cover, write, check.',
    'Copying while looking teaches nothing — cover it first.',
    ['spelling', 'spell', 'lscwc', 'look say cover', 'write', 'word']),
  S('check-work', null, 'English', 'Check Your Work',
    'Finish, then check: read the question twice, underline the key words, and check backwards.',
    ['Read the question twice.', 'Underline the key words and numbers.', 'Check backwards: does the answer make sense?', 'Redo the mistakes — that is where the learning lives.'],
    'Score well in Maths: practise a little every day, read the question twice, show your working, check backwards, redo your mistakes.',
    'A finished answer is not a checked answer.',
    ['score', 'well', 'exam', 'test', 'check', 'study', 'revise', 'practice', 'practise']),
];

function skillById(id) { return SKILLS.find((s) => s.id === id) || null; }
function skillForTopic(topicId) { return SKILLS.find((s) => s.topicId === topicId) || null; }

// Route a question to the best skill by keyword. Returns the skill or null.
function skillForQuestion(text) {
  const s = String(text || '').toLowerCase();
  // A bare number sum is a maths skill even with no keyword.
  if (/\d\s*[x\u00d7*]\s*\d/.test(s)) return skillById('times-tables');
  if (/\d\s*[+\-]\s*\d/.test(s)) return skillById('add-subtract');
  if (/\d\s*\u00f7\s*\d/.test(s)) return skillById('times-tables');
  let best = null, bestScore = 0;
  for (const skill of SKILLS) {
    let score = 0;
    for (const kw of skill.keywords) if (s.includes(kw.toLowerCase())) score += kw.length > 4 ? 2 : 1;
    if (score > bestScore) { bestScore = score; best = skill; }
  }
  return bestScore > 0 ? best : null;
}

module.exports = { SKILL_PACK_VERSION, SKILL_PACK_LEVEL, SKILLS, skillById, skillForTopic, skillForQuestion };
