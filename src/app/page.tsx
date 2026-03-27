"use client";

import { useEffect, useState } from "react";
import { Group } from "@/lib/types";
import Link from "next/link";
import Bee from "@/components/Bee";

export default function HomePage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchGroups();
  }, []);

  async function fetchGroups() {
    try {
      const res = await fetch("/api/groups");
      const data = await res.json();
      setGroups(data);
    } catch {
      setError("Failed to load groups");
    } finally {
      setLoading(false);
    }
  }

  async function createGroup() {
    if (!newGroupName.trim()) return;
    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setGroups([...groups, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewGroupName("");
      setShowCreate(false);
    } catch {
      setError("Failed to create group");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with Bee */}
      <div className="text-center pt-2">
        <div className="animate-float inline-block">
          <Bee size={100} />
        </div>
        <h1 className="text-5xl font-black title-gradient mt-2">
          Spelling Bee
        </h1>
        <p className="mt-2 text-lg font-semibold text-amber-700">
          Buzz into your spellings! 🍯
        </p>
      </div>

      {/* Group List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-amber-200 border-t-amber-500" />
          <p className="mt-3 text-amber-600 font-semibold">Loading hive...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group, idx) => (
            <Link
              key={group.id}
              href={`/group/${group.id}`}
              className="animate-slide-up block fun-card hover:border-purple-300 hover:shadow-xl transition-all group"
              style={{ animationDelay: `${idx * 0.1}s` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">
                    {["🐝", "🍯", "🌻", "⭐", "🌈", "🎨", "🦋", "🌸"][idx % 8]}
                  </span>
                  <span className="text-xl font-bold text-purple-700 group-hover:text-purple-600 transition-colors">
                    {group.name}
                  </span>
                </div>
                <span className="text-2xl transition-transform group-hover:translate-x-1">
                  ➜
                </span>
              </div>
            </Link>
          ))}

          {groups.length === 0 && !showCreate && (
            <div className="fun-card text-center py-6 animate-pop-in">
              <p className="text-4xl mb-3">🌟</p>
              <p className="text-lg font-semibold text-purple-700">
                Welcome to Spelling Bee!
              </p>
              <p className="text-gray-500 mt-1">
                Create your first spelling group to get started
              </p>
            </div>
          )}
        </div>
      )}

      {/* Create Group */}
      {!showCreate ? (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full rounded-2xl border-3 border-dashed border-amber-300 bg-amber-50/50 p-5 font-bold text-amber-700 hover:bg-amber-100/70 hover:border-amber-400 transition-all text-lg"
        >
          🍯 Add a new spelling group
        </button>
      ) : (
        <div className="fun-card space-y-4 animate-pop-in">
          <h3 className="text-lg font-bold text-purple-700">
            🐝 New Spelling Group
          </h3>
          <label className="block text-sm font-semibold text-gray-600">
            What&apos;s the group called?
          </label>
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createGroup()}
            placeholder='e.g. "PENS (TMA)"'
            className="w-full rounded-2xl border-2 border-amber-200 bg-amber-50/50 px-4 py-3 text-lg font-semibold focus:border-purple-400 focus:bg-white focus:outline-none transition-all"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={createGroup}
              disabled={creating || !newGroupName.trim()}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Group ✨"}
            </button>
            <button
              onClick={() => {
                setShowCreate(false);
                setNewGroupName("");
              }}
              className="rounded-2xl bg-gray-100 px-5 py-3 font-bold text-gray-500 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-50 border-2 border-red-200 p-4 text-red-700 text-center font-semibold animate-pop-in">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline text-sm">
            dismiss
          </button>
        </div>
      )}
    </div>
  );
}
