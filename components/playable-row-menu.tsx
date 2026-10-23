"use client";
import Link from "next/link";
import { Download, ExternalLink, MoreHorizontal, PanelRightOpen } from "lucide-react";
import type { Playable } from "@/lib/types";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
export function PlayableRowMenu({ playable, href }: { playable: Playable; href: string }) { return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Thao tác với ${playable.name}`}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><Link href={href} scroll={false}><PanelRightOpen />Xem chi tiết</Link></DropdownMenuItem>{playable.storage_path && <DropdownMenuItem asChild><a href={`/api/files/${playable.id}`}><Download />Tải file</a></DropdownMenuItem>}{playable.external_url && <DropdownMenuItem asChild><a href={playable.external_url} target="_blank" rel="noopener noreferrer"><ExternalLink />Mở URL</a></DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>; }
