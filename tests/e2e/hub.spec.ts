import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const fixture = "http://127.0.0.1:54329";
const ownerId = "11111111-1111-4111-8111-111111111111";
const secondOwnerId = "22222222-2222-4222-8222-222222222222";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email công việc", { exact: true }).fill("member@example.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Test-password-123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
}

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`, { data: { seed: true } });
});

test("login protection, project creation/edit, logout and mobile layout", async ({ page }) => {
  await page.goto("/playables");
  await expect(page).toHaveURL(/\/login/);
  await login(page);
  await page.getByRole("button", { name: "Tạo dự án", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Tạo dự án", exact: true });
  await form.getByLabel("Tên dự án").fill("Dự án E2E");
  await form.getByLabel("Mô tả").fill("Mô tả được lưu qua server action.");
  await form.getByLabel("Người phụ trách").selectOption(ownerId);
  await form.getByRole("button", { name: "Tạo dự án", exact: true }).click();
  await expect(form).toBeHidden();
  const projectCard = page.locator("article.project-card").filter({ has: page.getByRole("link", { name: "Dự án E2E", exact: true }) });
  await expect(projectCard).toBeVisible();
  await mkdir("artifacts/qa", { recursive: true });
  await page.screenshot({ path: "artifacts/qa/project-cards.png" });
  await projectCard.getByRole("link", { name: "Xem dự án", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dự án E2E", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Chỉnh sửa dự án", exact: true });
  await edit.getByLabel("Người phụ trách").selectOption(secondOwnerId);
  await edit.getByLabel("Trạng thái", { exact: true }).selectOption("paused");
  await edit.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(edit).toBeHidden();
  await page.reload();
  await expect(page.getByText("Minh Trần", { exact: true })).toBeVisible();
  await expect(page.getByText("Tạm dừng", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/login/);
});

test("server pagination, combined URL filters, URL build edit, panel close and archive restore", async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await login(page);
  await page.getByRole("link", { name: "Kho playable", exact: true }).click();
  await expect(page.locator("article.playable-card")).toHaveCount(12);
  await expect(page.locator("article.playable-card img[data-preview-cover='captured']").nth(2)).toBeVisible();
  await mkdir("artifacts/qa", { recursive: true });
  await page.screenshot({ path: "artifacts/qa/desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: "artifacts/qa/gallery-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole("link", { name: "Trang sau" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator("article.playable-card")).toHaveCount(2);
  await page.goto("/playables");
  await page.getByRole("button", { name: "Thêm playable", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Thêm playable", exact: true });
  await form.getByLabel("Tên playable").fill("Build URL E2E");
  await form.getByLabel("Dự án", { exact: false }).selectOption({ label: "Dự án mẫu" });
  await form.getByLabel("URL lưu trữ").fill("https://cdn.example.test/e2e.html");
  await form.getByLabel("Unity Ads", { exact: true }).check();
  await form.getByLabel("Mức độ win").selectOption("winning");
  await form.getByRole("button", { name: "Lưu playable" }).click();
  await expect(form).toBeHidden();
  await page.getByRole("search").getByLabel("Tìm kiếm", { exact: true }).fill("Build URL E2E");
  await page.getByRole("search").getByRole("button", { name: /Bộ lọc/ }).click();
  await page.getByRole("search").getByLabel("Mức độ win").selectOption("winning");
  await page.getByRole("search").getByLabel("Network", { exact: true }).selectOption("unity-ads");
  await request.post(`${fixture}/__test/delay-next`, { data: { kind: "playables", ms: 1200 } });
  await page.getByRole("button", { name: "Áp dụng" }).click();
  await expect(page.getByRole("search")).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("button", { name: "Đang tìm…", exact: true })).toBeDisabled();
  await expect(page).toHaveURL(/q=Build\+URL\+E2E/);
  await expect(page.locator("article.playable-card")).toHaveCount(1);
  const filteredUrl = page.url();
  await page.getByRole("link", { name: "Build URL E2E", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Build URL E2E", exact: true });
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Chỉnh sửa playable" }).click();
  const edit = page.getByRole("dialog", { name: "Chỉnh sửa playable", exact: true });
  await expect(edit.getByLabel("URL lưu trữ")).toBeDisabled();
  await edit.getByLabel("Ghi chú", { exact: true }).fill("Kết quả được giữ sau khi reload.");
  await edit.getByLabel("Mức độ win").selectOption("scaling");
  await edit.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(edit).toBeHidden();
  await page.reload();
  await expect(page.getByRole("dialog").getByText("Kết quả được giữ sau khi reload.", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: "artifacts/qa/mobile.png" });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole("link", { name: "Đóng chi tiết playable" }).click();
  await expect(page).toHaveURL(filteredUrl);
  await expect(page.getByText("Không tìm thấy kết quả", { exact: false })).toBeVisible();
  await page.getByRole("search").getByRole("link", { name: "Xóa bộ lọc" }).click();
  await page.getByRole("link", { name: "Build URL E2E", exact: true }).click();
  await page.getByRole("dialog", { name: "Build URL E2E" }).getByRole("button", { name: "Lưu trữ", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Lưu trữ", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.goto("/playables?archived=true");
  await page.getByRole("link", { name: "Build URL E2E", exact: true }).click();
  await page.getByRole("dialog", { name: "Build URL E2E" }).getByRole("button", { name: "Khôi phục", exact: true }).click();
  await page.goto("/playables?q=Build+URL+E2E");
  await expect(page.getByRole("link", { name: "Build URL E2E", exact: true })).toBeVisible();
});

test("direct file upload/download and database failure retain input and clean new assets", async ({ page, request }) => {
  const initialObjectCount = (await (await request.get(`${fixture}/__test/state`)).json()).objectCount;
  await login(page);
  await page.goto("/playables");
  await page.getByRole("button", { name: "Thêm playable", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Thêm playable", exact: true });
  await form.getByLabel("Tên playable").fill("Build file E2E");
  await form.getByLabel("Dự án", { exact: false }).selectOption({ label: "Dự án mẫu" });
  const contents = `<!doctype html><html><head><meta charset="utf-8"><title>Exact uploaded test build</title><style>html,body{margin:0;height:100%;font-family:Arial,sans-serif}body{display:grid;place-items:center;background:linear-gradient(150deg,#1b1645,#754baf);color:#fff;text-align:center}h1{font-size:48px;margin:0 20px 24px}button{padding:20px 36px;background:#ffd27c;color:#30204e;border:0;border-radius:18px;font-weight:bold;font-size:20px}.orb{width:170px;height:170px;border-radius:50%;background:radial-gradient(circle at 35% 25%,#fff,#b4ffea 20%,#6da8ff 55%,#6e55b6);margin:0 auto 40px;box-shadow:0 0 70px #bb93ff}</style></head><body><main><div class="orb"></div><h1>Orbit Adventure</h1><button>Bắt đầu chơi</button></main></body></html>`;
  await form.getByLabel("File build HTML / ZIP").setInputFiles({ name: "e2e-build.html", mimeType: "text/html", buffer: Buffer.from(contents) });
  await request.post(`${fixture}/__test/fail-next`, { data: { kind: "playable" } });
  await form.getByRole("button", { name: "Lưu playable" }).click();
  await expect(form.getByRole("alert")).toContainText("lưu dữ liệu thất bại");
  await expect(form.getByLabel("Tên playable")).toHaveValue("Build file E2E");
  await expect.poll(async () => (await (await request.get(`${fixture}/__test/state`)).json()).objectCount).toBe(initialObjectCount);
  await form.getByRole("button", { name: "Lưu playable" }).click();
  await expect(form).toBeHidden();
  const savedState = await (await request.get(`${fixture}/__test/state`)).json();
  const saved = savedState.playables.find((item: { name: string }) => item.name === "Build file E2E");
  expect(saved.thumbnail_path).toBeTruthy();
  expect(savedState.objectCount).toBe(initialObjectCount + 2);
  const savedCard = page.locator("article.playable-card").filter({ has: page.getByRole("link", { name: "Build file E2E", exact: true }) });
  await expect(savedCard.locator("img[data-preview-cover='uploaded']")).toBeVisible();
  await expect.poll(() => savedCard.locator("img").evaluate(image => (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
  await page.getByRole("link", { name: "Build file E2E", exact: true }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "Tải file", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("e2e-build.html");
  const stream = await download.createReadStream();
  const chunks = []; for await (const chunk of stream!) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toBe(contents);
});

test("HTML covers become static images and live review plays in an isolated responsive dialog", async ({ page, request }) => {
  const state = await (await request.get(`${fixture}/__test/state`)).json();
  const playable = state.playables.find((item: { name: string }) => item.name === "Garden Merge · Concept 14");
  expect(playable).toBeTruthy();
  // The member-only source endpoint must not expose private builds anonymously.
  const anonymousPreview = await request.get(`/api/preview/${playable.id}`);
  expect(anonymousPreview.status()).toBe(401);

  await page.setViewportSize({ width: 1600, height: 1080 });
  await login(page);
  await page.goto(`/playables?q=${encodeURIComponent(playable.name)}`);
  await expect(page.locator("article.playable-card")).toHaveCount(1);
  const card = page.locator("article.playable-card").filter({ has: page.getByRole("link", { name: playable.name, exact: true }) });
  await expect(card.locator(".playable-card-win")).toContainText("Mức độ win");
  await expect(card.locator(".playable-card-win .badge")).toHaveText("Win");
  await expect(card.locator(".network-unity")).toHaveText("Unity Ads");
  const unityColor = await card.locator(".network-unity").evaluate(tag => getComputedStyle(tag).backgroundColor);
  expect(unityColor).toBe("rgb(237, 233, 254)");
  const cover = card.locator("img[data-preview-cover='captured']");
  await expect(cover).toBeVisible();
  expect(await cover.evaluate(image => (image as HTMLImageElement).naturalWidth > 0 && (image as HTMLImageElement).naturalHeight > 0)).toBe(true);
  // A nonempty file can still be a blank render. Check that the captured
  // creative contains varied opaque pixels, then inspect its QA screenshots.
  const capturedPixels = await cover.evaluate(image => {
    const canvas = document.createElement("canvas");
    canvas.width = 24; canvas.height = 40;
    const context = canvas.getContext("2d")!;
    context.drawImage(image as HTMLImageElement, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set<string>();
    let opaque = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 240) { opaque += 1; colors.add(`${pixels[i] >> 4},${pixels[i + 1] >> 4},${pixels[i + 2] >> 4}`); }
    return { colors: colors.size, coverage: opaque / (canvas.width * canvas.height), topAlpha: pixels[(canvas.width + 1) * 4 + 3], bottomAlpha: pixels[((canvas.height - 2) * canvas.width + 1) * 4 + 3] };
  });
  expect(capturedPixels.colors).toBeGreaterThan(8);
  const raster = await cover.evaluate(async image => Array.from(new Uint8Array(await (await fetch((image as HTMLImageElement).src)).arrayBuffer())));
  await mkdir("artifacts/qa", { recursive: true });
  await writeFile("artifacts/qa/generated-cover.webp", Buffer.from(raster));
  expect(capturedPixels.coverage).toBeGreaterThan(0.95);
  expect(capturedPixels.topAlpha).toBe(255);
  expect(capturedPixels.bottomAlpha).toBe(255);
  // The expensive HTML runner is discarded when its still image is ready.
  await expect(page.locator("iframe")).toHaveCount(0);

  await card.getByRole("button", { name: `Xem trực tiếp ${playable.name}`, exact: true }).click();
  const player = page.getByRole("dialog", { name: `Xem trực tiếp ${playable.name}`, exact: true });
  await expect(player).toBeVisible();
  const iframe = player.locator(`iframe[title="Preview ${playable.name}"]`);
  await expect(iframe).toBeVisible();
  const sandbox = (await iframe.getAttribute("sandbox")) || "";
  expect(sandbox.split(/\s+/)).toContain("allow-scripts");
  expect(sandbox.split(/\s+/)).not.toContain("allow-same-origin");
  const creative = page.frameLocator(`iframe[title="Preview ${playable.name}"]`);
  // The actual game viewport stays at the selected design dimensions even
  // when its displayed frame is scaled to fit a laptop or mobile screen.
  const devices = [
    ["iphone-13-14", 390, 844], ["iphone-15-16", 393, 852],
    ["iphone-15-pro-max", 430, 932], ["iphone-16-pro", 402, 874],
    ["iphone-16-pro-max", 440, 956], ["android", 360, 800],
    ["android-large", 412, 915],
  ] as const;
  for (const [id, width, height] of devices) {
    await player.getByRole("combobox", { name: "Thiết bị preview" }).selectOption(id);
    await expect.poll(() => creative.locator("html").evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([width, height]);
    await expect(player.getByLabel("Kích thước preview")).toContainText(`${width} × ${height}`);
  }
  await player.getByRole("button", { name: "Chuyển màn hình ngang" }).click();
  await expect.poll(() => creative.locator("html").evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([915, 412]);
  await player.getByRole("button", { name: "Chuyển màn hình dọc" }).click();
  await player.getByRole("combobox", { name: "Thiết bị preview" }).selectOption("iphone-13-14");
  const start = creative.getByRole("button", { name: "Bắt đầu chơi", exact: true });
  await expect(start).toBeVisible();
  // Exercise real pointer input at the displayed coordinates. The iframe keeps
  // device pixels while the outer frame scales to fit the screen.
  async function clickPlayableButton(name: string) {
    const button = creative.getByRole("button", { name, exact: true });
    await button.evaluate(element => {
      element.removeAttribute("data-trusted-click");
      element.addEventListener("click", event => element.setAttribute("data-trusted-click", String(event.isTrusted)), { once: true });
    });
    const target = await button.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: window.innerWidth, height: window.innerHeight };
    });
    const frame = await iframe.boundingBox();
    expect(frame).not.toBeNull();
    await page.mouse.click(frame!.x + target.x * frame!.width / target.width, frame!.y + target.y * frame!.height / target.height);
    await expect(creative.locator("#start")).toHaveAttribute("data-trusted-click", "true");
  }
  await clickPlayableButton("Bắt đầu chơi");
  await expect(creative.getByText("Bạn đã bắt đầu!", { exact: true })).toBeVisible();
  await mkdir("artifacts/qa", { recursive: true });
  await page.screenshot({ path: "artifacts/qa/live-preview.png" });

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await expect.poll(() => creative.locator("html").evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([390, 844]);
  // Pointer input must still work through the fitted frame on mobile.
  await clickPlayableButton("Chơi lại");
  await expect(creative.getByText("Bạn đã bắt đầu!", { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/qa/live-preview-mobile.png" });
  await player.focus();
  await page.keyboard.press("Escape");
  await expect(player).toBeHidden();
  await expect(page.locator('iframe[title^="Preview "]')).toHaveCount(0);
  await expect(card.locator("img[data-preview-cover='captured']")).toBeVisible();
});
