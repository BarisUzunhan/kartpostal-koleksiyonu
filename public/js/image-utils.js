/* ========================================
   ImageUtils — Tarayıcıda görsel küçültme
   Thumbnail gibi küçük görseller için, yüklemeden önce
   canvas ile yeniden boyutlandırıp sıkıştırır (sunucu/Node
   tarafı yok — her şey tarayıcıda oluyor).
   ======================================== */

const ImageUtils = (function () {

    // dosya -> küçültülmüş JPEG Blob (uzun kenar maxDim'i geçmez)
    function resizeImage(file, maxDim = 600, quality = 0.82) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();

            img.onload = () => {
                URL.revokeObjectURL(url);

                let { width, height } = img;
                if (width > height) {
                    if (width > maxDim) { height = Math.round(height * (maxDim / width)); width = maxDim; }
                } else {
                    if (height > maxDim) { width = Math.round(width * (maxDim / height)); height = maxDim; }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (!blob) { reject(new Error('Görsel küçültülemedi')); return; }
                    resolve(blob);
                }, 'image/jpeg', quality);
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Görsel okunamadı')); };
            img.src = url;
        });
    }

    return { resizeImage };
})();
