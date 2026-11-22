// Bộ vẽ WebGL2: một lưới, vẽ lặp theo instancing, bóng đổ, bóng khe cho lưới vuông.
import { SO, mau, HINH } from './chung.js'
import { KIEU, GLSL } from './chat-lieu.js'

const DAU = '#version 300 es\nprecision highp float;precision highp int;precision highp sampler2DShadow;precision highp sampler3D;\n'

const DINH = `
layout(location=0) in vec3 p;
layout(location=1) in vec3 n;
layout(location=2) in vec3 goc;
layout(location=3) in vec4 vt;
layout(location=4) in vec4 cs;
layout(location=5) in vec4 cm;
layout(location=6) in vec4 ex;
uniform mat4 vp, mt;
uniform int bo_tron;
out vec3 P, N, L, NL, Mau;
out vec4 S;
flat out vec3 Co;
flat out vec4 Ex;
flat out float Chat;
void main(){
  vec3 q = p * cs.xyz;
  if (bo_tron == 1) {
    float r = min(ex.x, .5 * min(cs.x, min(cs.y, cs.z)));
    q = goc * (cs.xyz * .5 - r) + n * r;
  }
  float a = cos(cs.w), b = sin(cs.w), c = cos(vt.w), d = sin(vt.w);
  mat3 rx = mat3(1.,0.,0., 0.,a,b, 0.,-b,a);
  mat3 ry = mat3(c,0.,-d, 0.,1.,0., d,0.,c);
  P = vt.xyz + ry * (rx * q);
  N = ry * (rx * n);
  L = q; NL = n; Co = cs.xyz; Mau = cm.rgb; Chat = cm.w; Ex = ex;
  S = mt * vec4(P, 1.);
  gl_Position = vp * vec4(P, 1.);
}`

const MANH = `
in vec3 P, N, L, NL, Mau;
in vec4 S;
flat in vec3 Co;
flat in vec4 Ex;
flat in float Chat;
uniform sampler2DShadow bong;
uniform sampler3D khe;
uniform vec3 mat_may, nang, troi, khe_goc, khe_co;
uniform float gio, dem;
uniform vec4 toa; // đèn kể chuyện: xyz là chỗ đèn, w 0 không dùng, 1 còn tắt, 2 đã bật
uniform vec2 suong;
out vec4 ra;
float bam(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
${GLSL}
void main(){
  vec3 n = normalize(N), c = Mau;
  float ao = 1., bd = 0.;
  if (kieu >= 2) c = vanThem(c);
  if (kieu == 0) {
    vec3 a = abs(NL), q = L + Co * .5;
    vec2 uv = a.x > .5 ? q.zy : a.y > .5 ? q.xz : q.xy;
    vec2 o = floor(uv * 8.);
    float mat_so = dot(NL, vec3(1., 2., 3.)) + 4., h = bam(vec3(o + Ex.z * 97., mat_so + Chat * 11.)), k = 1.;
    int m = int(Chat + .5);
    if (m == 1) k = h < .18 ? .84 : h > .88 ? 1.12 : .95 + h * .07;
    else if (m == 2) {
      float vet = bam(vec3(floor(o.x / 3.), o.y, Ex.z * 50. + mat_so));
      k = vet < .22 ? .78 : vet > .85 ? 1.13 : .93 + h * .1;
    } else if (m == 3) {
      float hang = floor(o.y / 4.);
      bool vua = mod(o.y, 4.) < 1. || mod(o.x + hang * 4., 8.) < 1.;
      k = vua ? .72 : .95 + h * .09;
    } else if (m == 4) k = mod(o.x, 4.) < 1. ? .74 : .9 + bam(vec3(o.x, floor(o.y / 3.), Ex.z)) * .16;
    else if (m == 5) k = h < .25 ? .72 : h > .8 ? 1.16 : .98;
    else if (m == 6) {
      vec2 w = floor(P.xz * 4.);
      k = mod(w.x + floor(gio * 3.) + floor(sin(w.y * .8) * 3.), 11.) < 2. ? 1.25 : .97;
    } else if (m == 7) k = .93 + bam(vec3(floor(uv * 10.), mat_so)) * .1;
    c *= k;
    vec3 v = (P + n * .45 - khe_goc) / khe_co;
    ao = 1. - texture(khe, v).r * .62;
  }
  vec3 s = S.xyz / S.w * .5 + .5;
  if (any(lessThan(s, vec3(0.))) || any(greaterThan(s, vec3(1.)))) bd = 1.;
  else {
    for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) bd += texture(bong, vec3(s.xy + vec2(i, j) / 3072., s.z - .0011));
    bd /= 9.;
  }
  float huong = kieu != 0 ? .8 + .2 * n.y : (abs(n.y) > .5 ? 1. : abs(n.x) > .5 ? .78 : .88);
  vec3 nen = mix(vec3(.58, .62, .72), troi, .25) * huong * mix(1., 1.12, dem);
  vec3 sang = c * ao * (nen + vec3(.72, .64, .52) * max(dot(n, nang), 0.) * bd);
  if (kieu == 1) {
    vec3 may = normalize(mat_may - P);
    sang += vec3(.38) * pow(max(dot(n, normalize(nang + may)), 0.), 48.) * bd;
    sang += c * pow(1. - max(dot(n, may), 0.), 3.) * .2;
  }
  if (kieu >= 2) sang = sangThem(c, n, bd);
  if (toa.w > 1.5) sang += c * vec3(1., .64, .25) * .8 * (1. - smoothstep(6., 24., length(P - toa.xyz)));
  else if (toa.w > .5) sang *= vec3(.7, .76, .92);
  sang = mix(sang, c * 1.1, min(Ex.y, 1.));
  ra = vec4(mix(sang, troi, smoothstep(suong.x, suong.y, length(P - mat_may)) * (kieu == 3 ? .97 : .85) * clamp(2. - max(Ex.y, 1.), 0., 1.)), 1.);
}`

const NEN_D = `out float h;
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); h = p.y; gl_Position = vec4(p * 2. - 1., .999999, 1.); }`
const NEN_M = `in float h; uniform vec3 duoi, tren; out vec4 ra;
void main(){ ra = vec4(mix(duoi, tren, smoothstep(.2, .98, h)), 1.); }`

// Khối vuông: pháp tuyến phẳng. Khối bo: cầu tách 8 phần, giãn ra theo cỡ vật.
function luoi(bo) {
  const d = [], chia = bo ? 3 : 1
  const moc = []
  for (let i = -chia; i <= 0; i++) moc.push([i / chia, -1])
  for (let i = 0; i <= chia; i++) moc.push([i / chia, 1])
  const canh = bo ? moc : [[-1, -1], [1, 1]]
  for (let ax = 0; ax < 3; ax++) for (const s of [-1, 1]) for (let i = 0; i < canh.length - 1; i++) for (let j = 0; j < canh.length - 1; j++) {
    const dinh = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]]
    for (const k of (s > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2])) {
      const [u, v] = [canh[dinh[k][0]], canh[dinh[k][1]]], p = [], g = [], n = [0, 0, 0]
      p[ax] = s; p[(ax + 1) % 3] = u[0]; p[(ax + 2) % 3] = v[0]
      g[ax] = s; g[(ax + 1) % 3] = u[1]; g[(ax + 2) % 3] = v[1]
      n[ax] = s
      const dai = Math.hypot(...p)
      d.push(...p.map(a => a / 2), ...(bo ? p.map(a => a / dai) : n), ...g)
    }
  }
  return new Float32Array(d)
}

const tru = (a, b) => a.map((v, i) => v - b[i])

// Nón, trụ sáu cạnh và đá hai mươi mặt: pháp tuyến phẳng cho ra chất low-poly.
function luoiGoc(hinh) {
  const d = []
  const tam = (a, b, c) => {
    let n = chuan(cheo(tru(b, a), tru(c, a)))
    const giua = a.map((v, i) => (v + b[i] + c[i]) / 3)
    if (cham(n, giua) < 0) { n = n.map(v => -v); [b, c] = [c, b] }
    for (const p of [a, b, c]) d.push(...p, ...n, 0, 0, 0)
  }
  if (hinh === HINH.da) {
    const t = (1 + Math.sqrt(5)) / 2
    const v = [[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(p => p.map(u => u / (2 * t)))
    const m = [[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]]
    for (const q of m) tam(...q.map(i => v[i]))
    return new Float32Array(d)
  }
  const canh = hinh === HINH.non ? 4 + 2 : 6
  for (let i = 0; i < canh; i++) {
    const [a, b] = [i, i + 1].map(k => [Math.cos(k / canh * Math.PI * 2) / 2, Math.sin(k / canh * Math.PI * 2) / 2])
    const A = [a[0], -.5, a[1]], B = [b[0], -.5, b[1]], C = [b[0], .5, b[1]], D = [a[0], .5, a[1]]
    tam([0, -.5, 0], A, B)
    if (hinh === HINH.non) tam(A, B, [0, .5, 0])
    else { tam(A, B, C); tam(A, C, D); tam([0, .5, 0], C, D) }
  }
  return new Float32Array(d)
}
const cham = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0)
const chuan = a => { const l = Math.hypot(...a); return a.map(v => v / l) }
const cheo = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
function nhinVe(e, t) {
  const z = chuan(tru(e, t)), x = chuan(cheo([0, 1, 0], z)), y = cheo(z, x)
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -cham(x, e), -cham(y, e), -cham(z, e), 1]
}
const nhan = (a, b) => b.map((_, i) => { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + i % 4] * b[(i >> 2) * 4 + k]; return s })

export function taoBoVe(canvas, pc, bc, tinh, toiTroi) {
  const g = canvas.getContext('webgl2', { antialias: !pc.hau?.diem_anh })
  if (!g) throw new Error('Trình duyệt không mở được WebGL2')
  const ttGpu = g.getExtension('WEBGL_debug_renderer_info')
  const gpu = ttGpu ? g.getParameter(ttGpu.UNMASKED_RENDERER_WEBGL) : 'không rõ'

  function ct(v, f) {
    const p = g.createProgram(), vitri = {}
    for (const [loai, nguon] of [[g.VERTEX_SHADER, v], [g.FRAGMENT_SHADER, f]]) {
      const s = g.createShader(loai)
      g.shaderSource(s, DAU + nguon); g.compileShader(s)
      if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s))
      g.attachShader(p, s)
    }
    g.linkProgram(p)
    if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p))
    return { p, u: ten => (ten in vitri ? vitri[ten] : (vitri[ten] = g.getUniformLocation(p, ten))) }
  }
  const chinh = ct(DINH, MANH), doBong = ct(DINH, 'void main(){}'), nen = ct(NEN_D, NEN_M)

  // Mỗi hình một lưới, mỗi lưới một lô tĩnh và một lô động.
  const coKhe = pc.luoi === 'vuong', kieu = KIEU[pc.kieu]
  const macDinh = pc.luoi === 'tron' || pc.hinh === 'bo' ? HINH.bo : HINH.hop
  const cacHinh = [HINH.hop, HINH.bo, HINH.non, HINH.tru, HINH.da]
  function boLo() {
    const lo = cacHinh.map(hinh => {
      const dl = hinh === HINH.hop || hinh === HINH.bo ? luoi(hinh === HINH.bo) : luoiGoc(hinh)
      const bd = g.createBuffer(), va = g.createVertexArray(), b = g.createBuffer()
      g.bindVertexArray(va)
      g.bindBuffer(g.ARRAY_BUFFER, bd); g.bufferData(g.ARRAY_BUFFER, dl, g.STATIC_DRAW)
      for (let i = 0; i < 3; i++) { g.enableVertexAttribArray(i); g.vertexAttribPointer(i, 3, g.FLOAT, false, 36, i * 12) }
      g.bindBuffer(g.ARRAY_BUFFER, b)
      for (let i = 0; i < 4; i++) {
        g.enableVertexAttribArray(i + 3); g.vertexAttribPointer(i + 3, 4, g.FLOAT, false, SO * 4, i * 16); g.vertexAttribDivisor(i + 3, 1)
      }
      return { hinh, va, b, soDinh: dl.length / 9, n: 0 }
    })
    lo.dat = d => {
      const dem = lo.map(() => 0)
      for (let i = 0; i < d.length; i += SO) dem[(d[i + 15] || macDinh) - 1]++
      const phan = dem.map(n => new Float32Array(n * SO)), vt = lo.map(() => 0)
      for (let i = 0; i < d.length; i += SO) {
        const k = (d[i + 15] || macDinh) - 1
        phan[k].set(d.subarray(i, i + SO), vt[k]); vt[k] += SO
      }
      lo.forEach((l, k) => {
        l.n = dem[k]
        if (l.n) { g.bindBuffer(g.ARRAY_BUFFER, l.b); g.bufferData(g.ARRAY_BUFFER, phan[k], g.DYNAMIC_DRAW) }
      })
    }
    return lo
  }
  const loTinh = boLo(), loDong = boLo()
  loTinh.dat(tinh)

  const tb = g.createTexture()
  g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, tb)
  g.texImage2D(g.TEXTURE_2D, 0, g.DEPTH_COMPONENT24, 3072, 3072, 0, g.DEPTH_COMPONENT, g.UNSIGNED_INT, null)
  for (const [k, v] of [[g.TEXTURE_MIN_FILTER, g.LINEAR], [g.TEXTURE_MAG_FILTER, g.LINEAR], [g.TEXTURE_COMPARE_MODE, g.COMPARE_REF_TO_TEXTURE]]) g.texParameteri(g.TEXTURE_2D, k, v)
  const fb = g.createFramebuffer()
  g.bindFramebuffer(g.FRAMEBUFFER, fb)
  g.framebufferTexture2D(g.FRAMEBUFFER, g.DEPTH_ATTACHMENT, g.TEXTURE_2D, tb, 0)
  g.drawBuffers([g.NONE]); g.readBuffer(g.NONE)

  // Ô nào có khối: lấy mẫu mềm ra bóng ở khe và chân khối.
  const KG = [-40, -14, -50.5], KC = [86, 44, 76], o = new Uint8Array(KC[0] * KC[1] * KC[2])
  if (coKhe) for (let i = 0; i < tinh.length; i += SO) {
    if (tinh[i + 4] < 0.9) continue
    const [x, y, z] = [0, 1, 2].map(k => Math.floor(tinh[i + k] - KG[k]))
    if (x >= 0 && x < KC[0] && y >= 0 && y < KC[1] && z >= 0 && z < KC[2]) o[x + y * KC[0] + z * KC[0] * KC[1]] = 255
  }
  g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_3D, g.createTexture())
  g.pixelStorei(g.UNPACK_ALIGNMENT, 1)
  g.texImage3D(g.TEXTURE_3D, 0, g.R8, ...KC, 0, g.RED, g.UNSIGNED_BYTE, o)
  for (const k of [g.TEXTURE_MIN_FILTER, g.TEXTURE_MAG_FILTER]) g.texParameteri(g.TEXTURE_3D, k, g.LINEAR)
  for (const k of [g.TEXTURE_WRAP_S, g.TEXTURE_WRAP_T, g.TEXTURE_WRAP_R]) g.texParameteri(g.TEXTURE_3D, k, g.CLAMP_TO_EDGE)

  const nang = chuan([-0.45, 0.8, 0.5]), tam = [0, 0, -3]
  const chieu = [1 / 30, 0, 0, 0, 0, 1 / 30, 0, 0, 0, 0, -2 / 129, 0, 0, 0, -131 / 129, 1]
  const mtBong = nhan(chieu, nhinVe(nang.map((v, i) => v * 60 + tam[i]), tam))
  const troi = mau(bc.troi[0]), troiTren = mau(bc.troi[1]), vienA = mau(bc.nhan), vienB = mau(bc.nhan2)
  g.enable(g.DEPTH_TEST); g.enable(g.CULL_FACE); g.depthFunc(g.LEQUAL)

  function veHet(ct) {
    for (const l of [...loTinh, ...loDong]) {
      if (!l.n) continue
      g.uniform1i(ct.u('bo_tron'), +(l.hinh === HINH.bo))
      g.bindVertexArray(l.va); g.drawArraysInstanced(g.TRIANGLES, 0, l.soDinh, l.n)
    }
  }

  return {
    gpu,
    ve(k, gio) {
      const W = canvas.width, H = canvas.height
      const day = k.troi ? mau(k.troi[0]) : troi, dinhTroi = k.troi ? mau(k.troi[1]) : troiTren
      loDong.dat(k.ds)
      g.bindFramebuffer(g.FRAMEBUFFER, fb); g.viewport(0, 0, 3072, 3072); g.clear(g.DEPTH_BUFFER_BIT)
      g.useProgram(doBong.p)
      g.uniformMatrix4fv(doBong.u('vp'), false, mtBong)
      veHet(doBong)

      g.bindFramebuffer(g.FRAMEBUFFER, null); g.viewport(0, 0, W, H); g.clear(g.DEPTH_BUFFER_BIT | g.COLOR_BUFFER_BIT)
      const f = 1 / Math.tan(k.fov * Math.PI / 360), u = chinh.u
      g.useProgram(chinh.p)
      const chieuMay = k.cao
        ? [2 * H / (k.cao * W), 0, 0, 0, 0, 2 / k.cao, 0, 0, 0, 0, -2 / 170, 0, 0, 0, -1.001, 1]
        : [f * H / W, 0, 0, 0, 0, f, 0, 0, 0, 0, -1.002, -1, 0, 0, -0.2002, 0]
      g.uniformMatrix4fv(u('vp'), false, nhan(chieuMay, nhinVe(k.mat, k.nhin)))
      g.uniformMatrix4fv(u('mt'), false, mtBong)
      g.uniform1i(u('kieu'), kieu); g.uniform1i(u('bong'), 0); g.uniform1i(u('khe'), 1)
      const xaThem = kieu === 3 ? Math.max(0, Math.hypot(...tru(k.mat, k.nhin)) - 14) : 0
      g.uniform2fv(u('suong'), (k.suong || pc.suong || [30, 85]).map(v => v + xaThem)); g.uniform3fv(u('den_pin'), k.pin)
      g.uniform3fv(u('vien_a'), vienA); g.uniform3fv(u('vien_b'), vienB); g.uniform1f(u('nhip'), pc.giat ? Math.floor(gio * 6) % 4 : 0)
      g.uniform3fv(u('mat_may'), k.mat); g.uniform3fv(u('nang'), nang); g.uniform3fv(u('troi'), day)
      g.uniform3fv(u('khe_goc'), KG); g.uniform3fv(u('khe_co'), KC)
      g.uniform1f(u('gio'), gio); g.uniform1f(u('dem'), toiTroi && !k.sang ? 1 : 0)
      g.uniform4fv(u('toa'), k.toa)
      veHet(chinh)

      g.useProgram(nen.p)
      g.uniform3fv(nen.u('duoi'), day); g.uniform3fv(nen.u('tren'), dinhTroi)
      g.drawArrays(g.TRIANGLES, 0, 3)
    },
  }
}
