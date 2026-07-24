# ANPSCORE

ระบบบริหารจัดการผลการเรียน (student grade / score management system) — a single-page web app for teachers and admins to record, manage, and report student scores.

## Tech stack

- Plain HTML/JS single-page app (`index.html`)
- [Tailwind CSS](https://tailwindcss.com/) (via CDN)
- [Chart.js](https://www.chartjs.org/) for reporting charts
- [SheetJS (xlsx)](https://sheetjs.com/) for spreadsheet import/export
- [Phosphor Icons](https://phosphoricons.com/)
- [Firebase](https://firebase.google.com/) (Auth + Firestore) for backend data and authentication
- [Firebase Hosting](https://firebase.google.com/docs/hosting) for deployment

## Development

The app is a static site — open `index.html` directly in a browser, or serve it locally with the Firebase CLI:

```bash
firebase serve
```

## Deployment

```bash
firebase deploy
```

Deployment targets the Firebase project configured in `.firebaserc`.
