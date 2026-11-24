// Phong cách "Bóng đen trong sương" (bong-den): nhân vật là một bóng đen viền sáng, mắt sáng,
// đi trong rừng sương đêm có tia sáng và bụi bay. Toàn bộ khung là một shader 2D phủ màn hình;
// nhân vật vẫn do bộ diễn xuất lái: tư thế từ dx.tuThe(T), máy từ dx.may(T), chỗ đứng đổi ra
// điểm ảnh bằng dx.raMan nên đơn vị tự co theo m.cao (khung 16:9 hay 9:16, 540p hay 1080p).
// Thứ lạ của phong cách là một bóng cao trong sương hiện ở phía phải (dx.hienX), có mắt đỏ.
//
// Hàm thuần theo T: không Math.random, không Date, không mạng, không vòng lặp khung hình.
// Hạt nhiễu, sương, bụi đều tất định theo T và theo toạ độ điểm ảnh.
export async function taoCanh({ THREE, canvas, W, H, pc, bc, kb, dx }) {
  const nv = kb.nhan_vat || {}
  const nv2 = kb.nhan_vat_phu || null
  const r = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true })
  r.setSize(W, H, false)
  r.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  const CAP = 15 // số khúc của một nhân vật
  const NET = Math.min(W, H) / 1080 // nét, hạt tính theo cạnh ngắn
  const Tmax = kb.canh[kb.canh.length - 1].den

  // ---- Đồng phục (uniform) ----
  const V4 = n => Array.from({ length: n }, () => new THREE.Vector4())
  const V2 = n => Array.from({ length: n }, () => new THREE.Vector2())
  const U = {
    uRes: { value: new THREE.Vector2(W, H) },
    uT: { value: 0 },
    uPx: { value: H / 2.5 },
    uCamX: { value: 0 },
    uGround: { value: H * 0.86 },
    uNet: { value: Math.max(0.5, NET) },
    uHat: { value: Math.max(1, NET) },
    uShake: { value: new THREE.Vector2() },
    uLight: { value: new THREE.Vector2(W * 0.85, H * 0.4) },
    uL: { value: 0 },
    uSang: { value: 0 },
    uCoPhu: { value: nv2 ? 1 : 0 },
    uMau: { value: new THREE.Color(nv.than || '#05080c') },
    uVien: { value: new THREE.Color(nv.phu || '#cdf6ff') },
    uMatC: { value: new THREE.Color(nv.mat || '#cdf6ff') },
    uMau2: { value: new THREE.Color(nv2 && nv2.than ? nv2.than : '#020304') },
    uVien2: { value: new THREE.Color(nv2 && nv2.phu ? nv2.phu : '#ff5a4a') },
    uMat2: { value: new THREE.Color(nv2 && nv2.mat ? nv2.mat : '#ff5a4a') },
    uA: { value: V4(CAP) },
    uRA: { value: V2(CAP) },
    uB: { value: V4(CAP) },
    uRB: { value: V2(CAP) },
    uEyeP: { value: new THREE.Vector4() },
    uEyeS: { value: new THREE.Vector4(4, 4, 0, 1) },
    uEyeK: { value: new THREE.Vector2() },
    uEye2P: { value: new THREE.Vector4() },
    uEye2S: { value: new THREE.Vector4(4, 4, 0, 1) },
    uEye2K: { value: new THREE.Vector2() },
    uMomP: { value: new THREE.Vector4() },
    uMomS: { value: new THREE.Vector4(0, 0, 0, 1) },
    uMomK: { value: new THREE.Vector2() },
    uMom2P: { value: new THREE.Vector4() },
    uMom2S: { value: new THREE.Vector4(0, 0, 0, 1) },
    uMom2K: { value: new THREE.Vector2() },
    uBong: { value: new THREE.Vector4(0, H, H * 0.3, 0) },
    uBongE: { value: new THREE.Vector3(0, H * 0.3, 4) },
  }

  const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`
  const FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2  uRes, uShake, uLight;
uniform float uT, uPx, uCamX, uGround, uNet, uHat, uL, uSang, uCoPhu;
uniform vec3  uMau, uVien, uMatC, uMau2, uVien2, uMat2;
uniform vec4  uA[${CAP}], uB[${CAP}];
uniform vec2  uRA[${CAP}], uRB[${CAP}];
uniform vec4  uEyeP, uEyeS, uEye2P, uEye2S, uMomP, uMomS, uMom2P, uMom2S, uBong;
uniform vec2  uEyeK, uEye2K, uMomK, uMom2K;
uniform vec3  uBongE;

const vec3 FOG  = vec3(0.125, 0.185, 0.230);
const vec3 MOON = vec3(0.42, 0.58, 0.72);

float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
             mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vn(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }

// Khoảng cách có dấu tới một khúc nối hai khớp (điểm ảnh)
float sdCap(vec2 p, vec4 ab, vec2 r){
  vec2 pa = p - ab.xy, ba = ab.zw - ab.xy;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-3), 0.0, 1.0);
  return length(pa - ba * h) - mix(r.x, r.y, h);
}
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float sdThan(vec2 p){ float d = 1e5; for (int i = 0; i < ${CAP}; i++) d = smin(d, sdCap(p, uA[i], uRA[i]), 5.0 * uNet); return d; }
float sdPhu(vec2 p){ float d = 1e5; for (int i = 0; i < ${CAP}; i++) d = smin(d, sdCap(p, uB[i], uRB[i]), 5.0 * uNet); return d; }

// Bóng cao: dựng thẳng trong toạ độ màn hình, cao theo khung nên khung dọc vẫn thấy
float sdBong(vec2 p){
  float h = max(24.0, uBong.y - uBong.z);
  float x = uBong.x + sin(uT * 0.6) * 0.012 * h;
  float top = uBong.z;
  vec2 dinh = vec2(x, top + 0.075 * h);
  vec2 vai = vec2(x, top + 0.17 * h);
  vec2 hong = vec2(x, top + 0.60 * h);
  float d = sdCap(p, vec4(dinh, dinh), vec2(0.058 * h));
  d = smin(d, sdCap(p, vec4(vai, hong), vec2(0.045 * h, 0.055 * h)), 0.04 * h);
  d = smin(d, sdCap(p, vec4(hong, vec2(x - 0.015 * h, uBong.y)), vec2(0.055 * h, 0.105 * h)), 0.05 * h);
  d = smin(d, sdCap(p, vec4(vai, vec2(x - 0.150 * h, top + 0.47 * h)), vec2(0.026 * h, 0.016 * h)), 0.03 * h);
  d = smin(d, sdCap(p, vec4(vai, vec2(x + 0.140 * h, top + 0.45 * h)), vec2(0.026 * h, 0.016 * h)), 0.03 * h);
  d = smin(d, sdCap(p, vec4(dinh, vec2(x - 0.135 * h, top + 0.015 * h)), vec2(0.030 * h, 0.004 * h)), 0.03 * h);
  return d;
}

// Một lớp cây: wx = toạ độ ngang thế giới, wy = cao trên chân lớp (đơn vị nhân vật)
float cay(float wx, float wy, float cell, float wmin, float wmax, float seed, float soft){
  float c0 = floor(wx / cell), m = 0.0;
  for (int k = -1; k <= 1; k++){
    float c = c0 + float(k);
    float ex = step(0.26, h21(vec2(c * 1.7, seed + 3.0)));
    float cx = (c + 0.2 + 0.6 * h21(vec2(c, seed + 1.0))) * cell;
    float w = mix(wmin, wmax, h21(vec2(c, seed + 2.0)));
    float lean = wy * 0.035 * (h21(vec2(c, seed)) - 0.5);
    float wid = w * 0.5 * (1.0 + 0.55 * clamp(wy, 0.0, 2.5));
    float dx = abs(wx - cx - lean) - wid;
    m = max(m, ex * (1.0 - smoothstep(-soft, soft, dx)));
  }
  return m * (1.0 - smoothstep(0.0, soft * 5.0, -wy));
}
// Cành: chỉ thêm cho lớp vẽ, không dùng khi dò tia cho nhẹ
float canh(float wx, float wy, float cell, float seed, float soft){
  float c0 = floor(wx / cell), m = 0.0;
  for (int k = -1; k <= 1; k++){
    float c = c0 + float(k);
    float ex = step(0.26, h21(vec2(c * 1.7, seed + 3.0)));
    float cx = (c + 0.2 + 0.6 * h21(vec2(c, seed + 1.0))) * cell;
    for (int j = 0; j < 2; j++){
      float fj = float(j);
      float y0 = 0.55 + 1.05 * h21(vec2(c, seed + 7.0 + fj * 3.0));
      float dir = h21(vec2(c, seed + 11.0 + fj * 5.0)) > 0.5 ? 1.0 : -1.0;
      vec2 a = vec2(cx, y0);
      vec2 b = vec2(cx + dir * (0.09 + 0.14 * h21(vec2(c, seed + 13.0 + fj))), y0 + 0.10 + 0.08 * h21(vec2(c, seed + 19.0 + fj)));
      float d = sdCap(vec2(wx, wy), vec4(a, b), vec2(0.010, 0.003));
      m = max(m, ex * (1.0 - smoothstep(-soft, soft, d)));
    }
  }
  return m * (1.0 - smoothstep(0.0, soft * 5.0, -wy));
}

float motes(vec2 p, float cs, float seed, float rad){
  vec2 cell = floor(p / cs); float s = 0.0;
  for (int dx = -1; dx <= 1; dx++) for (int dy = -1; dy <= 1; dy++){
    vec2 c = cell + vec2(float(dx), float(dy));
    vec2 hh = vec2(h21(c + seed), h21(c * 1.31 + seed + 7.0));
    vec2 ctr = (c + 0.25 + 0.5 * hh) * cs + vec2(sin(uT * 0.4 + hh.x * 6.28), cos(uT * 0.33 + hh.y * 6.28)) * cs * 0.18;
    float tw = 0.45 + 0.55 * sin(uT * 1.7 + hh.x * 40.0);
    s += (1.0 - smoothstep(0.0, rad, length(p - ctr))) * tw * step(0.45, h21(c + seed + 13.0));
  }
  return s;
}

// Mắt/miệng: thấu kính sáng, cong miệng, nghiêng theo đầu
vec3 matMat(vec2 q, float rx, float ry, float slant, float arch, float alpha, float glowR, vec3 mau){
  float c = cos(slant), s = sin(slant);
  vec2 r = vec2(c * q.x + s * q.y, -s * q.x + c * q.y);
  r.y += arch * r.x * r.x / max(rx, 1.0);
  float d2 = length(vec2(r.x / max(rx, 0.4), r.y / max(ry, 0.35)));
  float m = (1.0 - smoothstep(0.68, 1.0, d2)) * alpha;
  float halo = exp(-length(q) / max(glowR, 1.0)) * 0.20 * alpha;
  return mau * (m * 1.5 + halo);
}

// Thân nhân vật: tô đen sâu, viền sáng theo nguồn sáng lạ và theo trăng, lớp sáng mỏng bên trong
vec3 lopNguoi(vec3 col, vec2 P, float d, vec2 n, vec3 mau, vec3 vien){
  float ins = 1.0 - smoothstep(-0.9, 1.0, d);
  col = mix(col, mau, ins);
  float edge = exp(min(d, 0.0) / 1.8) * (1.0 - smoothstep(0.0, 2.2, d));
  vec2 Ld = normalize(uLight - P);
  float facing = max(dot(n, Ld), 0.0);
  float att = 1.0 / (1.0 + pow(length(uLight - P) / (900.0 * uPx / 420.0), 2.0));
  float rimL = pow(facing, 1.4) * min(uL, 1.3) * att;
  float rimM = pow(max(dot(n, normalize(vec2(0.6, -0.8))), 0.0), 1.6) * 0.70;
  col += (vien * rimL * 1.7 + MOON * (rimM + 0.05)) * edge;
  col += vec3(0.010, 0.016, 0.022) * ins * (0.55 + 0.45 * facing);
  return col;
}

vec3 lopMat(vec3 col, vec2 P, vec4 ep, vec4 es, vec2 ek, vec4 mp, vec4 ms, vec2 mk, vec3 mc){
  vec3 m = matMat(P - ep.xy, es.x, es.y, es.z, ek.x, es.w, ek.y, mc);
  m += matMat(P - ep.zw, es.x, es.y, es.z, ek.x, es.w, ek.y, mc);
  m += matMat(P - mp.xy, mp.z, mp.w, ms.x, mk.x, ms.y, mk.y, mc * 0.55);
  return col + m;
}

void main(){
  vec2 P = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) + uShake;
  float yy = P.y / uRes.y;
  float wpx = (P.x - uRes.x * 0.5) / uPx;
  float soft = max(0.55, 1.0 * uNet);

  // ---- trời và mặt đất ướt ----
  vec3 col = mix(vec3(0.020, 0.031, 0.048), vec3(0.135, 0.180, 0.215), smoothstep(0.0, 0.70, yy));
  col += vec3(0.20, 0.28, 0.35) * 0.36 * exp(-length((P - vec2(0.34 * uRes.x, 0.07 * uRes.y)) / vec2(0.27 * uRes.x, 0.24 * uRes.y)));
  float gmat = smoothstep(uGround - 1.5 * uNet, uGround + 1.5 * uNet, P.y);
  vec3 gcol = mix(vec3(0.100, 0.135, 0.165), vec3(0.014, 0.019, 0.026), smoothstep(uGround, uGround + 0.30 * uRes.y, P.y));
  col = mix(col, gcol, gmat);

  // ---- rừng xa ----
  float baseXa = uGround - (uGround - uRes.y * 0.5) * 0.28;
  float wxXa = wpx + uCamX * 0.30;
  float wyXa = (baseXa - P.y) / uPx;
  float mx = cay(wxXa, wyXa, 0.40, 0.028, 0.072, 1.0, soft) + canh(wxXa, wyXa, 0.40, 1.0, soft);
  col = mix(col, vec3(0.026, 0.042, 0.058), clamp(mx, 0.0, 1.0) * 0.92);
  float hw = 0.35 + 0.65 * smoothstep(0.0, uGround, P.y);
  float f1 = fbm(vec2(wxXa * 1.2, wyXa * 1.1 + 0.3) + vec2(uT * 0.02, 0.0));
  col = mix(col, FOG * 1.45, smoothstep(0.33, 0.78, f1) * 0.58 * hw);

  // ---- rừng giữa ----
  float baseGiua = uGround - (uGround - uRes.y * 0.5) * 0.13;
  float wxGiua = wpx + uCamX * 0.62;
  float wyGiua = (baseGiua - P.y) / uPx;
  float mm = cay(wxGiua, wyGiua, 0.62, 0.055, 0.115, 2.0, soft) + canh(wxGiua, wyGiua, 0.62, 2.0, soft);
  col = mix(col, vec3(0.011, 0.018, 0.027), clamp(mm, 0.0, 1.0) * 0.95);
  float f2 = fbm(vec2(wxGiua * 1.35, wyGiua * 1.35) + vec2(-uT * 0.03, 5.0));
  col = mix(col, FOG * 1.15, smoothstep(0.38, 0.80, f2) * 0.52 * hw);

  // ---- ánh sáng lạ: quầng, tia xuyên sương (bị cây và bóng cao che) ----
  if (uL > 0.002){
    vec2 toL = uLight - P;
    float rr = length(toL / vec2(1.0, 1.2)) / max(uPx / 420.0, 0.05);
    vec3 halo = uVien * (exp(-rr / 9.0) * 2.2 + exp(-rr / 65.0) * 0.50 + exp(-rr / 330.0) * 0.28);
    float occ = 0.0;
    float jit = h21(gl_FragCoord.xy * 0.37 + 3.0);
    for (int i = 0; i < 10; i++){
      vec2 qq = mix(P, uLight, (float(i) + jit) / 10.0);
      float wxq = (qq.x - uRes.x * 0.5) / uPx;
      float tmg = cay(wxq + uCamX * 0.62, (baseGiua - qq.y) / uPx, 0.62, 0.055, 0.115, 2.0, soft);
      float txf = cay(wxq + uCamX * 0.30, (baseXa - qq.y) / uPx, 0.40, 0.028, 0.072, 1.0, soft);
      float bh = 1.0 - smoothstep(-3.0, 4.0, sdBong(qq));
      occ += (1.0 - tmg) * (1.0 - txf * 0.6) * (1.0 - bh);
    }
    occ /= 10.0;
    vec2 dir = toL / max(length(toL), 1.0);
    float streak = 0.55 + 0.9 * vn(dir * 7.0 + 3.1);
    float fogRay = 0.35 + 1.5 * fbm(vec2(wxXa * 1.8, wyXa * 1.8) + vec2(uT * 0.03, 9.0));
    float fall = exp(-length(toL) / (620.0 * uPx / 420.0));
    vec3 rays = uVien * occ * fall * streak * fogRay * 0.80;
    col += (halo * mix(0.50, 1.0, occ) + rays) * uL;
    col += uVien * uL * 0.22 * exp(-abs(P.x - uLight.x) / (38.0 * uPx / 420.0)) * exp(-max(P.y - uGround, 0.0) / (120.0 * uPx / 420.0)) * step(uGround, P.y);
  }

  // ---- bụi bay lớp xa ----
  {
    float mo = motes(vec2(wpx + uCamX * 1.6, (uGround - P.y) / uPx + 0.3), 0.17, 3.0, 0.006);
    float lit = 0.14 + uL * 1.3 * exp(-length(uLight - P) / 650.0);
    col += mix(MOON, uVien, clamp(uL, 0.0, 1.0) * 0.7) * mo * lit * 0.85;
  }

  // ---- kết vui: sương bừng sáng (chỉ nền, để bóng vẫn đen) ----
  col += uSang * vec3(0.10, 0.13, 0.15) * smoothstep(0.15, 0.85, yy);

  // ---- bóng cao (thứ lạ) ----
  if (uBong.w > 0.01){
    float db = sdBong(P);
    float inB = 1.0 - smoothstep(-1.0, 1.2, db);
    col = mix(col, uMau2, inB * uBong.w);
    vec2 nB = normalize(vec2(sdBong(P + vec2(1.6, 0.0)) - sdBong(P - vec2(1.6, 0.0)),
                             sdBong(P + vec2(0.0, 1.6)) - sdBong(P - vec2(0.0, 1.6))) + 1e-5);
    float edgeB = exp(min(db, 0.0) / 1.3) * (1.0 - smoothstep(0.0, 1.6, db));
    float fB = max(dot(nB, normalize(uLight - P)), 0.0);
    col += (uVien * pow(fB, 1.6) * 0.9 + MOON * 0.30) * edgeB * uBong.w;
    float re = uBongE.z;
    float gl = exp(-length(P - vec2(uBongE.x - 0.55 * re, uBongE.y)) / (0.11 * re)) * 2.2
             + exp(-length(P - vec2(uBongE.x + 0.55 * re, uBongE.y)) / (0.11 * re)) * 2.2
             + exp(-length(P - vec2(uBongE.x - 0.55 * re, uBongE.y)) / (0.40 * re)) * 0.22
             + exp(-length(P - vec2(uBongE.x + 0.55 * re, uBongE.y)) / (0.40 * re)) * 0.22;
    col += uMat2 * gl * uBong.w;
  }

  // ---- phản chiếu trên nền ướt ----
  float d = sdThan(P);
  {
    float wob = 0.35 * uPx / 420.0 * sin((P.y - uGround) * 0.09 + uT * 2.0);
    float dm = sdThan(vec2(P.x + wob, 2.0 * uGround - P.y));
    float refl = (1.0 - smoothstep(-1.0, 2.0, dm)) * step(uGround, P.y) * 0.50 * exp(-(P.y - uGround) / (0.12 * uPx));
    col = mix(col, vec3(0.004, 0.006, 0.009), refl);
  }

  // ---- nhân vật phụ rồi nhân vật chính ----
  if (uCoPhu > 0.01){
    float d2 = sdPhu(P);
    vec2 n2 = vec2(0.0);
    if (d2 < 6.0) n2 = normalize(vec2(sdPhu(P + vec2(1.6, 0.0)) - sdPhu(P - vec2(1.6, 0.0)),
                                      sdPhu(P + vec2(0.0, 1.6)) - sdPhu(P - vec2(0.0, 1.6))) + 1e-5);
    col = lopNguoi(col, P, d2, n2, uMau2, uVien2);
    col = lopMat(col, P, uEye2P, uEye2S, uEye2K, uMom2P, uMom2S, uMom2K, uMat2);
  }
  {
    vec2 n = vec2(0.0);
    if (d < 6.0) n = normalize(vec2(sdThan(P + vec2(1.6, 0.0)) - sdThan(P - vec2(1.6, 0.0)),
                                    sdThan(P + vec2(0.0, 1.6)) - sdThan(P - vec2(0.0, 1.6))) + 1e-5);
    col = lopNguoi(col, P, d, n, uMau, uVien);
    col = lopMat(col, P, uEyeP, uEyeS, uEyeK, uMomP, uMomS, uMomK, uMatC);
  }

  // ---- sương quấn mặt đất ----
  float hb = (uGround - P.y) / uPx;
  float f3 = fbm(vec2(wpx * 1.3, hb * 3.0) + vec2(uT * 0.05, 2.0));
  float d3 = smoothstep(0.38, 0.80, f3) * smoothstep(-0.06, 0.10, hb) * (1.0 - 0.55 * smoothstep(0.18, 0.62, hb)) * 0.62;
  col = mix(col, FOG * 1.10 + uVien * uL * 0.08 * exp(-length(uLight - P) / 900.0), d3);

  // ---- cây gần (khung trái) ----
  {
    float wxGan = wpx + uCamX * 2.0;
    float wyGan = (uGround + 0.35 * uPx - P.y) / uPx;
    float mn = cay(wxGan, wyGan, 1.7, 0.16, 0.34, 5.0, soft) * (1.0 - smoothstep(0.13 * uRes.x, 0.25 * uRes.x, P.x));
    col = mix(col, vec3(0.005, 0.008, 0.012), clamp(mn, 0.0, 1.0) * 0.92);
  }

  // ---- bụi bay lớp gần ----
  {
    float mo = motes(vec2(wpx + uCamX * 1.2, (uGround - P.y) / uPx), 0.50, 11.0, 0.020);
    col += mix(MOON, uVien, clamp(uL, 0.0, 1.0) * 0.6) * mo * (0.05 + uL * 0.30 * exp(-length(uLight - P) / 900.0));
  }

  // ---- viền tối, hạt nhiễu ----
  vec2 vq = (gl_FragCoord.xy - uRes * 0.5) / min(uRes.x, uRes.y);
  col *= mix(1.0, 0.38, smoothstep(0.42, 1.02, length(vq)));
  col = 1.0 - exp(-max(col, 0.0) * 1.12);
  float hat = h21(gl_FragCoord.xy / uHat + floor(uT * 30.0) * 17.3) - 0.5;
  float lun = dot(col, vec3(0.299, 0.587, 0.114));
  col += hat * (0.010 + 0.010 * (1.0 - lun)) + (h21(gl_FragCoord.xy + 7.0) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`

  scene.add(new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false }),
  ))

  // ---- Bảng dáng mặt: rx, ry tính theo bán kính đầu; arch = độ cong mi; a = độ sáng ----
  const MAT = {
    thuong: { rx: 0.155, ry: 0.150, slant: 0.06, arch: 0.00, a: 1.00 },
    lieng: { rx: 0.165, ry: 0.130, slant: 0.20, arch: 0.00, a: 1.00 },
    'mo-to': { rx: 0.185, ry: 0.200, slant: 0.05, arch: 0.00, a: 1.15 },
    so: { rx: 0.195, ry: 0.215, slant: 0.02, arch: 0.00, a: 1.20 },
    vui: { rx: 0.190, ry: 0.120, slant: 0.04, arch: 0.35, a: 1.15 },
    ngai: { rx: 0.150, ry: 0.120, slant: 0.14, arch: 0.10, a: 0.95 },
    buon: { rx: 0.160, ry: 0.130, slant: -0.12, arch: -0.25, a: 0.85 },
    nham: { rx: 0.200, ry: 0.020, slant: 0.05, arch: 0.10, a: 0.75 },
    gian: { rx: 0.190, ry: 0.100, slant: 0.24, arch: -0.20, a: 1.20 },
  }
  const MIENG = {
    dong: { rx: 0, ry: 0, arch: 0, a: 0 },
    noi: { rx: 0.150, ry: 0.060, arch: 0.10, a: 0.90 },
    o: { rx: 0.130, ry: 0.190, arch: 0.00, a: 1.00 },
    het: { rx: 0.190, ry: 0.280, arch: 0.00, a: 1.10 },
    run: { rx: 0.150, ry: 0.100, arch: -0.10, a: 0.90 },
    cuoi: { rx: 0.300, ry: 0.050, arch: 0.55, a: 1.15 },
    'cuoi-guong': { rx: 0.240, ry: 0.050, arch: 0.40, a: 1.00 },
    buon: { rx: 0.190, ry: 0.045, arch: -0.45, a: 0.85 },
    gam: { rx: 0.280, ry: 0.035, arch: 0.15, a: 0.80 },
  }
  // Dáng nhân vật phụ: quái thì cao gầy đầu nhỏ mũ dài, thú thì lùn bè, người/vệ binh gần chuẩn
  const DANG = {
    nguoi: { ngang: 1.00, cao: 1.00, day: 1.00, dau: 1.00, mu: 1.00 },
    quai: { ngang: 0.84, cao: 1.14, day: 0.82, dau: 0.78, mu: 1.35 },
    thu: { ngang: 1.16, cao: 0.84, day: 1.18, dau: 1.20, mu: 0.55 },
    robot: { ngang: 1.08, cao: 1.02, day: 1.06, dau: 0.94, mu: 0.80 },
    vien: { ngang: 0.92, cao: 1.06, day: 0.92, dau: 0.98, mu: 1.10 },
  }

  const t2 = v => Math.max(-1, Math.min(1, v))
  // Trung bình dáng mặt trong 0,1 giây để khỏi giật khi đổi cảm xúc
  function dangMat(T, ai) {
    const E = { rx: 0, ry: 0, slant: 0, arch: 0, a: 0 }, M = { rx: 0, ry: 0, arch: 0, a: 0 }
    let n = 0
    for (let i = 0; i < 3; i++) {
      const q = dx.tuThe(Math.max(0, T - i * 0.045), ai)
      if (!q) break
      const a = MAT[q.mat] || MAT.thuong, b = MIENG[q.mieng] || MIENG.dong
      const chop = q.chop && q.mat !== 'nham'
      const pha = chop ? 0.55 : 1
      const ryM = q.mieng === 'noi' ? 0.02 + 0.16 * t2(q.mieng_mo || 0) : b.ry
      E.rx += a.rx; E.ry += chop ? a.ry * 0.1 : a.ry; E.slant += a.slant; E.arch += a.arch; E.a += a.a * pha
      M.rx += b.rx; M.ry += chop ? ryM * 0.1 : ryM; M.arch += b.arch; M.a += b.a * pha
      n++
    }
    if (!n) return { e: { ...MAT.thuong }, m: { ...MIENG.dong } }
    for (const k of ['rx', 'ry', 'slant', 'arch', 'a']) E[k] /= n
    for (const k of ['rx', 'ry', 'arch', 'a']) M[k] /= n
    return { e: E, m: M }
  }

  // Ghi 15 khúc vào bộ đồng phục A/R (chính) hoặc B/RB (phụ); trả tâm đầu để đặt mắt
  function datBong(p, k, dp, s, S, sw, phu) {
    const A = phu ? U.uB.value : U.uA.value
    const RA = phu ? U.uRB.value : U.uRA.value
    const put = (i, a, b, r1, r2) => { A[i].set(a[0], a[1], b[0], b[1]); RA[i].set(r1, r2) }
    // dáng riêng: kéo cao/thấp và bề ngang quanh chỗ đứng, chân vẫn chạm đất
    const T = pt => [p.x + (pt[0] - p.x) * dp.ngang, pt[1] * dp.cao]
    const S2 = pt => S(T(pt))
    const hip = S2(k.hong), vai = S2(k.vai), co = S2(k.coGoc), dau = S2(k.dau)
    const R = v => v * s * dp.day
    const cy = k.ngang
    const back = -cy
    const g = k.gocDau * 0.7
    const rot = (pt, c) => {
      const dxa = pt[0] - c[0], dya = pt[1] - c[1], cs = Math.cos(g), sn = Math.sin(g)
      return [c[0] + dxa * cs - dya * sn, c[1] + dxa * sn + dya * cs]
    }
    put(0, hip, vai, R(0.064), R(0.076))
    put(1, hip, [hip[0] + sw * s, hip[1] + 0.152 * s], R(0.066), R(0.046))
    put(2, co, dau, R(0.026), R(0.024))
    put(3, S2(k.vaiP), S2(k.khuyuP), R(0.021), R(0.019))
    put(4, S2(k.khuyuP), S2(k.banP), R(0.018), R(0.020))
    put(5, S2(k.vaiT), S2(k.khuyuT), R(0.019), R(0.017))
    put(6, S2(k.khuyuT), S2(k.banT), R(0.016), R(0.018))
    put(7, S2(k.hongP), S2(k.goiP), R(0.035), R(0.024))
    put(8, S2(k.goiP), S2(k.coChanP), R(0.024), R(0.018))
    put(9, S2(k.hongT), S2(k.goiT), R(0.033), R(0.022))
    put(10, S2(k.goiT), S2(k.coChanT), R(0.022), R(0.016))
    const cP = S2(k.coChanP), cT = S2(k.coChanT)
    put(11, cP, [cP[0] + cy * 0.057 * s, cP[1] + 0.019 * s], R(0.017), R(0.012))
    put(12, cT, [cT[0] + cy * 0.055 * s, cT[1] + 0.017 * s], R(0.015), R(0.011))
    const mu = (dp.mu || 1) * (0.35 + 0.65 * Math.abs(cy)) // nhìn thẳng máy thì mũ cụp vào sau đầu
    put(13, rot([dau[0] + back * 0.050 * s * mu, dau[1] - 0.052 * s * mu], dau),
      rot([dau[0] + back * 0.185 * s * mu + sw * 0.7 * s, dau[1] + 0.020 * s * mu], dau), R(0.042), R(0.006))
    put(14, dau, dau, R(0.095 * dp.dau), R(0.095 * dp.dau))
    return { dau, headR: 0.095 * dp.dau * s, cy, g: k.gocDau }
  }

  // Đặt mắt và miệng theo dáng mặt + hướng nhìn + nghiêng đầu
  function datMat(head, p, dm, phu) {
    const EP = phu ? U.uEye2P.value : U.uEyeP.value
    const ES = phu ? U.uEye2S.value : U.uEyeS.value
    const EK = phu ? U.uEye2K.value : U.uEyeK.value
    const MP = phu ? U.uMom2P.value : U.uMomP.value
    const MS = phu ? U.uMom2S.value : U.uMomS.value
    const MK = phu ? U.uMom2K.value : U.uMomK.value
    const R = head.headR
    const a = head.g * 0.9
    const ax = [Math.cos(a), Math.sin(a)]
    const fw = head.cy * (0.20 + 0.16 * t2(p.nhin)) * R
    const fx = head.dau[0] + ax[0] * fw, fy = head.dau[1] + ax[1] * fw
    const sp = R * (0.18 + 0.22 * head.chinhDien)
    EP.set(fx + ax[0] * sp, fy + ax[1] * sp, fx - ax[0] * sp, fy - ax[1] * sp)
    ES.set(Math.max(1, dm.e.rx * R), Math.max(0.7, dm.e.ry * R), a + dm.e.slant, dm.e.a)
    EK.set(dm.e.arch, 0.30 * R)
    const mx = fx - Math.sin(head.g) * 0.52 * R, my = fy + Math.cos(head.g) * 0.52 * R
    MP.set(mx, my, Math.max(0.5, dm.m.rx * R), Math.max(0.5, dm.m.ry * R))
    MS.set(a, dm.m.a)
    MK.set(dm.m.arch, 0.26 * R)
  }

  // Vận tốc ngang của nhân vật, dùng cho vạt áo
  function vanToc(T, ai) {
    const a = dx.tuThe(Math.max(0, T - 0.04), ai), b = dx.tuThe(Math.min(Tmax, T + 0.04), ai)
    return a && b ? (b.x - a.x) / 0.08 : 0
  }

  return {
    ve(T) {
      T = Math.max(0, Math.min(Tmax, T))
      const p = dx.tuThe(T)
      const k = dx.khung2D(p)
      const m = dx.may(T) // máy do bộ dựng diễn xuất quyết định, không tự nhích
      const s = H / m.cao
      const ground = dx.raMan([0, 0], m)[1]
      const sk = dx.suKien(T)

      U.uT.value = T
      U.uPx.value = s
      U.uCamX.value = m.tam[0]
      U.uGround.value = ground
      U.uSang.value = sk.sang
      // rung khung: tất định theo T, đổi hướng nhanh
      const rung = sk.rung * 6 * Math.max(0.6, NET)
      U.uShake.value.set(rung * Math.sin(T * 131.7), rung * Math.cos(T * 97.3))

      // ---- nhân vật chính ----
      const S = pt => dx.raMan(pt, m)
      const sw = Math.max(-0.08, Math.min(0.08, -vanToc(T, 'chinh') * 0.12))
      const dp = DANG[(kb.nhan_vat && kb.nhan_vat.dang) || 'nguoi'] || DANG.nguoi
      const head = datBong(p, k, dp, s, S, sw, false)
      head.chinhDien = k.chinhDien
      datMat(head, p, dangMat(T, 'chinh'), false)

      // ---- nhân vật phụ ----
      if (nv2) {
        const p2 = dx.tuThe(T, 'phu')
        U.uCoPhu.value = p2 ? 1 : 0
        if (p2) {
          const k2 = dx.khung2D(p2)
          const sw2 = Math.max(-0.08, Math.min(0.08, -vanToc(T, 'phu') * 0.12))
          const dp2 = DANG[nv2.dang || 'nguoi'] || DANG.nguoi
          const head2 = datBong(p2, k2, dp2, s, S, sw2, true)
          head2.chinhDien = k2.chinhDien
          datMat(head2, p2, dangMat(T, 'phu'), true)
        }
      } else U.uCoPhu.value = 0

      // ---- bóng cao: đứng ở toạ độ thế giới dx.hienX, cao 1,6 lần nhân vật nên to lên khi máy tiến ----
      const chan = dx.raMan([dx.hienX(T), 0], m)
      // chặn chiều cao để đầu và mắt đỏ còn trong khung; khung dọc chừa chỗ cho phụ đề ở trên
      const chua = H * (H > W ? 0.30 : 0.10)
      const hB = Math.max(H * 0.3, Math.min(1.6 * s, chan[1] - chua))
      const baseY = chan[1]
      const crownY = baseY - hB
      const hien = sk.hien
      U.uBong.value.set(chan[0], baseY, crownY, hien)
      U.uBongE.value.set(chan[0], crownY + 0.075 * hB, 0.058 * hB)
      // nguồn sáng lạ nằm sau vai bóng cao, lệch phải để bóng được viền chứ không bị nuốt
      U.uL.value = hien * (1.25 + 0.55 * sk.sang) * (1 + 0.03 * Math.sin(T * 23) + 0.02 * Math.sin(T * 37.3))
      U.uLight.value.set(Math.min(chan[0] + W * 0.09, W * 0.955), crownY - H * 0.02)

      r.render(scene, cam)
    },
  }
}
