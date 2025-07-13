// src/middleware.ts
import { defineMiddleware, type APIContext } from 'astro/middleware';
import { slugify } from '../src/utils/slugify'; // Pastikan path ini benar dari src/middleware.ts
import videosData from '../src/public/videos.json'; // !!! Import langsung JSON dari public

// Interface untuk struktur data video Anda
interface VideoData {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnail: string;
  thumbnailWidth: number;
  thumbnailHeight: number;
  datePublished?: string;
  dateModified?: string;
  embedUrl: string;
  tags: string;
  previewUrl?: string;
  duration?: string;
}

// Map video ID ke informasi yang dibutuhkan (title, slug, id)
// Ini akan diisi sekali saat module diinisialisasi (saat cold start Worker)
let videoMap: Map<string, { title: string; slug: string; id: string }>;
let isDataLoaded = false;

// Fungsi untuk memuat dan memproses data video
// Ini akan dijalankan secara asinkron saat middleware pertama kali dimuat
async function loadVideoData() {
  if (isDataLoaded) return; // Mencegah pemuatan berulang

  console.log('[Middleware] Memulai inisialisasi data video dari videos.json...');

  try {
    // videosData sudah berisi objek JSON yang di-import
    // Kita hanya perlu memastikan tipenya benar
    const allVideos: VideoData[] = videosData as VideoData[];

    videoMap = new Map();
    allVideos.forEach(video => {
      const videoSlug = slugify(video.title);
      videoMap.set(video.id, {
        id: video.id,
        title: video.title,
        slug: videoSlug,
      });
    });
    isDataLoaded = true;
    console.log(`[Middleware] Data video berhasil dimuat dan diproses. Total entries: ${videoMap.size}`);
  } catch (error) {
    console.error('[Middleware] Gagal memproses data video dari videos.json:', error);
    // Jika ada error dalam memproses data, set isDataLoaded false
    // agar percobaan ulang terjadi pada request berikutnya
    isDataLoaded = false;
  }
}

// Panggil fungsi pemuatan data saat modul middleware pertama kali dimuat.
// Di Cloudflare Workers, ini terjadi pada "cold start" instance Worker.
loadVideoData().catch(error => {
  console.error('[Middleware] Kesalahan tak terduga saat inisialisasi data video:', error);
});

// Fungsi pembantu untuk mendapatkan info video
async function getVideoTitleAndSlug(videoId: string): Promise<{ title: string; slug: string; id: string } | null> {
  // Jika data belum dimuat (misalnya, cold start pertama atau kegagalan sebelumnya),
  // coba muat ulang (ini akan menggunakan cache jika sudah dimuat).
  if (!isDataLoaded) {
    console.log('[Middleware] Data belum dimuat, mencoba memuat ulang...');
    await loadVideoData();
  }
  return videoMap.get(videoId) || null;
}

export const onRequest = defineMiddleware(async (context: APIContext, next) => {
  const { url, redirect } = context;
  console.log(`[Middleware] Mencegat URL: ${url.pathname}`);

  // Regex untuk mencocokkan URL /v/${videoId}
  const match = url.pathname.match(/^\/v\/([a-zA-Z0-9_-]+)$/);

  if (match) {
    const videoId = match[1]; // ID video yang ditangkap dari URL
    console.log(`[Middleware] URL cocok! ID ditemukan: ${videoId}`);

    const videoInfo = await getVideoTitleAndSlug(videoId);

    if (videoInfo) {
      // Buat path baru yang SEO-friendly
      const newPath = `/${videoInfo.slug}-${videoInfo.id}/`;
      console.log(`[Middleware] Video ditemukan. Melakukan REDIRECT 301 dari ${url.pathname} ke ${newPath}`);
      return redirect(newPath, 301); // Redirect permanen
    } else {
      console.warn(`[Middleware] Video dengan ID "${videoId}" tidak ditemukan dalam data. Mengarahkan ke /404.`);
      return redirect('/404', 302); // Redirect sementara ke 404
    }
  }

  console.log(`[Middleware] URL ${url.pathname} tidak cocok dengan pola. Melanjutkan.`);
  return next(); // Lanjutkan ke handler Astro berikutnya
});
