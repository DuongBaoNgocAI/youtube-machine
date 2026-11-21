"""Tạo SFX và nhạc nền gốc bằng numpy.

Mọi âm thanh được tổng hợp từ sóng sin và nhiễu, không dùng mẫu âm thanh của ai,
nên không dính bản quyền hay Content ID. Chạy được bằng Python có numpy
(Python đi kèm Blender đã có sẵn).

  python am_thanh.py <thư mục ra>    # tạo bộ SFX chuẩn để nghe thử
"""
import os
import sys
import wave

import numpy as np

SR = 44100
BPM = 90


# ---------- tiện ích ----------

def ghi_wav(path, x):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    dinh = np.max(np.abs(x)) or 1.0
    if dinh > 0.98:
        x = x / dinh * 0.98
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())


def do_dai(path):
    with wave.open(path, "rb") as w:
        return w.getnframes() / w.getframerate()


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def loc(x, f_lo=0, f_hi=0):
    """Lọc thông dải mềm trong miền tần số, dùng cho đoạn ngắn."""
    X = np.fft.rfft(x)
    f = np.maximum(np.fft.rfftfreq(len(x), 1 / SR), 1)
    g = np.ones_like(f)
    if f_lo:
        g /= 1 + (f_lo / f) ** 4
    if f_hi:
        g /= 1 + (f / f_hi) ** 4
    return np.fft.irfft(X * g, len(x))


def loc_quet(x, fc, bw=0.7, n=1024, hop=256):
    """Lọc dải có tần số giữa thay đổi theo thời gian (fc: mảng Hz theo từng mẫu)."""
    win = np.hanning(n)
    pad = np.concatenate([np.zeros(n), x, np.zeros(n)])
    fcp = np.concatenate([np.full(n, fc[0]), fc, np.full(n, fc[-1])])
    out, norm = np.zeros_like(pad), np.zeros_like(pad)
    f = np.maximum(np.fft.rfftfreq(n, 1 / SR), 1)
    for i in range(0, len(pad) - n, hop):
        g = np.exp(-0.5 * (np.log2(f / fcp[i + n // 2]) / bw) ** 2)
        out[i:i + n] += np.fft.irfft(np.fft.rfft(pad[i:i + n] * win) * g, n) * win
        norm[i:i + n] += win ** 2
    return (out / np.maximum(norm, 1e-6))[n:n + len(x)]


def chap(x, h, block=1 << 16):
    """Tích chập FFT chồng-cộng, cho tín hiệu dài."""
    m = len(h)
    nfft = 1 << int(np.ceil(np.log2(block + m - 1)))
    H = np.fft.rfft(h, nfft)
    y = np.zeros(len(x) + m - 1)
    for i in range(0, len(x), block):
        seg = x[i:i + block]
        k = len(seg) + m - 1
        y[i:i + k] += np.fft.irfft(np.fft.rfft(seg, nfft) * H, nfft)[:k]
    return y[:len(x)]


def vang(st, mix=0.25, dur=2.2, decay=3.0, sang=6000, seed=1):
    """Tiếng vang phòng tổng hợp (nhiễu tắt dần), st là mảng (n, 2)."""
    r = np.random.default_rng(seed)
    t = tt(dur)
    wet = []
    for c in range(2):
        h = loc(r.standard_normal(len(t)) * np.exp(-t * decay), 0, sang)
        h[: int(0.008 * SR)] = 0  # khoảng trễ đầu
        wet.append(chap(st[:, c], h / np.sqrt(np.sum(h ** 2))))
    return st * (1 - mix) + np.stack(wet, 1) * mix


def stereo(y, pan=0.0):
    a = (pan + 1) * np.pi / 4
    return np.stack([y * np.cos(a), y * np.sin(a)], 1)


def mf(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ---------- SFX ----------

def sfx_whoosh(r, dur=0.7):
    t = tt(dur)
    p = t / dur
    fc = 220 * 18 ** (np.sin(np.pi * np.minimum(p / 0.62, 1) / 2) ** 2) * np.where(p > 0.62, (1 - (p - 0.62) / 0.38 * 0.7), 1)
    y = loc_quet(r.standard_normal(len(t)), fc, 0.55)
    env = np.where(p < 0.62, (p / 0.62) ** 2.2, ((1 - p) / 0.38) ** 1.6)
    y *= env
    a = p * np.pi / 2  # lướt từ trái sang phải
    return vang(np.stack([y * np.cos(a), y * np.sin(a)], 1), 0.15, 0.8, 6)


def sfx_swish(r, dur=0.4):
    """Tiếng lật giấy."""
    t = tt(dur)
    p = t / dur
    y = loc_quet(r.standard_normal(len(t)), 2200 + 4000 * p, 0.9)
    crinkle = 0.55 + 0.45 * (r.random(len(t) // 220 + 1).repeat(220)[: len(t)] > 0.35)
    y *= np.sin(np.pi * p) ** 1.3 * crinkle
    return vang(stereo(y, 0.2), 0.12, 0.5, 10)


def sfx_tick(r, dur=0.12):
    t = tt(dur)
    y = np.sin(2 * np.pi * 1550 * t) * np.exp(-t * 70) + 0.35 * loc(r.standard_normal(len(t)), 3000) * np.exp(-t * 400)
    y += 0.5 * np.sin(2 * np.pi * 420 * t) * np.exp(-t * 90)
    return vang(stereo(y), 0.15, 0.4, 12)


def sfx_thud(r, dur=0.9):
    """Tiếng con dấu đập xuống: thịch trầm + tiếng giấy."""
    t = tt(dur)
    f = 45 + 110 * np.exp(-t * 18)
    low = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
    slap = loc(r.standard_normal(len(t)), 700, 3800) * np.exp(-t * 45)
    knock = np.sin(2 * np.pi * 230 * t) * np.exp(-t * 30)
    y = low * 1.0 + slap * 0.55 + knock * 0.35
    return vang(stereo(y), 0.2, 0.5, 9)


def sfx_boom(r, dur=2.8):
    """Cú đánh điện ảnh cho khoảnh khắc lật."""
    t = tt(dur)
    f = 30 + 55 * np.exp(-t * 6)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.0)
    body = loc(r.standard_normal(len(t)), 0, 260) * np.exp(-t * 5) * 1.6
    crack = loc(r.standard_normal(len(t)), 2000, 9000) * np.exp(-t * 55) * 0.5
    y = sub + body + crack
    return vang(stereo(y), 0.35, 2.5, 2.2, 3000)


def sfx_riser(r, dur=2.6):
    t = tt(dur)
    p = t / dur
    y = loc_quet(r.standard_normal(len(t)), 300 * (25 ** p), 0.5) * p ** 2.2
    for m, g in ((50, 0.25), (57, 0.18), (62, 0.12)):  # ba nốt trượt lên một quãng năm
        f = mf(m) * 2 ** (7 * p ** 1.5 / 12)
        y += g * np.sin(2 * np.pi * np.cumsum(f) / SR) * p ** 1.8 * (1 + 0.3 * np.sin(2 * np.pi * (4 + 10 * p) * t))
    y[-int(0.01 * SR):] *= np.linspace(1, 0, int(0.01 * SR))
    return vang(np.stack([y, np.roll(y, 300)], 1), 0.25, 1.5, 3)


def sfx_go(r, dur=0.1):
    """Một phím máy đánh chữ."""
    t = tt(dur)
    f1 = 1700 + 400 * r.random()
    y = loc(r.standard_normal(len(t)), 2200) * np.exp(-t * 420) * 0.8
    y += (np.sin(2 * np.pi * f1 * t) * 0.35 + np.sin(2 * np.pi * f1 * 1.93 * t) * 0.2) * np.exp(-t * 110)
    y += np.sin(2 * np.pi * 170 * t) * np.exp(-t * 70) * 0.5
    return y


def sfx_chuong(r, dur=1.4):
    t = tt(dur)
    y = sum(a * np.sin(2 * np.pi * 2093 * k * t) * np.exp(-t * d) for k, a, d in ((1, 1, 3), (2.76, 0.4, 6), (5.4, 0.2, 10)))
    y[:60] *= np.linspace(0, 1, 60)
    return vang(stereo(y * 0.6, 0.15), 0.2, 1.0, 5)


def sfx_banh_rang(r, dur=2.4):
    """Âm hiệu kênh: bánh răng tách tách nhanh dần rồi khớp 'cạch'."""
    t = tt(dur)
    y = np.zeros(len(t))
    moc, k = 0.0, 0.17
    for _ in range(9):
        i = int(moc * SR)
        n = int(0.06 * SR)
        tc = t[:n]
        click = loc(r.standard_normal(n), 1800) * np.exp(-tc * 300) * 0.6
        click += sum(np.sin(2 * np.pi * f * tc) * np.exp(-tc * 70) for f in (1250, 2650, 4100)) * 0.18
        y[i:i + n] += click * (0.5 + moc)
        moc += k
        k *= 0.86
    i = int((moc + 0.08) * SR)
    tc = t[: len(t) - i]
    clunk = sum(a * np.sin(2 * np.pi * f * tc) * np.exp(-tc * d) for f, a, d in ((140, 1, 8), (310, 0.6, 10), (523, 0.45, 12), (861, 0.3, 16), (1290, 0.2, 22)))
    clunk += loc(r.standard_normal(len(tc)), 400, 3000) * np.exp(-tc * 40) * 0.6
    y[i:] += clunk * 1.3
    return vang(stereo(y), 0.22, 1.0, 5)


def sfx_gio(r, dur=20.0):
    """Gió sa mạc, nối vòng liền mạch."""
    n = int((dur + 1) * SR)
    t = np.arange(n) / SR
    ch = []
    for c in range(2):
        nau = np.cumsum(r.standard_normal(n))
        nau = loc(nau - np.mean(nau), 40)
        fc = 380 * 2 ** (1.2 * np.sin(2 * np.pi * t / (7.3 + c)) + 0.5 * np.sin(2 * np.pi * t / 2.9 + c))
        y = loc_quet(nau, fc, 1.1, 2048, 512)
        y *= 0.65 + 0.35 * np.sin(2 * np.pi * t / (5.1 + c * 0.7)) ** 2
        ch.append(y)
    st = np.stack(ch, 1)
    k = SR  # nối vòng: trộn 1 giây cuối vào đầu
    st[:k] = st[:k] * np.linspace(0, 1, k)[:, None] + st[-k:] * np.linspace(1, 0, k)[:, None]
    st = st[:-k]
    return st / np.max(np.abs(st)) * 0.8


def noi_vong(st, k=SR):
    """Trộn k mẫu cuối vào đầu để file âm nối vòng liền mạch."""
    st[:k] = st[:k] * np.linspace(0, 1, k)[:, None] + st[-k:] * np.linspace(1, 0, k)[:, None]
    return st[:-k]


def sfx_nuoc(r, dur=16.0):
    """Nước chảy róc rách trong kênh đá: nhiễu lọc dải + bong bóng nhỏ, nối vòng."""
    n = int((dur + 1) * SR)
    t = np.arange(n) / SR
    ch = []
    for c in range(2):
        y = loc_quet(r.standard_normal(n), 900 * 2 ** (0.5 * np.sin(2 * np.pi * t / (3.1 + c))), 1.4, 2048, 512) * 0.5
        for _ in range(int(dur * 14)):  # bong bóng: nốt ngắn trượt lên
            i = r.integers(0, n - int(0.05 * SR))
            m = int(r.uniform(0.012, 0.035) * SR)
            tc = np.arange(m) / SR
            f = r.uniform(500, 1500) * (1 + 3 * tc / tc[-1])
            y[i:i + m] += np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tc * 120) * r.uniform(0.15, 0.4)
        ch.append(loc(y, 120, 7000))
    st = noi_vong(np.stack(ch, 1))
    return st / np.max(np.abs(st)) * 0.7


def sfx_lua(r, dur=12.0):
    """Lửa đèn dầu: tiếng xèo nền rất nhỏ + tách tách thưa, nối vòng."""
    n = int((dur + 1) * SR)
    nen = loc(r.standard_normal(n), 300, 2500) * 0.08
    st = np.stack([nen, np.roll(nen, 900)], 1)
    for _ in range(int(dur * 2.5)):
        i = r.integers(0, n - int(0.03 * SR))
        m = int(0.02 * SR)
        tc = np.arange(m) / SR
        tach = loc(r.standard_normal(m), 1500, 9000) * np.exp(-tc * 400) * r.uniform(0.3, 1.0)
        st[i:i + m] += stereo(tach, r.uniform(-0.4, 0.4))
    st = noi_vong(st)
    return st / np.max(np.abs(st)) * 0.6


def sfx_cuoc(r, dur=8.0):
    """Cuốc đất vọng trong hầm: nhát cuốc đều khoảng 1,1 giây, đất rơi lạo xạo, nối vòng."""
    n = int((dur + 1) * SR)
    y = np.zeros(n)
    moc = 0.3
    while moc < dur + 0.5:
        i = int(moc * SR)
        m = int(0.5 * SR)
        tc = np.arange(m) / SR
        nhat = np.sin(2 * np.pi * 180 * tc) * np.exp(-tc * 35) + loc(r.standard_normal(m), 300, 3000) * np.exp(-tc * 60) * 0.8
        dat = loc(r.standard_normal(m), 1500, 6000) * np.exp(-((tc - 0.18) / 0.12) ** 2) * 0.25
        k = min(m, n - i)
        y[i:i + k] += (nhat + dat)[:k] * r.uniform(0.7, 1.0)
        moc += r.uniform(0.95, 1.25)
    st = vang(stereo(y, 0.1), 0.35, 1.2, 4, 3000)  # vang trong hầm
    st = noi_vong(st)
    return st / np.max(np.abs(st)) * 0.7


def sfx_len_cap(r, dur=2.2):
    """Chuông lên cấp kiểu game: rải hợp âm trưởng đi lên + lấp lánh."""
    t = tt(dur)
    y = np.zeros(len(t))
    for i, m in enumerate((72, 76, 79, 84, 88)):  # C E G C E
        i0 = int(i * 0.07 * SR)
        tc = t[: len(t) - i0]
        f = mf(m)
        y[i0:] += (np.sin(2 * np.pi * f * tc) + 0.35 * np.sin(2 * np.pi * 2 * f * tc) + 0.12 * np.sin(2 * np.pi * 3 * f * tc)) * np.exp(-tc * 2.6) * 0.32
    for _ in range(40):  # hạt lấp lánh
        i = r.integers(int(0.25 * SR), len(t) - int(0.05 * SR))
        m = int(0.04 * SR)
        tc = np.arange(m) / SR
        y[i:i + m] += np.sin(2 * np.pi * r.uniform(3500, 7000) * tc) * np.exp(-tc * 90) * r.uniform(0.04, 0.12) * (1 - i / len(t))
    y[:40] *= np.linspace(0, 1, 40)
    return vang(np.stack([y, np.roll(y, 220)], 1), 0.3, 1.6, 3.5)


def sfx_exp(r, dur=0.45):
    """Tiếng cộng điểm kinh nghiệm: hai nốt nhảy lên ngắn."""
    t = tt(dur)
    y = np.zeros(len(t))
    for i, m in enumerate((84, 91)):
        i0 = int(i * 0.08 * SR)
        tc = t[: len(t) - i0]
        y[i0:] += (np.sin(2 * np.pi * mf(m) * tc) + 0.3 * np.sin(2 * np.pi * 2 * mf(m) * tc)) * np.exp(-tc * 14) * 0.45
    return vang(stereo(y, 0.1), 0.15, 0.5, 8)


def sfx_tim(r, dur=0.9):
    """Một nhịp tim (thịch-thịch) trầm."""
    t = tt(dur)
    y = np.zeros(len(t))
    for t0, g in ((0.0, 1.0), (0.22, 0.75)):
        i0 = int(t0 * SR)
        tc = t[: len(t) - i0]
        f = 48 + 30 * np.exp(-tc * 30)
        y[i0:] += np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tc * 16) * g
    return stereo(loc(y, 0, 400) * 1.4)


def sfx_canh_bao(r, dur=0.8):
    """Báo động HUD: hai tiếng bíp vuông, gắt vừa phải."""
    t = tt(dur)
    y = np.zeros(len(t))
    for t0 in (0.0, 0.32):
        i0, m = int(t0 * SR), int(0.22 * SR)
        tc = np.arange(m) / SR
        y[i0:i0 + m] += np.sign(np.sin(2 * np.pi * 880 * tc)) * np.minimum(1, tc * 200) * np.exp(-tc * 6) * 0.25
    return vang(stereo(loc(y, 200, 5000)), 0.15, 0.5, 8)


def sfx_mua(r, dur=16.0):
    """Mưa rừng: rì rào nền + hạt rơi lách tách, nối vòng."""
    n = int((dur + 1) * SR)
    ch = []
    for c in range(2):
        y = loc(r.standard_normal(n), 400, 9000) * 0.25
        y *= 0.85 + 0.15 * np.sin(2 * np.pi * np.arange(n) / SR / (6.3 + c))
        for _ in range(int(dur * 60)):
            i = r.integers(0, n - int(0.01 * SR))
            m = int(0.006 * SR)
            y[i:i + m] += loc(r.standard_normal(m), 2500, 10000) * r.uniform(0.1, 0.5)
        ch.append(y)
    st = noi_vong(np.stack(ch, 1))
    return st / np.max(np.abs(st)) * 0.6


def sfx_sam(r, dur=5.0):
    """Sấm: tiếng nổ giòn đầu rồi rền trầm cuộn dài."""
    t = tt(dur)
    ren = loc(np.cumsum(r.standard_normal(len(t))), 20, 180)
    ren = ren / np.max(np.abs(ren)) * (1 - np.exp(-t * 6)) * np.exp(-t * 0.8)
    ren *= 0.7 + 0.3 * np.abs(np.sin(2 * np.pi * t * 1.3 + r.random() * 6))  # cuộn
    gion = loc(r.standard_normal(len(t)), 600, 6000) * np.exp(-t * 9) * 0.6
    y = ren * 1.3 + gion
    return vang(np.stack([y, np.roll(y, 1200)], 1), 0.4, 3.0, 1.5, 2500)


def sfx_vut(r, dur=0.38):
    """Giáo / tên bay vút qua: luồng gió quét nhanh, cao hơn whoosh."""
    t = tt(dur)
    p = t / dur
    y = loc_quet(r.standard_normal(len(t)), 900 * 6 ** np.sin(np.pi * p), 0.35) * np.sin(np.pi * p) ** 2
    a = p * np.pi / 2
    return vang(np.stack([y * np.cos(a), y * np.sin(a)], 1), 0.1, 0.4, 10)


def sfx_ngua(r, dur=6.0):
    """Đàn ngựa phi: mỗi con một nhịp ba tiếng vó, lệch pha nhau, nối vòng."""
    n = int((dur + 1) * SR)
    y = np.zeros(n)
    for _ in range(9):
        chu_ky, lech, manh = r.uniform(0.42, 0.5), r.uniform(0, 0.5), r.uniform(0.4, 1.0)
        moc = lech
        while moc < dur + 0.8:
            for d in (0.0, 0.09, 0.2):
                i = int((moc + d) * SR)
                m = int(0.12 * SR)
                if i + m >= n:
                    continue
                tc = np.arange(m) / SR
                y[i:i + m] += (np.sin(2 * np.pi * (70 + 40 * r.random()) * tc) * np.exp(-tc * 40)
                               + loc(r.standard_normal(m), 200, 2500) * np.exp(-tc * 70) * 0.5) * manh
            moc += chu_ky
    st = noi_vong(vang(stereo(y, 0.1), 0.25, 1.0, 4, 3000))
    return st / np.max(np.abs(st)) * 0.8


def sfx_dam_dong(r, dur=4.0):
    """Đám đông hò hét xung trận: nhiều giọng 'aaa' lệch cao độ, rung, dâng lên rồi tắt."""
    t = tt(dur)
    y = np.zeros(len(t))
    for _ in range(40):
        f0 = r.uniform(95, 210) * (1 + 0.04 * np.sin(2 * np.pi * r.uniform(4, 7) * t + r.random() * 6))
        f0 *= 1 + 0.12 * np.minimum(t / 0.6, 1)  # giọng vút lên khi hét
        ph = 2 * np.pi * np.cumsum(f0) / SR
        rang = sum(np.sin(k * ph) / k for k in range(1, 14))  # sóng răng cưa
        bao = np.clip((t - r.uniform(0, 0.5)) / 0.4, 0, 1) * np.clip((dur - t - r.uniform(0, 0.6)) / 0.5, 0, 1)
        y += rang * bao * r.uniform(0.5, 1.0)
    # hai dải formant nguyên âm 'a' + hơi thở
    y = loc(y, 500, 900) * 1.0 + loc(y, 1000, 1500) * 0.6 + loc(y, 2300, 3200) * 0.25
    y += loc(r.standard_normal(len(t)), 800, 4000) * 0.15 * np.max(np.abs(y)) * np.clip(t / 0.5, 0, 1) * np.clip((dur - t) / 0.6, 0, 1)
    return vang(np.stack([y, np.roll(y, 700)], 1) / np.max(np.abs(y)), 0.45, 2.0, 2.5, 4000)


def sfx_tu_va(r, dur=3.2):
    """Kèn đồng cornu La Mã thổi lệnh: nốt trầm dày, vào chậm, hơi trượt cao độ."""
    t = tt(dur)
    f = 98 * (1 + 0.03 * np.minimum(t / 0.3, 1)) * (1 + 0.006 * np.sin(2 * np.pi * 5 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = sum(np.sin(k * ph) / k ** 1.1 for k in range(1, 20))
    y = loc(y, 80, 2200)
    y *= np.clip(t / 0.25, 0, 1) * np.clip((dur - t) / 0.5, 0, 1)
    return vang(stereo(y / np.max(np.abs(y)) * 0.8), 0.5, 2.5, 2.0, 3500)


SFX = {
    "whoosh": sfx_whoosh, "swish": sfx_swish, "tick": sfx_tick, "thud": sfx_thud,
    "boom": sfx_boom, "riser": sfx_riser, "chuong": sfx_chuong, "banh-rang": sfx_banh_rang, "gio": sfx_gio,
    "nuoc": sfx_nuoc, "lua": sfx_lua, "cuoc": sfx_cuoc,
    "len-cap": sfx_len_cap, "exp": sfx_exp, "tim": sfx_tim, "canh-bao": sfx_canh_bao, "mua": sfx_mua,
    "sam": sfx_sam, "vut": sfx_vut, "ngua": sfx_ngua, "dam-dong": sfx_dam_dong, "tu-va": sfx_tu_va,
}


def tao_sfx(thu_muc):
    """Tạo bộ SFX chuẩn (bỏ qua file đã có). Trả về {tên: đường dẫn}."""
    os.makedirs(thu_muc, exist_ok=True)
    ds = {}
    for i, (ten, ham) in enumerate(SFX.items()):
        p = os.path.join(thu_muc, ten + ".wav")
        if not os.path.exists(p):
            ghi_wav(p, ham(np.random.default_rng(100 + i)))
        ds[ten] = p
    return ds


def tao_go_phim(path, so_ky_tu, cps, khoang_trang=()):
    """Tiếng gõ máy chữ cho so_ky_tu ký tự, cps ký tự mỗi giây; ký tự trắng gõ nhẹ hơn."""
    r = np.random.default_rng(so_ky_tu)
    y = np.zeros(int((so_ky_tu / cps + 0.4) * SR))
    for i in range(so_ky_tu):
        s = sfx_go(r) * (0.35 if i in khoang_trang else 0.7 + 0.3 * r.random())
        j = int((i / cps + r.uniform(-0.008, 0.008)) * SR)
        j = max(j, 0)
        y[j:j + len(s)] += s[: len(y) - j]
    ghi_wav(path, vang(stereo(y, -0.1), 0.15, 0.4, 12))
    return path


# ---------- nhạc nền ----------
# Thang Hijaz trên Rê (D Eb F# G A Bb C): gợi không khí Ba Tư, Trung Đông.

D, EB, C, G = (50, 54, 57), (51, 55, 58), (48, 51, 55), (43, 46, 50)
DM_TOI = (50, 53, 57)
TIEN_TRINH = {
    "sang": [D, D, EB, D, D, C, EB, D],
    "toi": [G, EB, C, D],
    "vui": [D, G, EB, D],
    "ket": [D, EB, D, D],
}


class Nhac:
    def __init__(self, seed=3):
        self.r = np.random.default_rng(seed)
        self.cache = {}

    def _mau(self, key, ham):
        if key not in self.cache:
            self.cache[key] = ham()
        return self.cache[key]

    def gay(self, m):
        """Nốt gảy kiểu đàn santur: bồi âm hơi lệch, tắt nhanh ở âm cao, dây đôi hơi lệch cao độ."""
        def ham():
            t = tt(2.2)
            f0 = mf(m)
            y = np.zeros(len(t))
            for lech in (0.0, 0.0012):
                for k in range(1, 15):
                    fk = f0 * (1 + lech) * k * np.sqrt(1 + 0.0003 * k * k)
                    if fk > 15000:
                        break
                    a = abs(np.sin(np.pi * k * 0.12)) / k ** 0.8
                    y += a * np.sin(2 * np.pi * fk * t + k) * np.exp(-t * (1.6 + 0.8 * k))
            y += loc(self.r.standard_normal(len(t)), 2500) * np.exp(-t * 300) * 0.08
            y[:30] *= np.linspace(0, 1, 30)
            return y / np.max(np.abs(y))
        return self._mau(("gay", m), ham)

    def ton(self, m, dai=14.0):
        """Âm nền kéo dài (pad): ba lớp răng cưa lệch nhẹ, đã lọc mềm, trái phải khác nhau."""
        def ham():
            t = tt(dai)
            ch = []
            for c, lechs in enumerate(((-0.005, 0.002), (0.005, -0.002))):
                y = np.zeros(len(t))
                for lech in lechs + (0.0,):
                    f = mf(m) * (1 + lech)
                    for k in range(1, 9):
                        y += np.sin(2 * np.pi * f * k * t + c + k) / k * np.exp(-k / 3.0)
                y *= 1 + 0.12 * np.sin(2 * np.pi * 0.21 * t + c)
                ch.append(y)
            st = np.stack(ch, 1)
            return st / np.max(np.abs(st))
        return self._mau(("ton", m), ham)

    def dum(self):
        def ham():
            t = tt(0.6)
            f = 52 + 70 * np.exp(-t * 25)
            y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
            y += loc(self.r.standard_normal(len(t)), 0, 400) * np.exp(-t * 30) * 0.5
            return y / np.max(np.abs(y))
        return self._mau("dum", ham)

    def tak(self, sang=False):
        def ham():
            t = tt(0.15)
            y = loc(self.r.standard_normal(len(t)), 1500 if sang else 600, 7000 if sang else 3500) * np.exp(-t * (70 if sang else 45))
            y += np.sin(2 * np.pi * (610 if sang else 330) * t) * np.exp(-t * 50) * 0.4
            return y / np.max(np.abs(y))
        return self._mau(("tak", sang), ham)

    def tiktak(self):
        def ham():
            t = tt(0.05)
            y = np.sin(2 * np.pi * 3100 * t) * np.exp(-t * 160) + loc(self.r.standard_normal(len(t)), 4000) * np.exp(-t * 500) * 0.4
            return y / np.max(np.abs(y))
        return self._mau("tiktak", ham)

    def bass(self, m):
        def ham():
            t = tt(1.2)
            f = mf(m)
            y = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 3.2)
            y[:80] *= np.linspace(0, 1, 80)
            return y / np.max(np.abs(y))
        return self._mau(("bass", m), ham)

    # --- dựng một đoạn ---
    def doan(self, kieu, dai):
        """Một đoạn nhạc dài `dai` giây theo kiểu: hook, mo, meo1, meo2, meo3, lat, vui, cao-trao, ket."""
        r = self.r
        beat = 60 / BPM
        bar = 4 * beat
        n = int((dai + 4) * SR)
        buf = np.zeros((n, 2))

        def dat(mau, t0, g, pan=0.0):
            i = int(t0 * SR)
            if i >= n or g <= 0:
                return
            x = mau if mau.ndim == 2 else stereo(mau, pan)
            k = min(len(x), n - i)
            buf[i:i + k] += x[:k] * g

        cau_hinh = {
            #            tiến trình  pad   gảy  mật độ trống      bass  tiktak drone
            "hook":     ("toi",      0.30, 0.0, 0.0, "hook",   0.0,  1.0,  1.0),
            "mo":       ("sang",     0.35, 0.5, 0.45, None,    0.0,  0.0,  0.4),
            "meo1":     ("sang",     0.30, 0.55, 0.75, "nhe",  0.5,  0.0,  0.3),
            "meo2":     ("sang",     0.30, 0.55, 0.8, "vua",   0.6,  0.0,  0.3),
            "meo3":     ("sang",     0.32, 0.6, 0.95, "day",   0.7,  0.0,  0.3),
            "lat":      ("toi",      0.38, 0.25, 0.25, "lat",  0.0,  0.6,  1.0),
            "vui":      ("vui",      0.25, 0.6, 0.7, "tak",    0.3,  0.0,  0.0),
            "cao-trao": ("toi",      0.32, 0.0, 0.0, "tang",   0.6,  1.0,  1.0),
            "ket":      ("ket",      0.38, 0.45, 0.45, None,   0.3,  0.0,  0.5),
        }
        tien, g_pad, g_gay, mat_do, trong, g_bass, g_tik, g_drone = cau_hinh[kieu]
        prog = TIEN_TRINH[tien]
        hop_am_dai = 2 if kieu in ("lat", "hook", "cao-trao", "ket") else 1
        so_o = int(np.ceil(dai / bar)) + 1

        # drone Rê trầm suốt đoạn
        if g_drone:
            for m, g in ((38, 1.0), (45, 0.5)):
                x = self.ton(m)
                lap = int(np.ceil((dai + 2) / 12))
                for j in range(lap):
                    seg = x[: int(12.5 * SR)].copy()
                    f = int(0.5 * SR)
                    seg[:f] *= np.linspace(0, 1, f)[:, None]
                    seg[-f:] *= np.linspace(1, 0, f)[:, None]
                    dat(seg, j * 12, g_drone * g * 0.11)

        mau_arp = [[0, 2, 4, 2, 5, 4, 2, 1], [0, 1, 2, 3, 4, 3, 2, 1], [0, 2, 1, 3, 2, 4, 3, 5], [5, 4, 2, 4, 3, 2, 1, 2]]
        mau_trong = {
            "nhe": "D..T.DT.", "vua": "D.kTkDTk", "day": "DkkTkDTk", "tak": "..T.k.T.",
            "hook": "D.......", "lat": "D.......",
        }
        for o in range(so_o):
            t0 = o * bar
            if t0 > dai + 1:
                break
            hop_am = prog[(o // hop_am_dai) % len(prog)]
            tien_do = min(1.0, t0 / max(dai, 1))
            if o % hop_am_dai == 0 and g_pad:
                dai_ha = hop_am_dai * bar + 1.5
                for m in hop_am:
                    seg = self.ton(m + 12)[: int(dai_ha * SR)].copy()
                    a, rl = int(0.9 * SR), int(1.5 * SR)
                    seg[:a] *= np.linspace(0, 1, a)[:, None]
                    seg[-rl:] *= np.linspace(1, 0, rl)[:, None]
                    dat(seg, t0, g_pad * 0.085)
            if g_bass:
                dat(self.bass(hop_am[0] - 12 if hop_am[0] > 45 else hop_am[0]), t0, g_bass * 0.5)
                dat(self.bass(hop_am[0] - 12 if hop_am[0] > 45 else hop_am[0]), t0 + 2.5 * beat, g_bass * 0.35)
            if g_gay:
                not_ = sorted(m + 12 * k for m in hop_am for k in (1, 2))
                if kieu == "vui":
                    not_ = [m + 12 for m in not_]
                if kieu == "lat":
                    not_ = [m - 12 for m in not_]
                arp = mau_arp[(o // 2 + (1 if kieu == "meo2" else 0)) % len(mau_arp)]
                for j, idx in enumerate(arp):
                    if r.random() > mat_do:
                        continue
                    m = not_[min(idx, len(not_) - 1)]
                    if r.random() < 0.12:
                        m += r.choice([-1, 1, 2])  # nốt lướt, nhấn quãng nửa cung Eb-D đặc trưng
                    dat(self.gay(int(m)), t0 + j * beat / 2 + r.uniform(0, 0.012), g_gay * (0.6 if j % 2 == 0 else 0.45), r.uniform(-0.5, 0.5))
                if kieu == "meo3" and o % 4 == 3:  # láy rung kiểu santur cuối câu
                    m = not_[3]
                    for k in range(6):
                        dat(self.gay(int(m)), t0 + 3 * beat + k * beat / 8, g_gay * 0.2 * (1 - k / 8), 0.3)
            if trong == "tang":
                so_go = 2 + int(tien_do * 6)
                for k in range(so_go):
                    dat(self.dum(), t0 + k * bar / so_go, 0.25 + 0.4 * tien_do)
            elif trong:
                for j, c in enumerate(mau_trong[trong]):
                    tj = t0 + j * beat / 2
                    if c == "D" and (trong != "lat" or o % 2 == 0):
                        dat(self.dum(), tj, 0.45)
                    elif c == "T":
                        dat(self.tak(), tj, 0.28, -0.2)
                    elif c == "k":
                        dat(self.tak(True), tj, 0.14, 0.3)
            if g_tik:
                buoc = beat / 2 if kieu == "cao-trao" and tien_do > 0.5 else beat
                k = 0
                while k * buoc < bar:
                    dat(self.tiktak(), t0 + k * buoc, g_tik * (0.07 + (0.06 * tien_do if kieu != "lat" else 0)), 0.4)
                    k += 1
        # độ lớn: hook và cao trào tăng dần
        if kieu in ("hook", "cao-trao"):
            buf *= np.clip(np.arange(n) / (dai * SR), 0, 1)[:, None] * 0.7 + 0.45
        return buf


def tao_nhac(path, tong, doan, lang=()):
    """Nhạc nền gốc dài `tong` giây.
    doan: [(bắt đầu, kết thúc, kiểu)], lang: [(bắt đầu, kết thúc)] những khoảng tắt hẳn nhạc."""
    nh = Nhac()
    n = int((tong + 1) * SR)
    mix = np.zeros((n, 2))
    for t0, t1, kieu in doan:
        x = nh.doan(kieu, t1 - t0)
        dai = int((t1 - t0) * SR)
        vao, ra = int(0.4 * SR), int(1.5 * SR)
        x[:vao] *= np.linspace(0, 1, vao)[:, None]
        if kieu == "cao-trao":  # dừng gọn ngay lúc đóng dấu
            x[dai:] = 0
            x[dai - 400:dai] *= np.linspace(1, 0, 400)[:, None]
        else:
            x[dai:dai + ra] *= np.linspace(1, 0, ra)[:, None]
            x[dai + ra:] = 0
        i = int(t0 * SR)
        k = min(len(x), n - i)
        mix[i:i + k] += x[:k]
    mix = vang(mix, 0.28, 2.6, 2.4, 5000, seed=4)
    for a, b in lang:
        i, j, f = int(a * SR), int(b * SR), int(0.08 * SR)
        env = np.ones(n)
        env[i:j] = 0
        env[max(i - f, 0):i] = np.linspace(1, 0, i - max(i - f, 0))
        env[j:j + f] = np.linspace(0, 1, len(env[j:j + f]))
        mix *= env[:, None]
    ket = int(3 * SR)
    mix[-ket:] *= np.linspace(1, 0, ket)[:, None]
    rms = np.sqrt(np.mean(mix ** 2)) or 1
    mix = np.tanh(mix * (0.1 / rms) * 1.2) / 1.2  # khoảng -20 dBFS, chặn đỉnh mềm
    ghi_wav(path, mix)
    return path


if __name__ == "__main__":
    ra = sys.argv[1] if len(sys.argv) > 1 else "sfx"
    for k, v in tao_sfx(ra).items():
        print(k, f"{do_dai(v):.2f}s", v)
