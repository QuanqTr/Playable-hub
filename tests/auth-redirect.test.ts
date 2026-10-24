import { describe, expect, it, vi } from "vitest";
import { AUTH_REDIRECT_ERROR, completeAuthRedirect, hasAuthRedirectFragment, parseAuthRedirect } from "../lib/auth-redirect";

const fragment = "#access_token=header.payload.signature&refresh_token=refresh-token_123&type=invite&expires_in=3600";

describe("Liên kết email mặc định của Supabase", () => {
  it("chỉ tiếp nhận phiên invite và recovery có đủ hai token", () => {
    expect(parseAuthRedirect(fragment)).toMatchObject({ kind: "tokens", type: "invite", accessToken: "header.payload.signature", refreshToken: "refresh-token_123" });
    expect(parseAuthRedirect(fragment.replace("type=invite", "type=recovery"))).toMatchObject({ kind: "tokens", type: "recovery" });
    for (const type of ["signup", "magiclink", "email_change", "", "unexpected"]) {
      expect(parseAuthRedirect(fragment.replace("type=invite", `type=${type}`))).toEqual({ kind: "error" });
    }
  });

  it("bỏ qua anchor thông thường nhưng phát hiện cả lỗi xác thực", () => {
    for (const anchor of ["", "#main-content", "#project-details", "#type=invite"]) {
      expect(hasAuthRedirectFragment(anchor)).toBe(false);
      expect(parseAuthRedirect(anchor)).toEqual({ kind: "none" });
    }
    expect(hasAuthRedirectFragment("#error_description=private-data")).toBe(true);
    expect(parseAuthRedirect("#error=access_denied&error_description=private-data")).toEqual({ kind: "error" });
    expect(AUTH_REDIRECT_ERROR).not.toContain("private-data");
  });

  it("từ chối token thiếu, trùng, sai định dạng hoặc vượt giới hạn", () => {
    for (const invalid of [
      "#access_token=header.payload.signature&type=invite",
      "#refresh_token=refresh-token&type=invite",
      fragment.replace("refresh-token_123", ""),
      fragment.replace("header.payload.signature", "not-a-jwt"),
      fragment.replace("refresh-token_123", "bad%0Atoken"),
      fragment.replace("refresh-token_123", "bad%ZZtoken"),
      fragment.replace("refresh-token_123", "bad+token"),
      `${fragment}&access_token=another.payload.signature`,
      `${fragment}&type=recovery`,
      fragment.replace("refresh-token_123", "x".repeat(4_097)),
      fragment.replace("header.payload.signature", `header.${"x".repeat(16_384)}.signature`),
      `${fragment}&padding=${"x".repeat(32_768)}`,
    ]) expect(parseAuthRedirect(invalid)).toEqual({ kind: "error" });
  });

  it("chỉ thành công sau khi setSession và xác minh user từ Auth", async () => {
    const order: string[] = [];
    const auth = {
      setSession: vi.fn(async () => { order.push("session"); return { error: null }; }),
      getUser: vi.fn(async () => { order.push("verified-user"); return { data: { user: { id: "verified" } }, error: null }; }),
      signOut: vi.fn(async () => ({ error: null })),
    };
    expect(await completeAuthRedirect(auth, parseAuthRedirect(fragment))).toBe(true);
    expect(order).toEqual(["session", "verified-user"]);
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: "header.payload.signature", refresh_token: "refresh-token_123" });
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("token bị từ chối không bao giờ được coi là đã đăng nhập", async () => {
    const auth = {
      setSession: vi.fn(async () => ({ error: new Error("secret-token") })),
      getUser: vi.fn(async () => ({ data: { user: { id: "unverified" } }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    };
    expect(await completeAuthRedirect(auth, parseAuthRedirect(fragment))).toBe(false);
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(await completeAuthRedirect(auth, { kind: "error" })).toBe(false);
    expect(auth.setSession).toHaveBeenCalledTimes(1);
  });

  it("xóa phiên cục bộ khi không xác minh được user và che lỗi upstream", async () => {
    const auth = {
      setSession: vi.fn(async () => ({ error: null })),
      getUser: vi.fn(async () => ({ data: { user: null }, error: new Error("private-user-data") })),
      signOut: vi.fn(async () => ({ error: null })),
    };
    expect(await completeAuthRedirect(auth, parseAuthRedirect(fragment))).toBe(false);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    auth.getUser.mockRejectedValueOnce(new Error("private-user-data"));
    expect(await completeAuthRedirect(auth, parseAuthRedirect(fragment))).toBe(false);
    expect(AUTH_REDIRECT_ERROR).not.toContain("private-user-data");
  });
});
