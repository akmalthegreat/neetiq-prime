/**
 * NEETIQ Media & Question Diagrams CDN Configuration.
 * Connects directly to the akmalthegreat/neettrack-cdn repository.
 */

export const CDN_REPO = "akmalthegreat/neettrack-cdn";
export const CDN_BRANCH = "main";
export const CDN_BASE_PATH = "public/img/data";

// High-speed, edge-cached global CDN
export const JSDELIVR_CDN_BASE = `https://cdn.jsdelivr.net/gh/${CDN_REPO}@${CDN_BRANCH}/${CDN_BASE_PATH}`;

// Direct GitHub raw fallback in case of CDN propagation or regional outages
export const RAW_GITHUB_CDN_BASE = `https://raw.githubusercontent.com/${CDN_REPO}/${CDN_BRANCH}/${CDN_BASE_PATH}`;

export const QUESTION_IMAGE_CDN_BASE = JSDELIVR_CDN_BASE;
