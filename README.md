# High Note 5 · October 2026 Midterm

A name-only, 24-section exam with a 100-point weighted score, autosave, seven supplied listening recordings, one-at-a-time clothing picture questions, teacher grading, public results and result delivery.

## Deploy the full application to Vercel (repository-backed backend)

The repo now includes **`api/index.mjs`**, **`backend/handler.mjs`**, **`backend/github-store.mjs`** and **`vercel.json`**. Vercel runs the backend; GitHub stores its persistent records. **No external database is required.** This mode does not use local writable files, in-memory session state or a repeating background timer.

1. Import this repository in Vercel with the **Other** framework preset. Keep the repository root as Root Directory. The committed configuration builds with `node scripts/build.mjs` and serves `public/` plus the API function.
2. Set these **server-only environment variables** in Vercel:

   | Variable | Value |
   | --- | --- |
   | `ADMIN_PASSWORD` | A long unique password, at least 16 characters |
   | `GITHUB_TOKEN` | Fine-grained token scoped to this repo, Contents read/write |
   | `RESULTS_ENCRYPTION_KEY` | 64 random hexadecimal characters; keep a secure backup |
   | `GITHUB_REPOSITORY` | `CarlosMElliot/Midterm-Test-2026-Oct` |
   | `GITHUB_DATA_BRANCH` | `exam-data` (default) |
   | `GITHUB_DEFAULT_BRANCH` | `main` (default) |
   | `RESEND_API_KEY` | Email provider key; optional until email is needed |
   | `MAIL_FROM` | Verified sender address; needed for email |

3. Deploy. Open `/admin`, sign in, review the completed question bank, and open the test.
4. Share your Vercel project URL with students. Public results are at `/results`.

Generate the encryption key locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Put secrets in Vercel's Environment Variables screen, never in the repository or browser JavaScript. Keep the key stable across deployments; changing it without migrating records makes old data unreadable. Preview deployments pointed at the same branch share real exam data; use a separate data branch/repository for previews.

### What is stored where

- `exam-data` branch → `exam-records/attempt-<random-id>.json`: encrypted names, exam snapshot, progress, answers, grades and event history.
- `exam-data` branch → `exam-config/settings.json`: encrypted teacher configuration and edited question bank.
- `main` branch → `docs/results.json`: public submitted-result summaries (names, scores, grading status and timestamps).
- Vercel environment → credentials only. Signed, HttpOnly cookies keep sessions valid across function restarts. Rotating the admin password invalidates admin sessions.

The data branch is created automatically from `main` on the first storage request. Saves are acknowledged only after GitHub accepts the write. Revision checks and conflict retries prevent different requests from silently replacing each other's updates. Existing local-server `runtime/` files are not automatically migrated into this mode.

Autosave batches edits for up to 45 seconds and flushes when navigating or submitting. Failed saves remain visibly marked and navigation waits for a successful save. Keep the current tab open and retry after a network or storage error. Page-close saves remain best-effort.

Submitting or grading writes the public summary during that request. If publishing fails after the detailed record is saved, the UI shows a warning and the teacher can click **Sync public results** to retry. There is no background timer to depend on. The included ignored-build script skips data-branch and result-only deployments; app code changes still build.

### Repository storage limits

This is a small-cohort option, not a high-throughput exam database. GitHub documents general secondary limits of **80 content-generating requests/minute and 500/hour**, with some endpoints having lower limits. Each save is a repository write, so many students taking this long exam simultaneously can hit limits. Errors do not become successful saves; students must wait and retry. Run a small pilot before scheduling a full class. Larger cohorts should use a database while retaining GitHub result exports. See [GitHub API rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

The full Vercel implementation has automated tests using a simulated GitHub API, including concurrent updates and fresh function instances. The production Vercel deployment and GitHub storage connection have been verified. Email requires a separate provider key and verified sender.

## Run locally (original persistent-file backend)

Requires Node 22+ (Node 24 recommended); no npm dependencies.

```sh
cp .env.example .env
# Edit .env: set a unique ADMIN_PASSWORD of at least 16 characters.
node --env-file=.env server.mjs
```

Student: http://localhost:3000 · Teacher: http://localhost:3000/admin

Run `npm test`. The test starts closed. Sign in to the dashboard, review/edit the question bank, then click **Open test**. Saving a question-bank draft closes the test to new students; existing students can finish against their original exam snapshot.

## Completed content and teacher review

All 24 sections contain questions and their weights total 100. Teacher-authorised original material completes the dependent-preposition forum, sporting-vocabulary meanings and six-paragraph emotions article. The two relative-clause rules have been corrected, and model answers are supplied for that section.

Part IV items 6, 7 and 10 retain manual marking because the supplied options permit contextual alternatives. All written answers and the letter require teacher review. Part XXIII uses its supplied listening recording; artwork images were not supplied. Track 3.19 remains an additional teacher resource.

The National Geographic reference link is available **before starting** the test. Students should read it beforehand; the letter-writing section includes formal-letter guidance, useful phrases, hedging vocabulary and a ten-point rubric. Opening external tabs during the attempt triggers the focus policy.

Question keys stay on the server. Unkeyed choice questions and all written responses are reviewed by the teacher. Unanswered questions score zero; provisional totals remain labelled until all answered manual questions are graded. Raw item points are normalized to each section's weight. Weights total exactly 100, without rounding individual sections.

## Alternative hosting: original Node server

Deploy this Node server or its Docker image on an HTTPS host with a **persistent writable volume** mounted at `DATA_DIR` (default `/app/runtime` in Docker). Set `NODE_ENV=production` behind HTTPS so cookies are Secure. GitHub Pages cannot run the server, grading, secure dashboard or email delivery. This repository alone is not a deployed exam URL.

Use one server instance: persistence and sessions use local files/memory. Do not use ephemeral/serverless filesystems or multiple replicas. Restarting the server signs teachers out; student attempts and tokens persist. Back up the persistent volume and encryption key. Session cookies expire after 24 hours; admin server sessions expire after eight hours. This is intended for a supervised classroom, not high-stakes remote proctoring.

## Original Node server: repository backups

Set `GITHUB_TOKEN` to a fine-grained token restricted to this repository with Contents read/write, `GITHUB_REPOSITORY` to the target owner/repo, and `RESULTS_ENCRYPTION_KEY` to 64 hexadecimal characters (32 random bytes). The repository is public: **never commit detailed plaintext student records, .env or secrets**. The public name/score summary below is intentionally published as requested.

The server saves progress locally immediately and retries encrypted GitHub backups once per minute and after server startup. Each backup goes to `results-encrypted/<random-attempt-id>.json` on the repository's default branch. AES-256-GCM encrypts the student's name, timestamps, answers, exam snapshot, grades and event history. Names never appear in commit messages or filenames. Backup status/errors appear in the dashboard. A pending backup is not a completed repository save. Configure the token and key before use; keep the key outside the repository. The server does not automatically restore encrypted records; the persistent volume is the live data store. An offline decrypt utility is included below.

```sh
RESULTS_ENCRYPTION_KEY=... node scripts/decrypt.mjs encrypted-record.json restored-record.json
```

Store decrypted exports privately. Dashboard JSON exports include answers and identities.

## Public results and GitHub Pages

`/results` is the public scoreboard on the running Node app. It displays each submitted attempt's name, score out of 100, grading status, number of pending questions, submission time and last update time. Draft/reset attempts, answers, answer keys, teacher feedback, email addresses and session secrets are excluded. Students see a disclosure before starting. Scores awaiting manual review are explicitly provisional.

In the original Node server mode, with `GITHUB_TOKEN` configured, the server publishes the same allow-listed summary to **`docs/results.json`** on the default branch once per minute. This public summary does not require the encryption key; encrypted detailed backups still do. The dashboard shows public-sync configuration/errors. Unchanged summaries are not recommitted. Live scores update immediately after submission/grading; the repository and Pages can lag behind. No student results are populated until actual attempts are submitted.

**GitHub Pages can host the public scoreboard in `docs/`:**

1. Open repository **Settings → Pages**.
2. Select **Deploy from a branch**, branch **main**, folder **/docs**, then Save.
3. After GitHub publishes it, the scoreboard URL will be `https://CarlosMElliot.github.io/Midterm-Test-2026-Oct/` (unless you configure a custom domain).

Pages is not enabled automatically by this code change. The `docs/` folder contains only the public scoreboard, styles, JavaScript and results summary. Do not publish the entire repository as an exam site.

**The full exam cannot run on GitHub Pages alone.** Pages serves static files and does not run this Node server. The current exam needs its backend for trusted grading, persistent attempts, authenticated administration, repository writes and email. The full app can now run on Vercel using the repository-backed API described above. Hosting its interface separately on Pages would require cross-origin authentication changes. Never put a GitHub token or email API key in browser JavaScript. See [GitHub's Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

The API used for summaries is read-only and public: `GET /api/results`.

## Email

Set `RESEND_API_KEY` and `MAIL_FROM` to a sender verified with your email provider. Students provide only their name: the teacher enters a verified recipient address in the dashboard, reads the exact report preview, then clicks **Send this report**. Reports include responses, expected answers, points, timestamps and teacher feedback. The UI only reports provider acceptance after a successful response; this is not a guarantee of inbox delivery. Without email configuration, reports can be downloaded for manual delivery. No emails are sent automatically on submission.

## Focus policy

The first detected blur, hidden tab, page reload or close records a warning. The second ends that attempt and returns the student to the start; the old attempt remains available to the teacher. Duplicate blur/visibility events within 1.5 seconds are suppressed. Page close uses best-effort `sendBeacon`; browsers cannot guarantee delivery or show a custom warning after closure. Focus monitoring cannot detect all outside activity and may flag OS dialogs or accessibility tools. Tell students to test their audio before starting; teachers should review incident logs before drawing conclusions. This is a deterrent, not tamper-proof proctoring.

## Layout and data

- `data/exam.json`: initial source bank, keys, instructions, weights and teacher review notes.
- `public/`: student flow, separate teacher dashboard, audio and reference images.
- `server.mjs`: original persistent-file server for local/Docker hosting.
- `api/index.mjs` and `backend/`: Vercel API with encrypted GitHub persistence and signed sessions.
- `vercel.json`: full-app deployment routes and security headers.
- `lib.mjs`: validation, public sanitization, scoring and reports.
- `runtime/`: local private state, excluded from git; override with DATA_DIR.

The clothing guide is a generated, unlabeled 4×7 image sheet; CSS displays one square per question. Pictures guide recognition, while the multiple-choice text asks for meaning. Uploaded reading extracts and recordings are included for the requested classroom test; review distribution rights before broader reuse.
