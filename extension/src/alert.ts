let ctx: AudioContext | undefined;

// browsers only allow sound after a user gesture, so arm on the first click or key press
function arm() {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
}
for (const type of ['pointerdown', 'keydown'] as const) {
  document.addEventListener(type, arm, { once: true, capture: true });
}

function tone(freq: number, start: number, length: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const t0 = ctx.currentTime + start;
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.15, t0 + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + length + 0.05);
}

export function nudge() {
  tone(660, 0, 0.35);
  tone(880, 0.22, 0.45);
  // does nothing on desktop Chrome, harmless there
  navigator.vibrate?.([200, 100, 200]);
  // system pop-up; the fixed id makes a repeat replace the old one instead of stacking
  chrome.notifications
    .create('tether-nudge', {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon.png'),
      title: 'Tether',
      message: 'You drifted from your step. Come back when you are ready.',
      priority: 2,
    })
    .catch(() => {});
}
