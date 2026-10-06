"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import ProjectOptions from "@/components/work/ProjectOptions";
import { api, type Client, type GithubRepo, type Project } from "@/components/work/types";
import PageTitle from "@/components/PageTitle";

type Status = { configured: boolean; login?: string; error?: string };
type SyncResult = { repos: { fullName: string; created: number; updated: number; error?: string }[] };

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

// GitHub 連携：リポジトリの一覧と、Issue をタスクに同期する設定
export default function WorkGithubPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"repos" | "sync" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, r, p, c] = await Promise.all([
        api<Status>("/api/work/github/status"),
        api<GithubRepo[]>("/api/work/github/repos"),
        api<Project[]>("/api/work/projects"),
        api<Client[]>("/api/work/clients"),
      ]);
      setProjects(p);
      setClients(c);
      setStatus(s);
      setRepos(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refreshRepos = async () => {
    setBusy("repos");
    setError(null);
    setMessage(null);
    try {
      const r = await api<GithubRepo[]>("/api/work/github/repos", { method: "POST" });
      setRepos(r);
      setMessage(`${r.length} 件のリポジトリを取得しました`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const toggleSync = async (repo: GithubRepo) => {
    setError(null);
    setRepos((rs) => rs.map((r) => (r.id === repo.id ? { ...r, syncIssues: !r.syncIssues } : r)));
    try {
      await api(`/api/work/github/repos/${repo.id}`, { method: "PATCH", body: JSON.stringify({ syncIssues: !repo.syncIssues }) });
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  };

  // リポジトリをプロジェクトに紐づける（取り込み済みで未分類のタスクも、そのプロジェクトに入る）
  const setProject = async (repo: GithubRepo, projectId: string) => {
    setError(null);
    setMessage(null);
    setRepos((rs) => rs.map((r) => (r.id === repo.id ? { ...r, projectId: projectId || null } : r)));
    try {
      const res = await api<{ movedTaskCount: number }>(`/api/work/github/repos/${repo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ projectId: projectId || null }),
      });
      if (res.movedTaskCount > 0) setMessage(`${repo.fullName} のタスク ${res.movedTaskCount} 件をプロジェクトに入れました`);
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  };

  const sync = async () => {
    setBusy("sync");
    setError(null);
    setMessage(null);
    try {
      const r = await api<SyncResult>("/api/work/github/sync", { method: "POST" });
      const failed = r.repos.filter((x) => x.error);
      const created = r.repos.reduce((s, x) => s + x.created, 0);
      const updated = r.repos.reduce((s, x) => s + x.updated, 0);
      setMessage(`同期しました：新しいタスク ${created} 件、更新 ${updated} 件`);
      if (failed.length) setError(failed.map((x) => `${x.fullName}：${x.error}`).join("\n"));
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="text-center text-app-sub py-10">読み込み中...</div>;

  const synced = repos.filter((r) => r.syncIssues);
  const others = repos.filter((r) => !r.syncIssues && (showAll || !r.isArchived));

  return (
    <div className="flex flex-col gap-3">
      <PageTitle>GitHub 連携</PageTitle>

      {/* 接続状態 */}
      <Card className="!p-4">
        {!status?.configured ? (
          <div className="text-sm text-app-text">
            <div className="font-bold mb-1">まだ設定されていません</div>
            <div className="text-xs text-app-sub leading-relaxed">
              GitHub で Fine-grained Personal Access Token を発行し、Vercel の環境変数 <code>GITHUB_TOKEN</code> に登録してください（権限: Metadata 読み取り、Issues 読み書き、Pull requests 読み取り）。
            </div>
          </div>
        ) : status.error ? (
          <div className="text-sm text-danger">{status.error}</div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <Badge type="success">接続中</Badge>
            <span className="text-app-text">{status.login}</span>
          </div>
        )}
      </Card>

      {status?.configured && !status.error && (
        <div className="flex gap-2">
          <button
            onClick={refreshRepos}
            disabled={busy !== null}
            className="flex-1 py-2.5 rounded border border-primary text-primary text-sm font-bold bg-white cursor-pointer disabled:opacity-50"
          >
            {busy === "repos" ? "取得中…" : "リポジトリを取得"}
          </button>
          <button
            onClick={sync}
            disabled={busy !== null || synced.length === 0}
            className="flex-1 py-2.5 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50"
          >
            {busy === "sync" ? "同期中…" : "Issue を同期"}
          </button>
        </div>
      )}

      {message && <div className="text-sm text-primary-dark bg-primary-light rounded p-3">{message}</div>}
      {error && <div className="text-sm text-danger bg-danger-light rounded p-3 whitespace-pre-wrap">{error}</div>}

      {[
        { title: `同期するリポジトリ（${synced.length}）`, items: synced, empty: "「同期する」をオンにすると、そのリポジトリの open の Issue がタスクに入ります" },
        { title: "その他のリポジトリ", items: others, empty: repos.length === 0 ? "「リポジトリを取得」を押してください" : "ありません" },
      ].map((g) => (
        <Card key={g.title} className="!p-4">
          <div className="text-xs font-bold text-app-sub mb-1">{g.title}</div>
          {g.items.length === 0 ? (
            <div className="text-xs text-app-sub py-2">{g.empty}</div>
          ) : (
            g.items.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-app-border last:border-b-0">
                <div className="flex-1 min-w-0">
                  <a href={r.htmlUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-app-text no-underline break-all">
                    {r.fullName}
                  </a>
                  <div className="flex flex-wrap gap-1.5 mt-1 text-[11px] text-app-sub">
                    {r.isPrivate && <Badge type="default">非公開</Badge>}
                    {r.isArchived && <Badge type="default">アーカイブ</Badge>}
                    {r.syncIssues && (
                      <span>
                        Issue {r.openIssuesCount} ・ PR {r.openPrCount} ・ 最終同期 {when(r.lastSyncedAt)}
                      </span>
                    )}
                    {!r.syncIssues && <span>最終 push {when(r.pushedAt)}</span>}
                  </div>
                </div>
                <select
                  aria-label={`${r.fullName} を紐づけるプロジェクト`}
                  value={r.projectId ?? ""}
                  onChange={(e) => setProject(r, e.target.value)}
                  className="shrink-0 max-w-[40%] p-1.5 rounded-lg border border-app-border text-xs bg-white"
                >
                  <option value="">プロジェクトなし</option>
                  <ProjectOptions
                    projects={projects.filter((p) => p.status === "active" || p.status === "on_hold" || p.id === r.projectId)}
                    clients={clients}
                  />
                </select>
                <label className="flex items-center gap-1.5 text-xs text-app-text cursor-pointer shrink-0">
                  <input type="checkbox" checked={r.syncIssues} onChange={() => toggleSync(r)} className="w-4 h-4 accent-primary" />
                  同期する
                </label>
              </div>
            ))
          )}
        </Card>
      ))}

      {repos.some((r) => r.isArchived) && (
        <button onClick={() => setShowAll((v) => !v)} className="text-xs text-primary bg-transparent border-none cursor-pointer">
          {showAll ? "アーカイブ済みを隠す" : "アーカイブ済みのリポジトリも表示"}
        </button>
      )}

      <Link href="/admin/work/projects" className="text-xs text-primary text-center">取り込んだタスクを見る →</Link>
    </div>
  );
}
