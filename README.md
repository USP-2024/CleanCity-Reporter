# CleanCity Reporter

Citizens report garbage, potholes and other civic problems with a **photo + GPS location**.
An admin assigns a worker, the worker cleans it and uploads an **after photo** (accepted only if
taken within 50 m of the problem), and the admin approves it. Everyone sees a before/after view.

- **Frontend:** Flutter (Dart), Provider, flutter_map (OpenStreetMap), fl_chart, image_picker, geolocator, webview_flutter
- **Backend:** Node.js + Express REST API, JWT login, bcrypt, multer (photo uploads)
- **Database:** MongoDB (Mongoose), 2dsphere geo index
- **3D simulation (new):** Three.js scenes shown inside the Flutter app (see "3D Simulation" below)

```
cleancity_reporter/
├── backend/            Node.js + Express API  (npm start)
├── flutter_source/     Flutter code (lib/ + pubspec.yaml)
├── setup_app.js        builds the Flutter project from flutter_source into ./app
└── README.md
```

---

## Updating from the previous version (you already have it running)

1. Stop the backend (Ctrl+C in its terminal).
2. Unzip this new zip **over** your existing `cleancity_reporter` folder and choose **Replace** for files that already exist.
   Your `node_modules`, `uploads` photos and the generated `app` folder are not touched.
3. Backend: `cd backend`, `npm install`, then `npm start`.
   Add the demo simulations **without wiping your data**: `npm run seed:sims` (do NOT run `npm run seed`, it deletes everything).
4. App: from the `cleancity_reporter` folder run `node setup_app.js` (safe to repeat; it downloads the new webview package), then `cd app` and `flutter run`.

## 1. Install the tools (once)

| Tool | Check it | Get it |
|---|---|---|
| Node.js 18+ | `node -v` | https://nodejs.org (LTS) |
| MongoDB Community Server | `mongod --version` | https://www.mongodb.com/try/download/community |
| Flutter + Android Studio emulator | `flutter doctor` | you already have this |

**MongoDB on Windows:** run the installer, choose *Complete*, and keep **"Install MongoDB as a Service"**
ticked. It then starts automatically with Windows. (MongoDB Compass, the visual viewer, is offered in the
same installer.)

**No MongoDB install? Use the free cloud one (no card needed):** create a free M0 cluster at
https://www.mongodb.com/atlas, allow access from anywhere (0.0.0.0/0), copy the connection string and paste
it as `MONGO_URI` in `backend/.env`.

## 2. Start the backend

```bash
cd backend
npm install
npm run seed      # fills the database with demo users + 18 reports (run once)
npm start
```

You should see `MongoDB connected` and `API running on http://localhost:5000`.
Open http://localhost:5000 in a browser: it shows `{"app":"CleanCity Reporter API","status":"running"}`.

Keep this terminal open while you use the app.
If Windows Firewall asks about Node.js, click **Allow**.

## 3. Build and run the Flutter app

Open a **new** terminal in the `cleancity_reporter` folder:

```bash
node setup_app.js       # creates ./app, copies the code, adds permissions, runs flutter pub get
```

Start your Android emulator, then:

```bash
cd app
flutter run
```

The first build downloads Gradle files and takes a few minutes.

> **Manual alternative** (if `setup_app.js` fails): run `flutter create --org com.cleancity --project-name cleancity_app --platforms=android app`,
> replace `app/lib` and `app/pubspec.yaml` with the ones from `flutter_source`, run `flutter pub get`, and in
> `app/android/app/src/main/AndroidManifest.xml` add these three lines above `<application`:
> `INTERNET`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` permissions, and add
> `android:usesCleartextTraffic="true"` inside the `<application` tag.

## 4. Emulator settings for the demo

1. **Camera:** Android Studio > Device Manager > edit your emulator > *Show Advanced Settings* > set
   **Back Camera = Webcam0**. (Or use the **Gallery** button in the app: drag an image onto the emulator window first.)
2. **Location:** click the `...` button on the emulator side bar > **Location** > enter
   `19.1136` and `72.8697` > **Set location**. This is the demo point where the seeded reports are.
3. The map needs the internet (OpenStreetMap tiles).

## Demo accounts (password for all: `password123`)

| Role | Email |
|---|---|
| Admin | admin@cleancity.com |
| Worker | worker1@cleancity.com, worker2@cleancity.com |
| Citizen | citizen@cleancity.com, citizen2@cleancity.com, citizen3@cleancity.com, citizen4@cleancity.com |

The login screen has tap-to-fill buttons for these. To make a new worker: register a citizen account,
log in as admin > **Users** tab > menu > *Make worker*.

## Demo script (5 minutes, one person)

1. **Citizen:** log in, tap **Report**, take a photo, fill the title, submit. Because the emulator is at
   the demo point, the app asks *"Already reported nearby?"* (duplicate detection). Try **Same - Me too**, then repeat and pick **No, report new**.
2. **Admin:** log in, open the new report, **Assign worker** > Ramesh Patil. Show the **Dashboard** charts.
3. **Worker** (`worker1@...`): open the task, **Start work**, then **Upload after photo**.
   First set the emulator location *far away* (e.g. 28.6139, 77.2090): the server **rejects** the photo.
   Then set the location to the report's GPS (shown on the report page) and upload again: accepted.
4. **Admin:** open the report > **Approve after photo** (or Reject with a reason).
5. **Citizen:** open the report, drag the **before/after slider**, tap **Yes, it's cleaned**. Check **Leaderboard** and the bell icon.

For the final demo set `allowGalleryUpload = false` in `flutter_source/lib/config.dart` (copy to `app/lib/config.dart`) so only the camera works.

## Using a real phone instead of the emulator

Put the phone on the same Wi-Fi as the laptop, find the laptop's IP (`ipconfig` on Windows), and change
`baseUrl` in `app/lib/config.dart` to `http://<that-ip>:5000`. Plug in the phone with USB debugging on and run `flutter run`.

## 3D Simulation (worker simulator + admin CCTV control room)

**Worker tab "Simulator"** (log in as `worker1@cleancity.com`):
1. Tap **Start simulation**. A short 3D story plays: *(1)* a citizen photographs garbage and reports it, *(2)* the admin assigns the job to you.
2. *(3)* You take control. Drag the **joystick** to walk, stand next to a piece of garbage and **hold CLEAN** (a ring fills up; the pile shrinks and the dirty ground fades).
3. *(4)* When all 14 pieces are gone, tap **TAKE PHOTO**, press the shutter, then **Upload**. The photo is a snapshot of the 3D scene with a time stamp.
4. *(5)* The camera switches to a CCTV view: "Admin watching, pending review".

**Admin tab "Control room"** (log in as `admin@cleancity.com`):
- **3D CCTV:** a night-time 3D city. Every real report appears in its ward (garbage piles, potholes, puddles, broken lights) with a coloured ring for its status, and workers sweep where a report is *In progress*. The scene refreshes itself every 15 seconds.
  Drag to rotate, pinch to zoom, **tap a camera pole (or a chip at the bottom)** to see that camera's feed with a REC overlay, **tap a marker** to open the real report, and try **Night vision**.
  The **training ground** (CAM 07) shows an automatic worker cleaning again and again, and purple screens for submitted simulations.
- **Sim reviews:** the queue of worker simulation photos. Open one and **Approve / Reject** it. The worker gets a notification.

Notes for the viva:
- The simulation is clearly separate from real work: it is stored in its own `simulations` collection and never changes a report or gives points. A simulated photo cannot replace the GPS-verified after photo.
- The CCTV is a **digital twin**: a 3D visualisation driven by live database data (`GET /api/reports`), not a camera feed.
- Flutter hosts the scenes in a WebView (`lib/widgets/sim_view.dart`); the scenes are Three.js code in `assets/sim/`. Messages go both ways: Flutter sends the data, the scene sends back "photo captured" or "open this report".
- The whole app, login, camera, GPS, maps and all API calls are Flutter; only the 3D rendering is HTML/JavaScript.

Try the 3D scenes without the emulator: open `flutter_source/assets/sim/index.html?mode=cleaner` or `...?mode=control_room` in Chrome on your laptop (keyboard: arrows/WASD + Space).

## Troubleshooting

| Problem | Fix |
|---|---|
| "Cannot reach the server" in the app | Is `npm start` still running? Is `baseUrl` in `lib/config.dart` `http://10.0.2.2:5000` (emulator)? |
| Backend says "Could not connect to MongoDB" | Start the MongoDB service (Windows: Services > MongoDB > Start), or use an Atlas URI in `backend/.env`. |
| Map is grey | The emulator has no internet, or tiles are loading. |
| Camera does not open | Set Back Camera to Webcam0, or use the Gallery button. |
| "Location not available" | Set a location in the emulator (`...` > Location) and tap the refresh icon. |
| `flutter pub get` version errors | Run `flutter upgrade`, then `flutter pub get` again. |
| Gradle / licence errors | `flutter doctor --android-licenses`, then `flutter doctor`. |
| 3D view is black or very slow | Android Studio > Device Manager > edit the emulator > Show Advanced Settings > **Graphics: Hardware**. Close other heavy programs. |
| 3D view shows "could not start" | Update the emulator's **Android System WebView** (Play Store) or use an emulator image with Google APIs. |
| Port 5000 in use | Change `PORT` in `backend/.env` and `baseUrl` in `config.dart`. |
| Want fresh demo data | `cd backend && npm run seed` (wipes and re-creates users, reports, notifications). |

## How it works (for your viva)

- **Authentication:** passwords are hashed with bcrypt; login returns a **JWT** that the app sends in the `Authorization` header. Middleware checks the token and the **role** (citizen / worker / admin) on every route.
- **Photos:** uploaded with `multer` as multipart/form-data, saved in `backend/uploads/`; only the path is stored in MongoDB.
- **Duplicate detection:** the `reports` collection has a `2dsphere` index; `GET /api/reports/nearby` uses `$near` to find open reports of the same category within 100 m.
- **Fake after-photo protection:** the server measures the distance between the worker's GPS and the report's GPS with the **Haversine formula**; more than 50 m = rejected (the limit is `PHOTO_RADIUS_METERS` in `.env`). Camera-only mode is a config flag.
- **Workflow:** Reported > Assigned > In Progress > Pending Review > Resolved, with every change stored in `statusHistory`.
- **Points & leaderboard:** +10 for the reporter and worker when the admin approves, +5 when the citizen confirms. The ward ranking is a MongoDB aggregation over resolved reports.
- **Notifications:** stored in MongoDB per user; the app polls every 15 s and shows an unread badge.

## API summary

| Method | Route | Who |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | public |
| GET | `/api/auth/me` | any |
| POST | `/api/reports` (photo) | citizen |
| GET | `/api/reports`, `/api/reports/:id`, `/api/reports/nearby` | any (workers see only their tasks) |
| PUT / DELETE | `/api/reports/:id` | owner (while "reported") or admin |
| POST | `/api/reports/:id/upvote`, `/api/reports/:id/confirm` | citizen |
| PATCH | `/api/reports/:id/assign`, `/api/reports/:id/review` | admin |
| PATCH | `/api/reports/:id/status` | worker |
| POST | `/api/reports/:id/after-photo` (photo + GPS) | worker |
| GET / PATCH / DELETE | `/api/users`, `/api/users/:id/role`, `/api/users/:id` | admin |
| GET | `/api/stats` | admin |
| GET | `/api/leaderboard`, `/api/notifications` | any |
| PATCH | `/api/notifications/read-all` | any |
| POST | `/api/simulations` (photo + stats) | worker |
| GET | `/api/simulations`, `/api/simulations/:id` | admin (all) / worker (own) |
| PATCH | `/api/simulations/:id/review` | admin |
