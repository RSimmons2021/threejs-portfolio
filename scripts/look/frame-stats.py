"""Frame statistics for look matching (luma percentiles, contrast, saturation, local
contrast, detail). Usage: python3 frame-stats.py frames.rgb W H [label]
Input is concatenated rgb24 frames, e.g. from
  ffmpeg -i shot.png -vf scale=360:-1,crop=360:180:0:10 -f rawvideo -pix_fmt rgb24 -
The reference set (video, HUD cropped) is in docs/neon-district-look.md. Needs numpy."""
import sys, json
import numpy as np

path, W, H = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
label = sys.argv[4] if len(sys.argv) > 4 else path
raw = np.fromfile(path, np.uint8)
frames = raw.reshape(-1, H, W, 3).astype(np.float32) / 255.0

out = []
for f in frames:
    L = 0.2126 * f[..., 0] + 0.7152 * f[..., 1] + 0.0722 * f[..., 2]      # display luma (sRGB)
    mx, mn = f.max(-1), f.min(-1)
    sat = np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0)
    p = np.percentile(L, [1, 5, 20, 50, 80, 95, 99])
    shadows = f[L <= p[2]].mean(0)
    highs = f[L >= p[5]].mean(0)
    mids = f[(L > p[2]) & (L < p[4])].mean(0)
    # vertical brightness profile (top -> bottom, 5 bands)
    bands = [float(L[int(i * H / 5):int((i + 1) * H / 5)].mean()) for i in range(5)]
    # detail: mean gradient magnitude and Laplacian variance (sharpness)
    gx = np.abs(np.diff(L, axis=1)).mean(); gy = np.abs(np.diff(L, axis=0)).mean()
    lap = (-4 * L[1:-1, 1:-1] + L[:-2, 1:-1] + L[2:, 1:-1] + L[1:-1, :-2] + L[1:-1, 2:])
    neon = float(((L > 0.6) & (sat > 0.55)).mean())
    hot = float((L > 0.92).mean())
    # local contrast: std of L in 16px tiles
    t = 16
    tiles = L[:H // t * t, :W // t * t].reshape(H // t, t, W // t, t).std(axis=(1, 3)).mean()
    out.append(dict(mean=float(L.mean()), p=[float(v) for v in p], sat=float(sat.mean()),
                    sat_hi=float(sat[L >= p[5]].mean()), shadow_rgb=shadows.tolist(), mid_rgb=mids.tolist(),
                    high_rgb=highs.tolist(), bands=bands, grad=float(gx + gy), lapvar=float(lap.var()),
                    neon=neon, hot=hot, localc=float(tiles)))

def agg(key, idx=None):
    vals = np.array([o[key] if idx is None else o[key][idx] for o in out])
    return [round(float(np.percentile(vals, q)), 4) for q in (25, 50, 75)]

summary = {'label': label, 'frames': len(out),
           'mean_luma': agg('mean'), 'p5': agg('p', 1), 'p50': agg('p', 3), 'p95': agg('p', 5), 'p99': agg('p', 6),
           'contrast_p95_p5': [round(a - b, 4) for a, b in zip(agg('p', 5), agg('p', 1))],
           'saturation': agg('sat'), 'sat_highlights': agg('sat_hi'),
           'shadow_rgb_median': np.median([o['shadow_rgb'] for o in out], 0).round(4).tolist(),
           'mid_rgb_median': np.median([o['mid_rgb'] for o in out], 0).round(4).tolist(),
           'high_rgb_median': np.median([o['high_rgb'] for o in out], 0).round(4).tolist(),
           'bands_top_to_bottom': np.median([o['bands'] for o in out], 0).round(4).tolist(),
           'gradient_detail': agg('grad'), 'laplacian_var': agg('lapvar'), 'local_contrast': agg('localc'),
           'neon_fraction': agg('neon'), 'clipped_fraction': agg('hot')}
print(json.dumps(summary, indent=1))
json.dump({'summary': summary, 'frames': out}, open(path + '.json', 'w'))
