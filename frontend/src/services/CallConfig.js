const STUN_URL = import.meta.env.VITE_STUN_URL || "stun:stun.l.google.com:19302";

const iceServers = [{ urls: STUN_URL }];

const TURN_URL = import.meta.env.VITE_TURN_URL;
if (TURN_URL) {
    iceServers.push({
        urls: TURN_URL,
        username: import.meta.env.VITE_TURN_USERNAME,
        credential: import.meta.env.VITE_TURN_CREDENTIAL,
    });
}

export const RTC_CONFIG = { iceServers };

export const RING_TIMEOUT_MS = 35000;