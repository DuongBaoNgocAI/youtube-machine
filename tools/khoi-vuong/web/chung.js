// Hàm dùng chung. Mỗi vật là 16 số:
// vị trí + ry | cỡ + rx | màu + chất liệu | bán kính bo, tự sáng, hạt giống, trống.
export const SO = 16
export const CHAT = { tron: 0, dat: 1, da: 2, gach: 3, go: 4, la: 5, nuoc: 6, vai: 7, cua: 8 }
// Hình của từng vật. 0 là hình mặc định của phong cách.
export const HINH = { mac: 0, hop: 1, bo: 2, non: 3, tru: 4, da: 5 }

export const kep = t => Math.max(0, Math.min(1, t))
export const tron = (a, b, t) => a + (b - a) * t
export const muot = t => { t = kep(t); return t * t * (3 - 2 * t) }
export const rand = (x, z = 0) => { const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return v - Math.floor(v) }
export const mau = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)

export function vat(ds, p, s, hex, { ry = 0, rx = 0, chat = 0, bo = 0.12, sang = 0, hat = 0, hinh = 0 } = {}) {
  ds.push(p[0], p[1], p[2], ry, s[0], s[1], s[2], rx, ...mau(hex), chat, bo, sang, hat, hinh)
}
