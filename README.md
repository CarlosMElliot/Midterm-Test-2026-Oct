# High Note 5 · October 2026 Midterm

A name-only, 24-section exam with a 100-point weighted score, autosave, seven supplied listening recordings, one-at-a-time clothing picture questions, teacher grading, public results and result delivery.

## Run

Requires Node 22+ (Node 24 recommended); no npm dependencies.

```sh
cp .env.example .env
# Edit .env: set a unique ADMIN_PASSWORD of at least 16 characters.
node --env-file=.env server.mjs
```

Student: http://localhost:3000 · Teacher: http://localhost:3000/admin

Run `npm test`. The test starts closed. Sign in to the dashboard, review/edit the question bank and resolve the content blockers, then click **Open test**. Saving a question-bank draft closes the test to new students; existing students can finish against their original exam snapshot.

## Content that still needs the teacher

The supplied materials do not form a fully publishable paper yet. The dashboard explicitly blocks opening until these are resolved:

- Part III: original Exercise 7 dependent-preposition forum text/questions missing.
- Part X: sporting vocabulary word bank has no confirmed exercise/questions.
- Part XV: the matching article for the emotions questions is missing; the supplied body-language blog does not match.
- Part XXII: source questions A5 and A6 require correction (why grouped with where/when; “of” already fronted).

Additional review notes: Part IV items 6, 7 and 10 have ambiguous options without context and are manually marked. Part XXIII artwork images were not supplied. Track 3.19 is included in teacher resources but has no supplied matching exercise. No fabricated questions were added for it.

The National Geographic reference link is available **before starting** the test. Students should read it beforehand; the letter-writing section includes formal-letter guidance, useful phrases, hedging vocabulary and a ten-point rubric. Opening external tabs during the attempt triggers the focus policy.

Question keys stay on the server. Unkeyed choice questions and all written responses are reviewed by the teacher. Unanswered questions score zero; provisional totals remain labelled until all answered manual questions are graded. Raw item points are normalized to each section's weight. Weights total exactly 100, without rounding individual sections.

## Hosting

Deploy this Node server or its Docker image on an HTTPS host with a **persistent writable volume** mounted at `DATA_DIR` (default `/app/runtime` in Docker). Set `NODE_ENV=production` behind HTTPS so cookies are Secure. GitHub Pages cannot run the server, grading, secure dashboard or email delivery. This repository alone is not a deployed exam URL.

Use one server instance: persistence and sessions use local files/memory. Do not use ephemeral/serverless filesystems or multiple replicas. Restarting the server signs teachers out; student attempts and tokens persist. Back up the persistent volume and encryption key. Session cookies expire after 24 hours; admin server sessions expire after eight hours. This is intended for a supervised classroom, not high-stakes remote proctoring.

## Results in the repository

Set `GITHUB_TOKEN` to a fine-grained token restricted to this repository with Contents read/write, `GITHUB_REPOSITORY` to the target owner/repo, and `RESULTS_ENCRYPTION_KEY` to 64 hexadecimal characters (32 random bytes). The repository is public: **never commit detailed plaintext student records, .env or secrets**. The public name/score summary below is intentionally published as requested.

The server saves progress locally immediately and retries encrypted GitHub backups once per minute and after server startup. Each backup goes to `results-encrypted/<random-attempt-id>.json` on the repository's default branch. AES-256-GCM encrypts the student's name, timestamps, answers, exam snapshot, grades and event history. Names never appear in commit messages or filenames. Backup status/errors appear in the dashboard. A pending backup is not a completed repository save. Configure the token and key before use; keep the key outside the repository. The server does not automatically restore encrypted records; the persistent volume is the live data store. An offline decrypt utility is included below.

```sh
RESULTS_ENCRYPTION_KEY=... node scripts/decrypt.mjs encrypted-record.json restored-record.json
```

Store decrypted exports privately. Dashboard JSON exports include answers and identities.

## Public results and GitHub Pages

`/results` is the public scoreboard on the running Node app. It displays each submitted attempt's name, score out of 100, grading status, number of pending questions, submission time and last update time. Draft/reset attempts, answers, answer keys, teacher feedback, email addresses and session secrets are excluded. Students see a disclosure before starting. Scores awaiting manual review are explicitly provisional.

With `GITHUB_TOKEN` configured, the server publishes the same allow-listed summary to **`docs/results.json`** on the default branch once per minute. This public summary does not require the encryption key; encrypted detailed backups still do. The dashboard shows public-sync configuration/errors. Unchanged summaries are not recommitted. Live scores update immediately after submission/grading; the repository and Pages can lag behind. No student results are populated until actual attempts are submitted.

**GitHub Pages can host the public scoreboard in `docs/`:**

1. Open repository **Settings → Pages**.
2. Select **Deploy from a branch**, branch **main**, folder **/docs**, then Save.
3. After GitHub publishes it, the scoreboard URL will be `https://CarlosMElliot.github.io/Midterm-Test-2026-Oct/` (unless you configure a custom domain).

Pages is not enabled automatically by this code change. The `docs/` folder contains only the public scoreboard, styles, JavaScript and results summary. Do not publish the entire repository as an exam site.

**The full exam cannot run on GitHub Pages alone.** Pages serves static files and does not run this Node server. The current exam needs its backend for trusted grading, persistent attempts, authenticated administration, repository writes and email. Hosting the full interface on Pages would require an additional backend deployment and cross-origin authentication changes. Never put a GitHub token or email API key in browser JavaScript. See [GitHub's Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

The API used for summaries is read-only and public: `GET /api/results`.

## Email

Set `RESEND_API_KEY` and `MAIL_FROM` to a sender verified with your email provider. Students provide only their name: the teacher enters a verified recipient address in the dashboard, reads the exact report preview, then clicks **Send this report**. Reports include responses, expected answers, points, timestamps and teacher feedback. The UI only reports provider acceptance after a successful response; this is not a guarantee of inbox delivery. Without email configuration, reports can be downloaded for manual delivery. No emails are sent automatically on submission.

## Focus policy

The first detected blur, hidden tab, page reload or close records a warning. The second ends that attempt and returns the student to the start; the old attempt remains available to the teacher. Duplicate blur/visibility events within 1.5 seconds are suppressed. Page close uses best-effort `sendBeacon`; browsers cannot guarantee delivery or show a custom warning after closure. Focus monitoring cannot detect all outside activity and may flag OS dialogs or accessibility tools. Tell students to test their audio before starting; teachers should review incident logs before drawing conclusions. This is a deterrent, not tamper-proof proctoring.

## Layout and data

- `data/exam.json`: initial source bank, keys, instructions, weights and content blockers.
- `public/`: student flow, separate teacher dashboard, audio and reference images.
- `server.mjs`: authenticated APIs, autosave, event tracking, encrypted backups and email.
- `lib.mjs`: validation, public sanitization, scoring and reports.
- `runtime/`: local private state, excluded from git; override with DATA_DIR.

The clothing guide is a generated, unlabeled 4×7 image sheet; CSS displays one square per question. Pictures guide recognition, while the multiple-choice text asks for meaning. Uploaded reading extracts and recordings are included for the requested classroom test; review distribution rights before broader reuse.
