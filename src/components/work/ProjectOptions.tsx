"use client";

import { useEffect, useState } from "react";
import { groupProjectsByClient } from "@/lib/work/client-groups";
import { api, type Client, type Project } from "./types";

// プロジェクトの選択肢を、クライアントごとの見出し（optgroup）に分けて出す。<select> の中に置いて使う
export default function ProjectOptions({ projects }: { projects: Project[] }) {
  const [clients, setClients] = useState<Client[] | null>(null);
  useEffect(() => {
    let alive = true;
    // 編集画面を開くたびに読み込む（追加したばかりのクライアントも見出しに出るように）
    api<Client[]>("/api/work/clients")
      .then((c) => alive && setClients(c))
      .catch(() => alive && setClients([]));
    return () => {
      alive = false;
    };
  }, []);

  // 読み込むまでは見出しなしで並べる
  if (!clients) {
    return (
      <>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </>
    );
  }
  return (
    <>
      {groupProjectsByClient(projects, clients).map((g) => (
        <optgroup key={g.clientId ?? "other"} label={g.label}>
          {g.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
