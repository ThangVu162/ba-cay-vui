# 3 cay vui

Game 3 cay realtime choi vui trong cong ty. Chu phong tao link, moi nguoi vao phong cho, va chi bat dau khi du nguoi.

## Luat demo

- Su dung 36 la bai tu A (1) den 9.
- Moi nguoi nhan 3 cay; tong diem lay hang don vi, rieng hang don vi 0 tinh la 10 diem (cao nhat).
- Thu bac tay bai: Sanh dong chat > Bo ba > Diem. Sanh dong chat la 3 la lien tiep cung chat; bo ba la 3 la cung so.
- Neu cung loai tay bai, so gia tri cao hon truoc, sau do chat cao nhat quyet dinh: Ro > Co > Bich > Tep.
- Moi luot co so van bang so nguoi choi.
- Ket thuc luot: diem = `60 x (so van thang - 1)`.

## Ket noi Firebase

1. Tao Firebase project va them mot Web App.
2. Trong Firebase Console, tao **Realtime Database**. Luu y URL database phai co trong Web config.
3. Sao chep Web config vao `firebase-config.js`, thay `firebaseConfig = null` bang object Firebase cung cap.
4. Trong tab Rules cua Realtime Database, dan noi dung `database.rules.json` va Publish.
5. Commit va day cac file moi len GitHub. GitHub Pages tu dong phuc vu ban moi.

Rules hien tai la public read/write de anh em vao phong khong can dang ky. Chi phu hop game vui, khong dung tien that. Neu mo rong, hay them Firebase Authentication va Cloud Functions de server tu chia bai va ap dung rules an toan hon.
