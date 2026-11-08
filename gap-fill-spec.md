# Gap-fill spec — learning-app question banks (2026-11-08)

## Goal
Fill the 95 sub-topics with `cov:'no'`, top up the 25 `partial` and the
16 `p4`-only sub-topics, so every one of the 34 myKx topics in
`MYKX_SUBJECTS` (public/index.html) has a working Practise quest.
Jiyuna does all 14 topics daily; the standard is the existing banks:
per topic per level — quest 5, warm 8, fresh 10, retry 6 (= 29).

## Output (ONE JSON file per agent, nothing else)
Write to `~/workspace/hosted-p3-learning-app/gap-fill/<file>.json`.
Do NOT edit public/index.html, any test, or any other project file.
Assembly (splicing into TOPICS/FRESH_BANK, MYKX_SUBJECTS cov/map,
tests, seeding sb_questions) is done centrally afterwards.

## JSON shape
```json
{
  "newTopics": [
    { "id": "math-time", "img": "", "sub": "math", "subName": "Maths",
      "icon": "🕐", "name": "Time Travellers",
      "blurb": "Telling time and working out durations.",
      "quest": [ {"q": "...", "o": ["..","..","..",".."], "a": 0, "c": "...", "j": "...", "sub": "duration"}, ... 5 ],
      "warm": [ ... 8 ], "fresh": [ ... 10 ], "retry": [ ... 6 ],
      "p4quest": [ ... 5 ], "p4warm": [ ... 8 ], "p4fresh": [ ... 10 ], "p4retry": [ ... 6 ] }
  ],
  "topUps": [
    { "topicId": "math-mrt", "kind": "quest", "level": 3,
      "questions": [ {"q": "...", "o": [...], "a": 0, "c": "...", "j": "...", "sub": "missing_number"} ] }
  ]
}
```
- `kind` is one of quest / warm / fresh / retry. `level` is 3 or 4.
- `warm` questions have `"c": ""` and `"j": ""` (existing convention).
- Every question carries `"sub"` = the sub-skill id it teaches.
- `img` is `""` for new topics (the page falls back to the emoji icon;
  3D icons are a separate follow-up, not this job).

## Question quality rules (all subjects)
- Exactly 4 options, all distinct strings, exactly one correct, `a`
  is its 0-based index. No "all of the above" / "none of the above".
- The correct answer's key word must NOT appear in the stem (no leak).
- Explanation `c` states the working / why (one or two short sentences).
  Joke `j` is kid-friendly, one short line, never about failing.
- P3 level: Primary 3 difficulty. P4 level: a step harder (bigger
  numbers, two steps, trickier vocabulary) AND different questions —
  never the P3 question with new numbers only.
- No duplicate stems: a question's normalised stem (lowercased,
  punctuation/space stripped) must not match any existing bank stem
  for that topic (read TOPICS + FRESH_BANK in public/index.html) nor
  any other question in your batch. Check before handing back.
- Distribution: within a new topic, spread the 29 per level across
  its sub-skills — every sub-skill gets at least 2 questions per
  level, and the 5 quest questions span at least 3 sub-skills.

## Maths rules (extra)
- The correct answer must RECOMPUTE from the numbers in the stem,
  using every number in the stem. Verify each one by hand as you write.
- No estimation, multiples, factors, rounding, or "which is closest"
  questions. No "how many more/fewer" with an unstated comparison.
- Options are plain numbers (or plain fractions like 3/4) — no $ or
  units inside options; the unit lives in the stem.
- Distractors must be plausible wrong-step answers (e.g. adding
  instead of subtracting, forgetting to convert units), not random.

## Subject notes
- English spelling: "choose the correctly spelt word" MCQs.
- English visual text: the stem must include the poster's/notice's
  text (there is no image in the question), then ask purpose/details/traps.
- Chinese: stems/options in Chinese where the skill is Chinese;
  explanations in simple English, with Chinese where it helps.
  Oral (reading_aloud, picture_talk, conversation): MCQ ABOUT the
  oral skill (choose the correct pronunciation/word, the best reply,
  the right order) — no audio in the question.
  Reading (rc_open): MCQ form — choose the best answer/sentence.
  Composition (picture_composition): stem describes a picture briefly;
  ask for the best opening sentence / best order / best sentence to add.
- Angles draw_parallel / draw_perpendicular: ask about recognising or
  choosing the correct drawing, or the steps to draw it (no drawing in MCQ).
- Science: answers must match the MOE P3 syllabus (2023); no
  secondary-school concepts. Magnet questions: only P3 facts (poles,
  attract/repel, magnetic vs non-magnetic materials, uses).

## Scope per agent (sub-skill ids are from MYKX_SUBJECTS / mykx-p3-syllabus.md)
Counts: a NEW topic = 29 per level (quest 5, warm 8, fresh 10, retry 6).
Top-ups: a `no` sub-skill in an existing topic = 5 per level; a
`partial` sub-skill = +3 per level; a `p4` sub-skill = 5 at P3 only.

### maths-new (gap-fill/maths-new.json) — 5 new topics, 290 questions
- math-length "Measure Masters" 📏 "Length, mass and volume — measure it all."
  subs: convert_length, convert_mass, convert_volume, compound_units, read_scale, measure_word_problem, routes_compare
- math-time "Time Travellers" 🕐 "Telling time and working out durations."
  subs: convert_h_min, tell_time_24h, duration, end_time, start_time, across_midnight, two_step_time
- math-area "Area Adventurers" 🟦 "Area and perimeter — count the squares."
  subs: area_counting_squares, area_rectangle_square, perimeter_rectangle_square, perimeter_rectilinear, area_vs_perimeter, wire_reshaped
- math-angles "Angle Explorers" 📐 "Right, acute, obtuse — and parallel lines."
  subs: right_acute_obtuse, count_angles_in_figure, identify_parallel, identify_perpendicular, draw_parallel, draw_perpendicular
- math-bargraphs "Bar Graph Buddies" 📊 "Reading bar graphs like a detective."
  subs: read_scale, read_minor_gridlines, difference_between_bars, double_bar_compare, total_from_graph, graph_to_money

### maths-topups (gap-fill/maths-topups.json) — 185 questions
- math-mrt: no: missing_digit, fewer_more_than, part_whole_model, sum_difference_model, working_backwards (5/level each);
  partial: missing_number, two_step (+3/level each); p4: algorithm_4digit (5 at P3).
- math-ntuc: no: division_remainder, comparison_model_times, comparison_model_extra, before_after, simultaneous_compare (5/level each);
  partial: tables_6_9 (+3/level); p4: multiply_3d_by_1d, divide_3d_by_1d, two_step_mul_div (5 at P3 each).
- math-frac: no: number_line (5/level); partial: equivalent_fractions, simplest_form (+3/level each).
- math-mrt (Numbers up to 10 000): p4: place_value, numerals_words, compare_order, number_patterns, digit_value (5 at P3 each).

### english (gap-fill/english.json) — 2 new topics + top-ups, 366 questions
- NEW eng-spelling "Spelling Stars" ✏️ "Spot the correctly spelt word." sub: spelling.
- NEW eng-visual "Visual Text Detectives" 🔍 "Posters and notices — what are they really saying?"
  subs: vt_purpose, vt_details, vt_traps.
- eng-tense top-ups: no: pronoun_subject_object, pronoun_possessive, pronoun_reflexive, demonstratives, quantifiers, prepositions, question_tags, wh_questions, modals, indefinites (5/level each);
  partial: verb_form, sva (+3/level each); p4: tense_perfect, connectors (5 at P3 each).
- eng-story top-ups: no: similes, phrasal_verbs, collective_nouns, confusables, word_class (5/level each);
  partial: context_clues (+3/level).
- eng-story2 top-ups: no: comp_true_false, comp_referent, comp_phrase (5/level each);
  partial: synthesis, word_order, comp_literal, comp_sequence, comp_vocab, comp_feelings, comp_inference (+3/level each).

### science (gap-fill/science.json) — 2 new topics + top-ups, 213 questions
- NEW sci-classification "Sorting Scientists" 🔬 "Grouping living things the scientific way."
  subs: plant_fungi_groups, fungi_bacteria, animal_groups, insect_or_not, chart_heading.
- NEW sci-materials "Material Matters" 🧪 "What things are made of — and why it matters."
  subs: material_types, strength, flexibility, waterproof, absorbency, transparency, float_sink, property_to_use, fair_test.
- sci-plants top-ups: no: characteristics, lnl_identify (5/level each);
  partial: needs, plant_cycle_reasoning (+3/level each); p4: needs_experiment (5 at P3).
- sci-frog top-ups: no: duration_graph (5/level);
  partial: three_stage, cycle_diagram (+3/level each); p4: mosquito_control (5 at P3).
- sci-magnet top-ups: partial: magnet_vs_magnetic, strength_test, makeable_materials (+3/level each);
  p4: pole_puzzle, stroke_method, electrical_method (5 at P3 each).

### chinese (gap-fill/chinese.json) — 8 new topics + top-ups, 476 questions
- NEW chi-char "辨字小侦探" 🔎 "Spot the right character." sub: char_choice.
- NEW chi-picword "看图选词" 🖼️ "Look at the picture, pick the word." sub: picture_word.
- NEW chi-collocation "词语搭配" 🧩 "Words that go together." sub: collocation.
- NEW chi-sequencing "组句成段" 🧱 "Put the sentences in order." sub: sequencing.
- NEW chi-sentence "句子加工厂" ✍️ "Expand, imitate and combine sentences."
  subs: expand, imitate, combine.
- NEW chi-reading "阅读理解" 📖 "Read the passage, answer the questions."
  subs: rc_mcq, rc_open.
- NEW chi-composition "看图写段" 🎨 "Tell the story of the picture." sub: picture_composition.
- NEW chi-oral "口试小达人" 🎤 "Reading aloud, picture talk and conversation."
  subs: reading_aloud, picture_talk, conversation.
- Top-ups: chi-family + chi-school: partial: write (+3/level, into chi-family);
  partial: word_choice (+3/level, into chi-school).

## Before you report back
Run a self-check over your JSON and confirm in your reply:
1. Counts: every new topic has exactly quest 5 / warm 8 / fresh 10 /
   retry 6 per level; every top-up sub-skill has its required count.
2. Every question has 4 distinct options and a valid answer index.
3. No duplicate normalised stems within your file, and none matching
   the existing banks for those topics.
4. For Maths: every numeric answer recomputes from its stem.
5. Per-sub-skill counts (list them in your reply).
If a sub-skill cannot be filled as specified, say which and why —
do not silently shrink the counts.
