import { registerSW } from "virtual:pwa-register";

// Register the service worker. Auto-update the app shell
// when a new version is deployed.
export function registerPWA() {
  registerSW({ immediate: true });
}
