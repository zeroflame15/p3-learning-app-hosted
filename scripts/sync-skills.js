// Regenerate the embedded SKILL_PACK block in public/index.html from
// lib/skills.js + lib/agents.js (the single source of truth).
// Run after editing lib/skills.js or lib/agents.js:
//   node scripts/sync-skills.js
// Then run: npm test
'use strict';
const fs = require('fs');
const path = require('path');
const { SKILLS, SKILL_PACK_VERSION } = require('../lib/skills');
const { AGENTS } = require('../lib/agents');
const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const data = {
  version: SKILL_PACK_VERSION,
  skills: SKILLS.map((s) => ({ id: s.id, topicId: s.topicId, subject: s.subject, name: s.name, method: s.method, keywords: s.keywords })),
  agents: AGENTS.map((a) => ({ id: a.id, name: a.name, feature: a.feature, model: a.model, status: a.status, keywords: a.keywords, modelNote: a.modelNote || '' })),
};
const next = 'var SKILL_PACK = ' + JSON.stringify(data) + ';';
const re = /var SKILL_PACK = \{.*?\};\nfunction skillForQuestionClient/s;
if (!re.test(html)) { console.error('SKILL_PACK block not found in public/index.html'); process.exit(1); }
html = html.replace(re, next + '\nfunction skillForQuestionClient');
fs.writeFileSync(htmlPath, html);
console.log('Synced SKILL_PACK', SKILL_PACK_VERSION, '-', data.skills.length, 'skills,', data.agents.length, 'agents');
