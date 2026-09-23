# Cadence learning experience research

Reviewed 23 September 2026. This is a review of public product documentation and Cambridge task descriptions, not hands-on testing of paid competitor accounts or an efficacy study.

## Findings and implemented decisions

| Source | Relevant pattern | Cadence implementation |
| --- | --- | --- |
| [Busuu Study Plans](https://help.busuu.com/hc/en-us/articles/16097312171153-What-s-a-Study-Plan-How-do-I-make-one) | Plans connect motivation, target level, study time, and schedule. | Keep the existing learner profile and weekly goal; add a next-step area that routes to setup, unfinished practice, or a completed session depending on state. |
| [Babbel vocabulary review](https://support.babbel.com/hc/en-gb/articles/360037496932-Memorising-vocabulary) | Spaced repetition makes review an ongoing part of learning. | Surface the actual due queue alongside practice. Let learners save useful feedback from historical sessions into the existing spaced-review bank. |
| [Cambridge C2 task format](https://www.cambridgeenglish.org/exams-and-tests/qualifications/proficiency/format/) | Advanced work includes semantic precision, collocation, tone, inference, coherence, and varied writing forms. | Make learners' own writing and detailed feedback searchable and reusable. Preserve guided versus no-hints labels and correction versus alternative distinctions. Existing focus counts remain activity measures, not inferred C2 scores. |

## Interface decisions

- Group navigation into Learn & practise and Remember & reflect. Retain familiar tab names and the same outer width across every screen.
- Use horizontally scrollable navigation groups on narrow displays, visible selected states, keyboard focus styles, and a skip-to-content link.
- Add three actionable dashboard next steps: practise, remember, reflect. One activity is enough; these are not a mandatory checklist.
- Add a Learning Notebook for completed Today sessions with text search, revision/no-hints filters, expandable writing and feedback, and save-to-bank actions.
- Keep the existing account sync/error notice authoritative. Notebook counts do not assert that a failed save reached the server.
- Reuse existing account data; no new database category, API request, subscription, or environment variable.

## Boundaries and future opportunities

The Notebook uses completed Today sessions; standalone Practice and Exercises responses are not currently archived. Speaking and listening would require real audio activities and assessment, not relabelled written tasks. A future advanced track could introduce source synthesis, audience changes, and longer essays/reports; that needs a deliberate content and feedback design. No estimated date of C2 attainment or proficiency percentage is inferred from activity counts.

## Validation

Targeted TypeScript checking and UI integration tests cover navigation, notebook search/filtering, saved writing, and saving expressions without duplication. Browser checks and full build availability are reported separately in the task outcome.
