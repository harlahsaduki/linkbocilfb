// src/middleware.ts
import { defineMiddleware, type APIContext } from 'astro/middleware';
import { slugify } from '../src/utils/slugify';
// Import Node.js 'fs' and 'path' modules
import * as fs from 'node:fs/promises'; // Use promises for async operations
import * as path from 'node:path';

// Define the type for your video data
interface VideoData {
  id: string;
  title: string;
  description: string; // Add other properties if they exist in your JSON
}

let videoMap: Map<string, { title: string; slug: string; id: string }>;
let isDataLoaded = false;

async function loadVideoData() {
  if (isDataLoaded) return;
  console.log('[Middleware] Memulai inisialisasi data video dari public/video-data.json...');

  try {
    // Determine the path to the public directory.
    // In Astro, `process.cwd()` often points to the project root.
    // The 'public' directory is relative to that.
    const dataFilePath = path.join(process.cwd(), 'public', 'videos.json');
    console.log(`[Middleware] Mencoba membaca file: ${dataFilePath}`);

    // Read the file content
    const fileContent = await fs.readFile(dataFilePath, 'utf-8');
    const allVideos: VideoData[] = JSON.parse(fileContent);

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
    console.log(`[Middleware] Data video berhasil dimuat dan diproses dari file. Total entries: ${videoMap.size}`);
  } catch (error) {
    console.error('[Middleware] Gagal memuat data video dari public/video-data.json:', error);
    // Jika file tidak ditemukan atau ada masalah parsing, isDataLoaded akan tetap false
    // sehingga akan mencoba lagi di request berikutnya atau gagal jika tidak di-handle
  }
}

// Load data as soon as the middleware is imported/initialized
// Ensure this runs only once during the application's lifecycle (e.g., server startup)
if (!isDataLoaded) { // Added check to prevent multiple executions if module is re-imported
  loadVideoData().catch(error => {
    console.error('[Middleware] Kesalahan tak terduga saat memuat data video di startup:', error);
  });
}

async function getVideoTitleAndSlug(videoId: string): Promise<{ title: string; slug: string; id: string } | null> {
  if (!isDataLoaded) {
    console.log('[Middleware] Data belum dimuat, mencoba memuat ulang...');
    await loadVideoData();
  }
  return videoMap.get(videoId) || null;
}

export const onRequest = defineMiddleware(async (context: APIContext, next) => {
  const { url, redirect } = context;
  console.log(`[Middleware] Mencegat URL: ${url.pathname}`);

  const match = url.pathname.match(/^\/v\/([a-zA-Z0-9_-]+)$/);

  if (match) {
    const videoId = match[1];
    console.log(`[Middleware] URL cocok! ID ditemukan: ${videoId}`);

    const videoInfo = await getVideoTitleAndSlug(videoId);

    if (videoInfo) {
      const newPath = `/${videoInfo.slug}-${videoInfo.id}/`;
      console.log(`[Middleware] Video ditemukan. Melakukan REDIRECT 301 dari ${url.pathname} ke ${newPath}`);
      return redirect(newPath, 301);
    } else {
      console.warn(`[Middleware] Video dengan ID "${videoId}" tidak ditemukan dalam data. Mengarahkan ke /404.`);
      return redirect('/404', 302);
    }
  }

  console.log(`[Middleware] URL ${url.pathname} tidak cocok dengan pola. Melanjutkan.`);
  return next();
});
