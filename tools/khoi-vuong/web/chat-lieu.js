// Vân và cách ăn sáng của tám phong cách thêm (GLSL).
// kieu: 0 sandbox, 1 nhựa, 2 phiêu lưu, 3 kinh dị, 4 neon, 5 điểm ảnh, 6 đất sét, 7 giấy, 8 len, 9 sa bàn.
export const KIEU = { 'sandbox': 0, 'nhua': 1, 'phieu-luu': 2, 'kinh-di': 3, 'neon': 4, 'diem-anh': 5, 'dat-set': 6, 'giay': 7, 'len': 8, 'sa-ban': 9 }

export const GLSL = `
uniform int kieu;
uniform vec3 vien_a, vien_b, den_pin;
uniform float nhip;

float nh(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(bam(i), bam(i + vec3(1,0,0)), f.x), mix(bam(i + vec3(0,1,0)), bam(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(bam(i + vec3(0,0,1)), bam(i + vec3(1,0,1)), f.x), mix(bam(i + vec3(0,1,1)), bam(i + vec3(1,1,1)), f.x), f.y), f.z);
}
vec2 toaMat(){
  vec3 a = abs(NL);
  return a.y > .6 ? L.xz : a.x > a.z ? L.zy : L.xy;
}
float cachCanh(){
  vec3 d = Co * .5 - abs(L);
  float nho = min(d.x, min(d.y, d.z)), lon = max(d.x, max(d.y, d.z));
  return d.x + d.y + d.z - nho - lon;
}

vec3 vanThem(vec3 c){
  vec2 q = toaMat();
  float h = Ex.z * 37.;
  if (kieu == 2) c *= .9 + .18 * bam(floor(NL * 4. + .5) + h + 7.);
  else if (kieu == 3) c *= .62 + .42 * bam(vec3(floor(q * 4.), h)) * (.6 + .4 * nh(L * .8 + h));
  else if (kieu == 4) c *= .75;
  else if (kieu == 5) {
    vec2 o = floor(q * 4.);
    c *= (mod(o.x + o.y, 2.) < 1. ? 1. : .96) * (bam(vec3(o, h)) < .06 ? .84 : 1.);
  } else if (kieu == 6) {
    float a = nh(L * 2.2 + h + nhip * .13), b = nh(L * 7. + h);
    c *= .84 + .2 * a + .05 * (b - .5) + .015 * sin(b * 14.);
  } else if (kieu == 7) {
    float gap = sign(q.x * Co.y - q.y * max(Co.x, Co.z) * .7);
    c *= .93 + .05 * gap + .1 * (nh(L * 14. + h) - .5) + .05 * (bam(floor(vec3(q * 40., h))) - .5);
    c = mix(c, vec3(1., .98, .92), (1. - smoothstep(.025, .05, cachCanh())) * .55);
  } else if (kieu == 8) {
    float soi = nh(vec3(q.x * 26., q.y * 7., h)) * .5 + nh(vec3(q.x * 8., q.y * 28., h + 3.)) * .5;
    c *= .66 + .5 * soi + .08 * bam(floor(L * 30.) + h);
  } else if (kieu == 9) c *= .9 + .12 * bam(floor(L * 11.) + h);
  return c;
}

vec3 sangThem(vec3 c, vec3 n, float bd){
  float d = dot(n, nang), dd = max(d, 0.);
  vec3 may = normalize(mat_may - P), ra;
  if (kieu == 3) {
    vec3 v = den_pin - P;
    float xa = length(v), tia = max(0., dot(n, v / max(xa, .001))) * .75 + .25;
    ra = c * (vec3(.44, .51, .60) * (.8 + .2 * n.y) + vec3(.30, .35, .42) * dd * bd + vec3(1.5, 1.15, .7) * tia * (1. - smoothstep(2., 9., xa)));
  } else if (kieu == 4) {
    ra = c * (vec3(.55, .5, .8) + vec3(.35, .5, .7) * dd * bd);
    vec3 vien = fract(Ex.z * 7.3) < .5 ? vien_a : vien_b;
    if (Chat > 7.5) {
      vec2 o = toaMat() * vec2(1.6, 1.3), f = fract(o);
      if (abs(NL.y) < .5 && f.x > .3 && f.x < .72 && f.y > .25 && f.y < .75 && bam(vec3(floor(o), Ex.z * 50.)) > .45) ra = vien * .85 + .12;
    }
    float e = cachCanh();
    ra = mix(ra, vien * 1.1, (1. - smoothstep(.035, .075, e)) * step(.12, min(Co.x, min(Co.y, Co.z))));
    ra += vien_a * pow(1. - max(dot(n, may), 0.), 4.) * .25;
  } else if (kieu == 5) {
    float bac = d * bd > .55 ? 1.12 : d * bd > .1 ? .9 : .68;
    ra = floor(c * bac * 15. + .5) / 15.;
  } else if (kieu == 6 || kieu == 8) {
    float mem = max((d + .45) / 1.45, 0.) * (.45 + .55 * bd);
    ra = c * (vec3(.50, .48, .53) + vec3(.68, .60, .52) * mem);
    ra += c * pow(1. - max(dot(n, may), 0.), 2.5) * (kieu == 8 ? .4 : .1);
  } else if (kieu == 7) {
    ra = c * (vec3(.64, .64, .7) * (.85 + .15 * n.y) + vec3(.5, .46, .38) * dd * bd);
  } else {
    ra = c * (vec3(.52, .56, .66) * (.8 + .2 * n.y) + vec3(.74, .66, .52) * dd * bd);
  }
  return ra;
}`
