// Picture questions: the 看图选词 / 看图写段 / 口试看图说话 banks
// were written as if a picture were on screen ("图上画着…",
// "图片上，…") but the app never showed one — Bryan found a
// 看图回答 question with no picture at all (2026-11-12). The bank
// is rewritten at source to read as a scene in words, and
// depicText does the same rewrite for server-bank rows at
// ingestion, so every question the child sees is picture-free.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE_PATH = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(PAGE_PATH, 'utf8');

function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in ' + PAGE_PATH);
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}
function fnText(marker) {
  const b = fnBody(marker);
  return b.endsWith('\n') ? b.slice(0, -1) : b;
}

// The bank, with depicText itself removed: the helper legitimately
// carries the old phrases as literals, so it is excluded from the
// scan — everything else must be picture-free.
function bankHtml() {
  const start = html.indexOf('/* depicText(s):');
  const end = html.indexOf('\nfunction sbNormalizeQuestion');
  assert.ok(start >= 0 && end > start, 'depicText block not found');
  return html.slice(0, start) + html.slice(end);
}

test('picture-question banks never mention a picture', () => {
  const bank = bankHtml();
  for (const phrase of ['图上画着', '图片上', '看图说话', ' in the picture']) {
    assert.ok(!bank.includes(phrase), 'bank still mentions a picture: ' + phrase);
  }
  // The MOE topic names stay (看图选词 / 看图写段 are the syllabus
  // names): exactly the topic definition and the MOE map entry.
  assert.equal((bank.match(/看图写段/g) || []).length, 2, '看图写段 should appear only as the topic name and the MOE map name');
});

test('picture-topic blurbs do not promise a picture on screen', () => {
  assert.ok(html.includes("blurb:'Tap Listen, hear the word, pick the right meaning.'"), 'chi-listen blurb');
  assert.ok(html.includes("blurb:'Read the scene, pick the right word.'"), 'chi-picword blurb');
  assert.ok(html.includes("blurb:'Tell the story of the scene.'"), 'chi-composition blurb');
  assert.ok(html.includes("blurb:'Reading aloud, scene talk and conversation.'"), 'chi-oral blurb');
});

const depicText = eval('(' + fnText('function depicText(s){') + ')'); // eslint-disable-line no-unused-vars

test('depicText rewrites picture references into plain scene words', () => {
  const cases = [
    ['图上画着一只小猫，它跑得很快，前面有一只蝴蝶在飞。哪个词语最合适？',
     '一只小猫，它跑得很快，前面有一只蝴蝶在飞。哪个词语最合适？'],
    ['看图写段：图片上，一只小白兔在草地上吃胡萝卜。哪一句最适合做这段话的开头？',
     '一只小白兔在草地上吃胡萝卜。哪一句最适合做这段话的开头？'],
    ['看图说话：图片上，小鸟在枝头唱歌。哪一句说得最生动？',
     '小鸟在枝头唱歌。哪一句说得最生动？'],
    ['开头先介绍图片上的主要人物：有一只可爱的小白兔。',
     '开头先介绍主要人物：有一只可爱的小白兔。'],
    ['看图说话先说图片上有什么：有一只小猫在草地上玩球。',
     '先说有什么：有一只小猫在草地上玩球。'],
    ['说完图片内容，再说小明的样子和心情。',
     '说完内容，再说小明的样子和心情。'],
    ['打伞 means to hold an umbrella — it is raining in the picture!',
     '打伞 means to hold an umbrella — it is raining!'],
    ['6 × 4 = 24.', '6 × 4 = 24.'],
    ['小丽的书包里有很多书，还有图画书。', '小丽的书包里有很多书，还有图画书。'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(depicText(input), expected, 'depicText(' + input + ')');
  }
  assert.equal(depicText(''), '');
  assert.equal(depicText(null), null);
});

function clientEngine() {
  var localStorage = {
    store: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; },
    setItem(k, v) { this.store[k] = String(v); },
  };
  const hashStr = eval('(' + fnText('function hashStr(s){') + ')'); // eslint-disable-line no-unused-vars
  const seededShuffle = eval('(' + fnText('function seededShuffle(') + ')'); // eslint-disable-line no-unused-vars
  const liveGenLSGet = eval('(' + fnText('function liveGenLSGet(k){') + ')'); // eslint-disable-line no-unused-vars
  const liveGenLSSet = eval('(' + fnText('function liveGenLSSet(k,v){') + ')'); // eslint-disable-line no-unused-vars
  const isFibQuestion = eval('(' + fnText('function isFibQuestion(q){') + ')'); // eslint-disable-line no-unused-vars
  const fibExpected = eval('(' + fnText('function fibExpected(q){') + ')'); // eslint-disable-line no-unused-vars
  const fibAccepts = eval('(' + fnText('function fibAccepts(q){') + ')'); // eslint-disable-line no-unused-vars
  const depicText = eval('(' + fnText('function depicText(s){') + ')'); // eslint-disable-line no-unused-vars
  const sbNormalizeQuestion = eval('(' + fnText('function sbNormalizeQuestion(q){') + ')'); // eslint-disable-line no-unused-vars
  const sbCacheKey = eval('(' + fnText('function sbCacheKey(eid, topicId){') + ')'); // eslint-disable-line no-unused-vars
  const saveSbCache = eval('(' + fnText('function saveSbCache(eid, topicId, day, questions){') + ')'); // eslint-disable-line no-unused-vars
  return { sbNormalizeQuestion, saveSbCache, localStorage };
}

test('sbNormalizeQuestion strips picture references from a server row', () => {
  const c = clientEngine();
  const n = c.sbNormalizeQuestion({
    id: 'chi-picword-p3-0001',
    q: '图上画着小明把地上的纸屑捡起来，扔进垃圾桶。哪个词语最合适？',
    o: ['乱扔垃圾', '爱护环境', '大声说话', '浪费时间'], a: 1,
    c: '爱护环境 means to care for our surroundings — 小明 keeps the place clean!', j: '',
  });
  assert.ok(n, 'normalised');
  assert.equal(n.q, '小明把地上的纸屑捡起来，扔进垃圾桶。哪个词语最合适？');
  assert.equal(n.o[n.a], '爱护环境', 'the right answer still rides along');
});

test('saveSbCache strips picture references from cached server questions', () => {
  const c = clientEngine();
  const rows = [
    { id: 'chi-picword-p3-0001', q: '图上画着小明把地上的纸屑捡起来，扔进垃圾桶。哪个词语最合适？', o: ['乱扔垃圾', '爱护环境', '大声说话', '浪费时间'], a: 1, c: '爱护环境 means to care for our surroundings!', j: '' },
    { id: 'chi-picword-p3-0002', q: '图上画着一群小鸭子跟着鸭妈妈，排成一行走路。哪个词语最合适？', o: ['排队行走', '东倒西歪', '横冲直撞', '各自乱跑'], a: 0, c: '排队行走 means to walk in a line!', j: '' },
    { id: 'chi-picword-p3-0003', q: '图上画着小华跌倒了，小明伸出手把他扶起来。哪个词语最合适？', o: ['互相争吵', '互不理睬', '互相帮助', '互相嘲笑'], a: 2, c: '互相帮助 means to help each other!', j: '' },
    { id: 'chi-picword-p3-0004', q: '图上画着夜晚的天空挂着一个又大又圆的东西，亮亮的。哪个词语最合适？', o: ['太阳很大', '星星很多', '乌云很多', '月亮很圆'], a: 3, c: '月亮很圆 means the moon is round and big!', j: '' },
    { id: 'chi-picword-p3-0005', q: '图上画着小朋友们在操场上跑步，一个比一个快。哪个词语最合适？', o: ['你追我赶', '慢慢吞吞', '东张西望', '垂头丧气'], a: 0, c: '你追我赶 means chasing each other!', j: '' },
  ];
  const rec = c.saveSbCache('e-test-1', 'chi-picword', '2026-11-12', rows);
  assert.equal(rec.questions.length, 5);
  for (const q of rec.questions) {
    assert.ok(!q.q.includes('图上画着'), 'cached question still has a picture: ' + q.q);
    assert.ok(!q.q.includes('图片上'), 'cached question still has a picture: ' + q.q);
  }
  assert.deepEqual(rec.questions.map((q) => q.o[q.a]).sort(),
    ['爱护环境', '排队行走', '互相帮助', '月亮很圆', '你追我赶'].sort(),
    'the shuffled options still point at the right answers');
});
