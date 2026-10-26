import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { getStoreIcon } from "../lib/store-icon";

afterEach(() => vi.unstubAllGlobals());

describe("store artwork", () => {
  it("reads Google Play's image metadata and rejects artwork from other hosts", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('<meta property="og:image" content="https://play-lh.googleusercontent.com/app-icon=s512">'))
      .mockResolvedValueOnce(new Response('<meta property="og:image" content="https://evil.example/icon.png">'));
    vi.stubGlobal("fetch", fetchMock);
    const listing = "https://play.google.com/store/apps/details?id=com.example.game";
    expect(await getStoreIcon(listing)).toBe("https://play-lh.googleusercontent.com/app-icon=s512");
    expect(await getStoreIcon(listing)).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(listing, expect.objectContaining({ redirect: "error" }));
  });

  it("uses Apple's listing ID and artwork from the lookup result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [{ artworkUrl512: "https://is1-ssl.mzstatic.com/image/thumb/example/512x512bb.png" }],
    })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await getStoreIcon("https://apps.apple.com/vn/app/example/id284882215")).toBe("https://is1-ssl.mzstatic.com/image/thumb/example/512x512bb.png");
    expect(fetchMock.mock.calls[0][0]).toBe("https://itunes.apple.com/lookup?id=284882215&country=vn");
  });
});
