/**
 * One-command Flutter setup for CleanCity Reporter.
 *
 *   node setup_app.js
 *
 * What it does:
 *   1. runs `flutter create` to generate the Android project  ->  ./app
 *   2. copies our code (flutter_source/lib + assets + pubspec.yaml) into ./app
 *   3. adds the Internet + Location permissions to AndroidManifest.xml
 *   4. runs `flutter pub get`
 *
 * It is safe to run again (it will not break an existing ./app folder).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const src = path.join(root, 'flutter_source');
const app = path.join(root, 'app');

function run(cmd, cwd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', shell: true });
}

function fail(message) {
  console.error(`\nERROR: ${message}\n`);
  process.exit(1);
}

// ---- 0. Is Flutter installed?
try {
  execSync('flutter --version', { stdio: 'ignore', shell: true });
} catch (e) {
  fail('Flutter was not found. Install Flutter and make sure "flutter --version" works in this terminal.');
}

// ---- 1. Generate the Android project (only the first time)
if (!fs.existsSync(path.join(app, 'android'))) {
  run('flutter create --org com.cleancity.v2 --project-name cleancity_app --platforms=android app', root);
} else {
  console.log('\n./app already exists - skipping "flutter create"');
}

// ---- 2. Copy our code over the generated template
fs.rmSync(path.join(app, 'lib'), { recursive: true, force: true });
fs.rmSync(path.join(app, 'test'), { recursive: true, force: true }); // default test refers to the template app
fs.cpSync(path.join(src, 'lib'), path.join(app, 'lib'), { recursive: true });
// the 3D scenes (HTML + JavaScript) live in assets/sim and are opened by the app in a WebView
fs.rmSync(path.join(app, 'assets'), { recursive: true, force: true });
fs.cpSync(path.join(src, 'assets'), path.join(app, 'assets'), { recursive: true });
fs.copyFileSync(path.join(src, 'pubspec.yaml'), path.join(app, 'pubspec.yaml'));
console.log('Copied lib/, assets/ and pubspec.yaml into ./app');

// ---- 3. Android permissions + allow plain http to the local server
const manifestPath = path.join(app, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (!fs.existsSync(manifestPath)) fail(`Could not find ${manifestPath}`);
let manifest = fs.readFileSync(manifestPath, 'utf8');

if (!manifest.includes('ACCESS_FINE_LOCATION')) {
  const permissions =
    '<uses-permission android:name="android.permission.INTERNET"/>\n' +
    '    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>\n' +
    '    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>\n\n    ';
  manifest = manifest.replace('<application', permissions + '<application');
  console.log('Added INTERNET + LOCATION permissions');
}
if (!manifest.includes('usesCleartextTraffic')) {
  manifest = manifest.replace('<application', '<application android:usesCleartextTraffic="true"');
  console.log('Enabled http (cleartext) traffic for the local server');
}
fs.writeFileSync(manifestPath, manifest);

// ---- 4. Download the packages
run('flutter pub get', app);

console.log('\nDone!  Next:');
console.log('  1. Start the backend   (cd backend && npm start)');
console.log('  2. Start your emulator');
console.log('  3. cd app && flutter run\n');
