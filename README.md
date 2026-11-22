# ROLL RUSH 2

A Three.js + Vite + Capacitor mobile-ready ball runner.

## Features
- Free sideways steering by dragging anywhere on the game screen; automatic forward movement.
- Tap to jump, with ramps that launch the ball and add speed.
- Falling off either side of the runway ends the run.
- Collect coins, unlock Lava / Ice / Space worlds, and buy ball skins.
- Four difficulty modes: Easy, Medium, Hard and Extreme.
- Generated music and sound effects (starts after a user gesture).
- Local save data for coins, unlocked worlds and owned/equipped skins.

## Run on Windows
1. Install Node.js LTS.
2. Extract the ZIP and open this folder in Terminal / Command Prompt.
3. Run `npm install`
4. Run `npm run dev` and open the local address shown.
5. For a production web build, run `npm run build`.

## iPhone / Capacitor
This ZIP contains the web app and Capacitor configuration. To create the iOS platform folder, run `npx cap add ios`, then `npm run build` and `npx cap sync ios`. Building/signing an installable iPhone app still requires an Apple signing setup (normally Xcode on a Mac or a properly configured cloud build).

Coins and unlocks are saved locally on the device/browser. The game uses generated audio and does not require downloaded music files.
