"use client";

import { useEffect, useState } from "react";
import { groupProjectsByClient, groupTasksForSelect } from "@/lib/work/client-groups";
import { api, type Client, type Project, type Task } from "./types";

// 編集画面を開くたびにクライアント一覧を読み込む（追加したばかりのクライアントも見出しに出るように）。
// 呼び出し側で読み込み済みなら given を渡すと、読み込みを省く
function useClients(given?: Client[]): Client[] | null {
  const [clients, setClients] = useState<Client[] | null>(given ?? null);
  useEffect(() => {
    if (given) {
      setClients(given);
      return;
    }
    let alive = true;
    api<Client[]>("/api/work/clients")
      .then((c) => alive && setClients(c))
      .catch(() => alive && setClients([]));
    return () => {
      alive = false;
    };
  }, [given]);
  return clients;
}

// タスクの選択肢を「クライアント ／ プロジェクト」の見出し（optgroup）に分けて出す。<select> の中に置いて使う
export function TaskOptions({ tasks, projects }: { tasks: Task[]; projects: Project[] }) {
  const clients = useClients();
  if (!clients) {
    return (
      <>
        {tasks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </>
    );
  }
  return (
    <>
      {groupTasksForSelect(tasks, projects, clients).map((g) => (
        <optgroup key={g.key} label={g.label}>
          {g.tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

// プロジェクトの選択肢を、クライアントごとの見出し（optgroup）に分けて出す。<select> の中に置いて使う
export default function ProjectOptions({ projects, clients: given }: { projects: Project[]; clients?: Client[] }) {
  const clients = useClients(given);

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
