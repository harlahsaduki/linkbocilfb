// src/middleware.ts
import { defineMiddleware, type APIContext } from 'astro/middleware';
import { slugify } from '../utils/slugify'; // Ensure this path is correct from src/middleware.ts

// 1. Import the JSON file as a raw string
import rawVideosJsonString from '../public/videos.json?raw';

// 2. Define your VideoData interface
interface VideoData {
  id: string;
  title: string;
  // Include any other properties from your videos.json that might be useful,
  // even if not directly used for slug/redirect, for type safety.
  // For example, if your JSON has 'description', you can add it:
  // description?: string;
  // category?: string;
  // ...
}

// 3. Declare variables for processed data and loading state
let videoMap: Map<string, { title: string; slug: string; id: string }>;
let isDataLoaded = false;

// 4. Declare a variable to hold the parsed array (outside loadVideoData)
// This makes it available globally within the module once parsed.
let parsedVideosArray: VideoData[] = [];

// 5. Asynchronously load and process the video data
async function loadVideoData() {
  // Prevent re-initialization if data is already loaded
  if (isDataLoaded) {
    console.log('[Middleware] Data already loaded. Skipping re-initialization.');
    return;
  }

  console.log('[Middleware] STARTING data initialization from videos.json...');

  try {
    // ⭐ Parse the raw JSON string into a JavaScript array of VideoData objects
    parsedVideosArray = JSON.parse(rawVideosJsonString) as VideoData[];

    console.log(`[Middleware] Raw videosData type: ${typeof parsedVideosArray}, is array: ${Array.isArray(parsedVideosArray)}`);
    console.log(`[Middleware] Raw videosData length: ${parsedVideosArray.length}`);

    // Use the parsed array for processing
    const allVideos: VideoData[] = parsedVideosArray;

    videoMap = new Map(); // Initialize the Map
    allVideos.forEach(video => {
      // For debugging specific ID
      if (video.id === '58ov9u7wbc50') {
         console.log(`[Middleware] Processing target video ID: ${video.id}, Title: "${video.title}"`);
      }
      // Create the slug from the video title
      const videoSlug = slugify(video.title);

      // Store the essential info (id, title, slug) in the map for quick lookups
      videoMap.set(video.id, {
        id: video.id,
        title: video.title,
        slug: videoSlug,
      });
    });

    isDataLoaded = true; // Mark data as loaded
    console.log(`[Middleware] Data video successfully loaded and processed. Total entries in map: ${videoMap.size}`);

    // Final check for the specific ID after processing
    if (videoMap.has('58ov9u7wbc50')) {
      console.log('[Middleware] CONFIRM: ID 58ov9u7wbc50 is PRESENT in videoMap after processing.');
    } else {
      console.log('[Middleware] PROBLEM: ID 58ov9u7wbc50 is NOT present in videoMap after processing.');
    }

  } catch (error) {
    console.error('[Middleware] ERROR processing video data from videos.json:', error);
    isDataLoaded = false; // Reset state so it tries again on next request
    throw error; // Re-throw to propagate the error if severe
  }
}

// ⭐ Call loadVideoData at the module's top level.
// This runs once when the Worker instance "cold starts", ensuring data is ready.
loadVideoData().catch(error => {
  console.error('[Middleware] Unexpected error during video data initialization at startup:', error);
});

// 6. Helper function to get video info
async function getVideoTitleAndSlug(videoId: string): Promise<{ title: string; slug: string; id: string } | null> {
  // If data wasn't loaded (e.g., first request after a cold start or previous failure), try again
  if (!isDataLoaded) {
    console.log('[Middleware] Data not loaded, attempting to load again...');
    await loadVideoData();
  }
  console.log(`[Middleware] Looking up video ID: ${videoId} in map. Map size: ${videoMap.size}`);

  const result = videoMap.get(videoId);

  if (result) {
    console.log(`[Middleware] Found video info for ${videoId}: ${JSON.stringify(result)}`);
  } else {
    console.log(`[Middleware] Did NOT find video info for ${videoId}.`);
  }
  return result || null;
}

// 7. Define the main middleware request handler
export const onRequest = defineMiddleware(async (context: APIContext, next) => {
  const { url, redirect } = context;
  console.log(`[Middleware] Intercepting URL: ${url.pathname}`);

  // Regex to match the old URL pattern: /v/videoId (and optionally a trailing slash)
  const match = url.pathname.match(/^\/v\/([a-zA-Z0-9_-]+)\/?$/); // Added \/? for optional trailing slash

  if (match) {
    const videoId = match[1]; // Extract the video ID
    console.log(`[Middleware] URL matched! ID found: ${videoId}`);

    const videoInfo = await getVideoTitleAndSlug(videoId); // Look up video info

    if (videoInfo) {
      // Construct the new SEO-friendly URL
      const newPath = `/${videoInfo.slug}-${videoInfo.id}/`;
      console.log(`[Middleware] Video found. REDIRECTING 301 from ${url.pathname} to ${newPath}`);
      return redirect(newPath, 301); // Perform a permanent redirect
    } else {
      console.warn(`[Middleware] Video with ID "${videoId}" not found in data. Redirecting to /404.`);
      return redirect('/404', 302); // Redirect to 404 page if ID not found
    }
  }

  console.log(`[Middleware] URL ${url.pathname} did not match pattern. Continuing.`);
  return next(); // Let Astro's router handle other URLs
});
