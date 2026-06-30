// Tiny self-contained ringtone generator.
//
// Bundling .mp3 ringtones would add binary assets and licensing questions; a
// couple of sine tones from the WebAudio API are plenty for a call UI and cost
// nothing. Everything here is wrapped so that an AudioContext failure (autoplay
// policy, unsupported browser) can never break the actual call.

let ctx = null;
let timer = null;
let activeNodes = [];

function audioContext() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
}

function beep(frequency, durationMs, gainValue) {
    const ac = audioContext();
    if (!ac) return;

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.value = gainValue;

    osc.connect(gain);
    gain.connect(ac.destination);

    const now = ac.currentTime;
    // Short fade in/out so the tone doesn't click.
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gainValue, now + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + durationMs / 1000);

    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.02);

    activeNodes.push(osc);
    osc.onended = () => {
        activeNodes = activeNodes.filter((n) => n !== osc);
    };
}

function startLoop(pattern, periodMs) {
    stop();
    try {
        const ac = audioContext();
        if (ac && ac.state === "suspended") ac.resume();
        pattern();
        timer = setInterval(pattern, periodMs);
    } catch {
        // Audio is a nice-to-have; never let it surface as a call error.
    }
}

/** Incoming-call ring: a brighter double-beep, repeating. */
export function startIncomingRing() {
    startLoop(() => {
        beep(660, 400, 0.12);
        setTimeout(() => beep(550, 400, 0.12), 500);
    }, 2400);
}

/** Outgoing ringback: a single, calmer low tone, repeating. */
export function startRingback() {
    startLoop(() => {
        beep(440, 700, 0.07);
    }, 2400);
}

export function stop() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    try {
        activeNodes.forEach((n) => {
            try { n.stop(); } catch { /* already stopped */ }
        });
    } catch {
        // ignore
    }
    activeNodes = [];
}