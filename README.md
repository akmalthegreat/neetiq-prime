# NEET CBT Upgrade

Import my existing GitHub repo akmalthegreat/neetiq-prime (https://github.com/akmalthegreat/neetiq-prime) and make two changes, then push everything to that repo as a single commit.

First: "Create a neet cbt mode exactly as shown in the image... everything should as same as that...same arrangement same buttons ,ui and questions grid and everything should be as image so it feels like real nta cbt mode and connect that mode to everywhere. Also make sure cbt mode should be proper feels like neet cbt mode." The second attached image shows the reference NTA CBT interface to copy exactly: candidate info panel (Candidate Name, Exam Name, Subject), orange "Question N:" header bar with "Time:" countdown on the right, question text, options shown as (1)-(4) with a radio-selection row below, button row SAVE & NEXT (green), CLEAR, SAVE, SAVE & MARK (yellow), MARK & NEXT (blue), << BACK / NEXT >> navigation, green SUBMIT button on the right, and the right sidebar with status counts (Not Visited / Not Answered / Answered / Marked / Marked & Ans) plus the QUESTION PALETTE numbered grid with matching color coding. Connect this CBT mode everywhere quizzes are taken in the app (quiz.$testId.tsx and any quiz entry points) as a mode like the reference ?mode=cbt.

Second: "Also remove the buttons from dashboard that are red marked." The first attached image shows the dashboard with red circles around DPP Hub, NCERT Reader, Cash Contests, and Battlegrounds — remove those entries from the dashboard.

"Also after that push everything to my repo in a single commit."

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a10f688c-c688-4757-a003-f5653a95064f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
