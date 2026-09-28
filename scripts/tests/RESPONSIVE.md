# Responsive browser checks

Start the frontend (`npm run dev:frontend`). Install Playwright in a temporary
directory if it is not available locally, then run:

```sh
npm install --prefix /tmp/pixels-responsive-qa playwright
PLAYWRIGHT_MODULE=/tmp/pixels-responsive-qa/node_modules/playwright node scripts/tests/responsive.cjs
```

Uses the installed Google Chrome in an isolated browser context. All application
API calls are intercepted and fulfilled with fixtures, including write requests;
the test does not change real stock, purchases, budgets, recipes, or shared plans.

Default widths: 320, 390, 600, 768, 820, 1024, 1280, 1440 CSS pixels. Small widths
also enable touch input. Set `QA_WIDTHS`, `QA_HEIGHT`, and `QA_OUTPUT` to test another
viewport or keep a separate report, for example:

```sh
PLAYWRIGHT_MODULE=/tmp/pixels-responsive-qa/node_modules/playwright QA_WIDTHS=640 QA_HEIGHT=360 QA_OUTPUT=/tmp/pixels-responsive-qa/landscape node scripts/tests/responsive.cjs
```

Coverage includes all navigation pages, the public inventory path, four data
editor tabs, every planner summary tab, BOM results and nested drawer, expanded
target materials, purchase entry and editing, recipe creation/editing and time
inputs, machine creation, stock creation/rename, floor configuration/timers,
budget editing, PIN screens, image preview, and contributor summary. Fixtures use
long Thai names, images, large quantities, and deeply nested ingredients.

The test checks document overflow, controls extending outside the viewport, and
uncaught browser errors. Intended table scrolling and closed drawers are excluded.
It also verifies that Enter calculates `99 + 22` to `121`, and `+99` produces `220`.
For shared plans, it changes the selected machine, checks that incompatible
recipes disappear, captures the saved machine ID, and reloads to verify that the
selection is restored. Older fixture plans omit machine IDs to test compatibility.
An empty inventory search and a floor loading failure exercise non-success states.

Reports and screenshots are saved under `/tmp/pixels-responsive-qa/results` by
default. Review screenshots in addition to assertions: geometric checks cannot
prove that every possible string or every browser renders well. Screenshots are
taken at 320, 820 and 1440 pixels; they are not checked into the repository.
