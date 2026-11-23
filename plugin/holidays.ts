import { requestUrl } from "obsidian";

// 日本の祝日。holidays-jp の API から前年〜翌年の分を { "2026-01-01": "元日", ... } で取る。
// 起動中は 1 回だけ取りにいき、失敗したら（オフラインなど）祝日なしで描いて、次に描くときにまた取りにいく
const URL = "https://holidays-jp.github.io/api/v1/date.json";
let cache: Promise<Record<string, string>> | null = null;

export function holidays(): Promise<Record<string, string>> {
  cache ??= requestUrl(URL)
    .then((r) => r.json as Record<string, string>)
    .catch(() => {
      cache = null;
      return {};
    });
  return cache;
}
