import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLookups, getPlayable, getPlayables } from "@/lib/data";
import { readFilters, selectedPlayable, type SearchParams } from "@/lib/search";
import { queryHref } from "@/lib/utils";
import { PlayableList } from "@/components/playable-list";
import { PlayableForm } from "@/components/playable-form";
import { PlayablePanel } from "@/components/playable-panel";
export const metadata: Metadata = { title: "Kho playable" };
export default async function PlayablesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = readFilters(params);
  const id = selectedPlayable(params);
  const [result, lookups, playable] = await Promise.all([getPlayables(filters), getLookups(), id ? getPlayable(id) : null]);
  if (id && !playable) notFound();
  return <><div className="page-heading"><div><h1>Kho playable</h1><p className="page-description">Tất cả playable đã triển khai. Dễ tìm kiếm, theo dõi và chia sẻ.</p></div><PlayableForm lookups={lookups} /></div><PlayableList result={result} lookups={lookups} filters={filters} path="/playables" /><p className="text-[10px] text-[#9ca6b0] mt-5">Mỗi bản ghi là một build đã triển khai. Mức độ win do thành viên đánh giá.</p>{playable && <PlayablePanel key={playable.id} playable={playable} lookups={lookups} closeHref={queryHref("/playables", { ...filters }, { playable: null })} />}</>;
}
