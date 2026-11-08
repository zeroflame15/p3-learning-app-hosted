# Ask Pip: delete one chat + unbookmark (2026-11-08, Bryan)

Two Ask Pip gaps Bryan asked about in the same message:

1. **Delete individual chat instead of clear all.** The Ask Pip list only
   offered "🗑 Clear all chats". Now every chat row has its own 🗑 button.
   It uses the same `deletedThreadIds` tombstone as clear-all, so a
   deleted chat can never come back from another linked device on the
   next sync (the exact trap clear-all had before `deletedThreadIds`
   existed). Deleting the open chat resets `activeThread` to the list.
   Saved Golden Bookmark answers are untouched by either delete.

2. **Golden Bookmark: how to unbookmark?** There was no way at all —
   saved answers rendered as plain text with no remove control, and
   `favAnswers` only ever grew (merge is a union). Now three ways to
   unbookmark, all the same action:
   - ✕ on a saved answer in the "🔖 Golden Bookmark — saved answers" list.
   - Tap "✓ Saved" on a Pip answer in the chat (the 🔖 Save button now
     shows ✓ Saved when that answer is already saved, and tapping it
     removes it again).
   - A removed answer is recorded in a new `deletedFavAnswers` tombstone
     (same pattern as `deletedThreadIds`), merged by union and filtered
     out of `favAnswers`, so no other device can resurrect it. Re-saving
     the same answer afterwards works (the fav handler only blocks
     duplicates that are currently saved).

## Changes (public/index.html only)

- `askHTML` thread list: each row is now a flex div — the row button
  (opens the chat) plus a 🗑 `data-delthread` button.
- `askHTML` bookmark list: each saved answer is a flex row with an
  ✕ `data-unfav` button (index into `favAnswers`).
- `askHTML` chatlog: the 🔖 Save button label is `✓ Saved` when the
  answer is already in `favAnswers`.
- `bindAsk`: new `[data-delthread]` handler (confirm first, tombstone,
  filter, reset active thread, save + render + toast) and new
  `[data-unfav]` handler (splice + tombstone, save + render + toast).
- `bindAsk` fav handler: now a toggle — already-saved removes (with
  tombstone) instead of silently doing nothing; both branches re-render
  so the button label updates.
- `mergeExplorer`: `deletedFavAnswers` unioned, then filtered out of
  `favAnswers` (right after the existing `favAnswers` union).
- New-explorer defaults: `deletedFavAnswers:[]` next to `favAnswers:[]`.

## Tests

`tests/askpip-delete.test.js` (8 tests, same eval harness as
`threads-clear.test.js`): merge-level proof that a deleted thread id
and a removed bookmark never come back from the server, that favAnswers
still unions when nothing was removed, and string assertions that the
row delete button, the confirm + tombstone, the bookmark ✕, the fav
toggle and the ✓ Saved label are all present in the page.
