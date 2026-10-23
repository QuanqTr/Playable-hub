import type { ProjectStatus, WinLevel } from "./types";
export const PAGE_SIZE = 12;
export const PROJECT_STATUSES: Record<ProjectStatus, string> = { active: "Đang hoạt động", paused: "Tạm dừng", completed: "Đã kết thúc" };
export const WIN_LEVELS: Record<WinLevel, string> = { unreviewed: "Chưa đánh giá", testing: "Đang test", not_winning: "Không win", promising: "Có tiềm năng", winning: "Win", scaling: "Scale" };
export const BUILD_MAX_BYTES = 50 * 1024 * 1024;
export const THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024;
