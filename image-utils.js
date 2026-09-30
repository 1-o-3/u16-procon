// ==============================
// 画像まわりの共通ヘルパー (公開サイト main.js / 管理画面 admin.js の両方から使う)
// ・アップロードは PDF / JPEG / PNG に対応。PDFは1ページ目を画像(JPEG)に変換して保存する
//   (<img> タグはPDFを表示できないため、そのまま保存するとHPで画像が表示されない)
// ・大きすぎる画像は縮小してから保存する(サーバーのリクエストサイズ上限 約4.5MB を超えないように)
// ・過去にPDFのまま保存されてしまった画像も、公開サイト側で画像に描画して表示する
// ==============================

const PDFJS_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';

const UPLOAD_ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
// これを超える画像データは縮小・再圧縮する(data URLの文字数)
const INLINE_IMAGE_MAX_LENGTH = 800 * 1024;
const IMAGE_MAX_DIMENSION = 1600;

let pdfjsLoading = null;

function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfjsLoading) {
        pdfjsLoading = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `${PDFJS_BASE}/pdf.min.js`;
            script.onload = () => {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.js`;
                resolve(window.pdfjsLib);
            };
            script.onerror = () => {
                pdfjsLoading = null;
                reject(new Error('PDF.jsの読み込みに失敗しました'));
            };
            document.head.appendChild(script);
        });
    }
    return pdfjsLoading;
}

function dataUrlToBytes(dataUrl) {
    const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

// PDFの1ページ目を白背景のJPEG data URLに変換する
async function pdfToImageDataUrl(bytes) {
    const pdfjsLib = await loadPdfJs();
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    try {
        const page = await pdf.getPage(1);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(IMAGE_MAX_DIMENSION / Math.max(baseViewport.width, baseViewport.height), 3);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        return canvas.toDataURL('image/jpeg', 0.88);
    } finally {
        pdf.destroy();
    }
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('画像を読み込めませんでした'));
        img.src = src;
    });
}

// 大きい画像は長辺 IMAGE_MAX_DIMENSION px のJPEGに縮小する(小さい画像はそのまま。PNGの透過も維持される)
async function shrinkImageDataUrl(dataUrl) {
    if (dataUrl.length <= INLINE_IMAGE_MAX_LENGTH) return dataUrl;

    const img = await loadImage(dataUrl);
    const ratio = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * ratio);
    canvas.height = Math.round(img.naturalHeight * ratio);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // PNGの透過部分がJPEG化で黒くならないように
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
}

function detectUploadType(file) {
    if (UPLOAD_ALLOWED_TYPES.includes(file.type)) return file.type;
    // 環境によっては file.type が空になるため拡張子でも判定する
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') return 'application/pdf';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'png') return 'image/png';
    return null;
}

// アップロードされたファイル(PDF/JPEG/PNG)を、HPの<img>でそのまま表示できる画像data URLにして返す。
// 対応外の形式・サイズ超過の場合はユーザー向けメッセージ付きのErrorを投げる。
async function readUploadAsImage(file) {
    const type = detectUploadType(file);
    if (!type) throw new Error('PDF・JPEG・PNG形式のファイルを選択してください。');
    if (file.size > UPLOAD_MAX_BYTES) throw new Error('ファイルサイズは最大5MBまでです。');

    if (type === 'application/pdf') {
        const bytes = new Uint8Array(await file.arrayBuffer());
        return pdfToImageDataUrl(bytes);
    }
    return shrinkImageDataUrl(await readFileAsDataUrl(file));
}

// 以前にPDFのまま保存された画像(data:application/pdf)を、1ページ目を描画した画像に差し替えて表示する
const pdfImageCache = new Map();

function renderPdfImages(root = document) {
    root.querySelectorAll('img[src^="data:application/pdf"]').forEach(img => {
        const src = img.getAttribute('src');
        img.style.visibility = 'hidden';
        if (!pdfImageCache.has(src)) {
            pdfImageCache.set(src, pdfToImageDataUrl(dataUrlToBytes(src)));
        }
        pdfImageCache.get(src)
            .then(url => { img.src = url; })
            .catch(e => console.error('Failed to render PDF image', e))
            .finally(() => { img.style.visibility = ''; });
    });
}
