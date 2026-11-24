// Kịch bản mẫu 16 giây: mỗi mặt bằng một truyện, để lệnh mau cho xem đủ khả năng của bộ dựng.
const c = (tu, den, chu, hanh_dong, tu_cho, den_cho, may, them = {}) => ({ tu, den, chu, hanh_dong, tu_cho, den_cho, may, su_kien: [], ...them })
const SANG = { su_kien: ['sang'] }

const TRUYEN = {
  'sandbox-khoi': n => [
    c(0, 2.6, 'Ngọn tháp bên kia vực đã tắt.', 'dung', 'mep', 'mep', 'toan'),
    c(2.6, 4.8, `${n} nhìn quanh, không có đường qua.`, 'nhin', 'mep', 'mep', 'can'),
    c(4.8, 7, 'Thế là đào lấy từng khối đá.', 'dao', 'mep', 'mep', 'tren'),
    c(7, 10, 'Rồi bắc một cây cầu.', 'xay', 'mep', 'mep', 'ngang', { su_kien: ['cau'] }),
    c(10, 12.6, 'Chạy thật nhanh, không nhìn xuống.', 'chay', 'mep', 'dich', 'theo'),
    c(12.6, 16, 'Và cả thung lũng sáng trở lại.', 'mung', 'dich', 'dich', 'vut', SANG),
  ],
  'do-choi-nhua': n => [
    c(0, 2.6, 'Chưa ai qua nổi ải này.', 'dung', 'xuat-phat', 'xuat-phat', 'toan'),
    c(2.6, 5, `${n} lấy đà lao tới.`, 'chay', 'xuat-phat', 'mep', 'theo'),
    c(5, 7.4, 'Lần đầu: rơi thẳng xuống.', 'nga', 'mep', 'giua', 'ngang'),
    c(7.4, 9.2, 'Làm lại, nhìn thật kỹ.', 'nhin', 'mep', 'mep', 'can'),
    c(9.2, 11.6, 'Và nhảy!', 'nhay', 'mep', 'ben-kia', 'ngang'),
    c(11.6, 13.2, 'Chỉ còn vài bước nữa.', 'di', 'ben-kia', 'dich', 'theo'),
    c(13.2, 16, 'Qua ải rồi!', 'mung', 'dich', 'dich', 'vut', SANG),
  ],
  'vuc': (n, p) => [
    c(0, 2.6, 'Ánh sáng ở ngay bên kia.', 'dung', 'mep', 'mep', 'toan', { phu: 'theo' }),
    c(2.6, 5, `${p} hỏi: qua bằng cách nào?`, 'dung', 'mep', 'mep', 'doi', { phu: 'doi-dien', noi: 'phu' }),
    c(5, 8, `${n} không đáp, chỉ bắc cầu.`, 'xay', 'mep', 'mep', 'ngang', { su_kien: ['cau'], phu: 'theo' }),
    c(8, 10.6, 'Hai đứa cùng chạy qua.', 'chay', 'mep', 'ben-kia', 'theo', { phu: 'theo' }),
    c(10.6, 12.6, 'Thêm vài bước nữa thôi.', 'di', 'ben-kia', 'dich', 'ngang', { phu: 'theo' }),
    c(12.6, 16, 'Không ai bị bỏ lại.', 'mung', 'dich', 'dich', 'vut', { ...SANG, phu: 'theo' }),
  ],
  'ham': (n, p) => [
    c(0, 2.4, 'Đừng bao giờ vào đường hầm này.', 'dung', 'xuat-phat', 'xuat-phat', 'toan'),
    c(2.4, 5, `${n} vẫn bước vào.`, 'di', 'xuat-phat', 'mep', 'theo'),
    c(5, 7, 'Có tiếng động sau lưng.', 'nhin', 'mep', 'mep', 'can'),
    c(7, 9.8, `${p} đang đuổi tới!`, 'chay', 'mep', 'ben-kia', 'ngang', { phu: 'duoi' }),
    c(9.8, 12.6, 'Đừng quay đầu lại.', 'chay', 'ben-kia', 'dich', 'theo', { phu: 'duoi' }),
    c(12.6, 16, 'Đèn bật. Nó biến mất.', 'mung', 'dich', 'dich', 'vut', SANG),
  ],
  'leo': (n, p) => [
    c(0, 2.6, 'Trên kia là thứ ai cũng muốn.', 'dung', 'xuat-phat', 'xuat-phat', 'toan', { phu: 'theo' }),
    c(2.6, 5, `${p} bảo: cao quá, về thôi.`, 'dung', 'xuat-phat', 'xuat-phat', 'doi', { phu: 'doi-dien', noi: 'phu' }),
    c(5, 7, `${n} vẫn bước tới.`, 'di', 'xuat-phat', 'mep', 'theo'),
    c(7, 10.6, 'Leo từng bậc một.', 'leo', 'mep', 'ben-kia', 'ngang'),
    c(10.6, 12.6, 'Không dừng lại.', 'di', 'ben-kia', 'dich', 'theo'),
    c(12.6, 16, 'Và chạm tới đỉnh.', 'mung', 'dich', 'dich', 'vut', SANG),
  ],
  'dau-truong': (n, p) => [
    c(0, 2.6, 'Cả khán đài đang chờ.', 'dung', 'mep', 'mep', 'toan'),
    c(2.6, 5, `${p} cười: cậu không thắng nổi đâu.`, 'dung', 'mep', 'mep', 'doi', { phu: 'doi-dien', noi: 'phu' }),
    c(5, 7.4, 'Hiệp một: ngã sấp mặt.', 'nga', 'mep', 'giua', 'ngang'),
    c(7.4, 9.6, `${n} đứng dậy: chơi lại.`, 'noi', 'giua', 'giua', 'can', { noi: 'chinh' }),
    c(9.6, 12.6, 'Rồi lao thẳng về đích.', 'chay', 'giua', 'dich', 'theo', { phu: 'duoi' }),
    c(12.6, 16, 'Cả khán đài nổ tung!', 'mung', 'dich', 'dich', 'vut', SANG),
  ],
}

// Bộ diễn xuất: cùng một vở 15 giây cho mọi phong cách, lời riêng theo không khí từng phong cách.
// Thứ lạ hiện ở bên phải (su_kien hien), nhân vật giật mình, vẫy thử, nhảy lùi rồi chạy sang trái.
const LOI_DIEN = {
  'khoi-dien': ['Hầm ngục này im quá.', 'Có ai ở đây không?', 'Đi thêm vài bước nữa.', 'Một đôi mắt đỏ hiện ra!', 'Chào... bạn?', 'Không phải bạn rồi!', 'Chạy!', 'Nó vẫn còn đó.'],
  'bong-den': ['Rừng đêm nay đặc sương.', 'Tiếng gì vậy?', 'Đi theo ánh sáng kia.', 'Một bóng cao bỗng hiện ra!', 'Ai đó?', 'Nó tiến lại gần!', 'Chạy khỏi đây!', 'Sương khép lại sau lưng.'],
  'que-neon': ['Một ngày bình thường.', 'Nhưng đầu cứ nghĩ mãi.', 'Bước tiếp thôi.', 'Nỗi lo bỗng hiện ra!', 'Chào nỗi lo.', 'Không, lùi lại đã!', 'Chạy trốn cũng là một cách?', 'Hay ngồi lại mà nghĩ.'],
  'roi-giay': ['Ngày xưa, ở bìa rừng.', 'Có một cậu bé tò mò.', 'Cậu đi về phía khu rừng.', 'Bỗng con sói hiện ra!', 'Cậu chào nó thật lễ phép.', 'Nhưng sói nhe nanh!', 'Cậu chạy một mạch về làng.', 'Và nghĩ mãi về chuyện ấy.'],
  'diorama-toon': ['Một làng nhỏ, năm 1450.', 'Mọi người nhìn ra biển.', 'Ra bến xem có gì.', 'Một cánh buồm lạ xuất hiện!', 'Chào người lạ!', 'Khoan, họ mang vũ khí!', 'Về báo cả làng!', 'Lịch sử rẽ hướng từ đây.'],
  'dat-set-studio': ['Sáng nay bàn làm việc yên ả.', 'Hình như thiếu gì đó.', 'Đi tìm cái bút.', 'Một con quái hiện ra!', 'Ờ... chào?', 'Nó há miệng!', 'Thôi chạy đã!', 'Hóa ra nó chỉ muốn cái bút.'],
}
export function kichBanDien(bang, ma, boiCanh, khung = 'ngang') {
  const p = bang.phong_cach[ma], l = LOI_DIEN[ma] || LOI_DIEN['dat-set-studio']
  return {
    phong_cach: ma, boi_canh: boiCanh, khung, mat_bang: 'san-khau', fps: 30,
    nhan_vat: p.nhan_vat,
    phu_de: { kieu: 'tung-tu', mau: '#ffd84d' },
    am: { nhac: p.nhac, tieng_dong: true },
    canh: [
      c(0, 2.4, l[0], 'dung', 'mep', 'mep', 'toan'),
      c(2.4, 4.6, l[1], ma === 'que-neon' ? 'nghi' : 'nhin', 'mep', 'mep', 'can'),
      c(4.6, 6.5, l[2], 'di', 'mep', 'giua', 'theo'),
      c(6.5, 8.2, l[3], 'giat-minh', 'giua', 'giua', 'can', { su_kien: ['hien'], nhin_ve: 'phai' }),
      c(8.2, 9.6, l[4], 'vay', 'giua', 'giua', 'ngang', { nhin_ve: 'phai' }),
      c(9.6, 10.8, l[5], 'nhay', 'giua', 'mep', 'toan', { nhin_ve: 'phai' }),
      c(10.8, 13, l[6], 'chay', 'mep', 'nua-duong', 'theo'),
      c(13, 15, l[7], ma === 'que-neon' || ma === 'roi-giay' ? 'nghi' : 'run', 'nua-duong', 'nua-duong', 'can', { nhin_ve: 'phai' }),
    ],
  }
}

const MAT_BANG = { 'sandbox-khoi': 'vuc', 'do-choi-nhua': 'vuc', 'kinh-di-retro': 'ham', 'low-poly': 'leo', 'neon': 'ham', 'pixel-16bit': 'leo', 'dat-set': 'dau-truong', 'giay-gap': 'vuc', 'sa-ban': 'dau-truong', 'len-ni': 'vuc' }
const MOC = { 'kinh-di-retro': 'nha', 'neon': 'cong', 'pixel-16bit': 'cong', 'dat-set': 'nha', 'len-ni': 'nha' }

export function kichBanMau(bang, ma, boiCanh, matBang) {
  const p = bang.phong_cach[ma], mb = matBang || MAT_BANG[ma] || 'vuc'
  const rieng = !matBang && TRUYEN[ma]
  return {
    phong_cach: ma, boi_canh: boiCanh, mat_bang: mb, moc: MOC[ma] || 'thap', fps: 30,
    nhan_vat: p.nhan_vat,
    ...(!rieng && { nhan_vat_phu: p.phu_mau }),
    phu_de: { kieu: ma === 'sandbox-khoi' || ma === 'giay-gap' ? 'cum' : 'tung-tu', mau: '#ffd84d' },
    am: { nhac: p.nhac, tieng_dong: true },
    canh: (rieng || TRUYEN[mb] || TRUYEN.vuc)(p.nhan_vat.ten, p.phu_mau.ten),
  }
}
