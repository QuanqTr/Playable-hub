import { redirect } from "next/navigation";
export default async function DirectPlayable({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; redirect(`/playables?playable=${encodeURIComponent(id)}`); }
