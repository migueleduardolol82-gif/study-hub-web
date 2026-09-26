const channels = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
const luminance = (hex: string) => channels(hex).map(value => {
  const channel = value / 255;
  return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
}).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);

export function contrastRatio(foreground: string, background: string) {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

export function readableColor(preferred: string, background: string, minimum = 4.5) {
  if (contrastRatio(preferred, background) >= minimum) return preferred;
  const target = contrastRatio('#ffffff', background) > contrastRatio('#000000', background) ? '#ffffff' : '#000000';
  const from = channels(preferred), to = channels(target);
  for (let step = 1; step <= 20; step++) {
    const share = step / 20;
    const candidate = '#' + from.map((value, index) => Math.round(value * (1 - share) + to[index] * share).toString(16).padStart(2, '0')).join('');
    if (contrastRatio(candidate, background) >= minimum) return candidate;
  }
  return target;
}
