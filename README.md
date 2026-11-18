# PlaceVote

A participatory map that finds consensus. Residents pin ideas to a spot, draw them along a route, mark out an area, or add whole-area policy ideas for the neighbourhood. Overlapping ideas are merged into a shared list of statements. Everyone votes agree, disagree or unsure. The open [pol.is](https://compdemocracy.org/) method (PCA plus k-means) then finds opinion groups, the **common ground** every group shares, and **where on the map** each group's priorities sit.

The demonstrator is set in **Hollins Green**, a fictional neighbourhood with a Neighbourhood Board. All residents and contributions are simulated. Nothing a visitor enters leaves their browser.

## What's in the folder

| File | What it does |
|---|---|
| `src/data.js` | The fictional neighbourhood: statements, the raw ideas behind them, and how the three hidden resident groups lean |
| `src/engine.js` | The maths: simulated votes, PCA, clustering, consensus scores, and merging new ideas into existing statements |
| `src/app.js` | The page: the map, adding ideas, voting, results and the Board summary |
| `src/index.html` | Page layout and styling |
| `build.py` | Joins everything into one file, `dist/index.html` |
| `tests/test_engine.js` | Checks the maths, e.g. that the hidden groups are rediscovered and the towpath idea merges correctly |
| `tests/smoke.py` | Clicks through the page in a browser and takes screenshots |
| `.github/workflows/site.yml` | On every change: run the tests, build, publish to GitHub Pages |

## How a change flows

1. A change is made to a file in `src/` (by Claude, or edited on GitHub).
2. GitHub automatically runs the tests. Green tick: the change is published to the live site in about a minute. Red cross: nothing is published, and the error says what broke.

## Method notes and limits

- Groups are chosen by silhouette score from k = 2 to 4. Consensus is "group-informed": a statement only counts if every group tends to agree.
- In this demo, new ideas are merged by shared wording (65%) and the distance between shapes (35%): an idea inside an area or along a route counts as close, and whole-area ideas are matched with each other. A production version would use an AI model to write merged statements, with human review.
- Participants are self-selected, so groups describe patterns of opinion, not the whole population. Whoever writes the merged statements has framing power.
