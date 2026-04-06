'use client';

import { useState } from 'react';
import { TopPost, formatSats } from './types';

interface PostPerformanceProps {
  posts: TopPost[];
}

type SortKey = 'totalSats' | 'zapCount' | 'avgZap';
type SortDir = 'asc' | 'desc';

export function PostPerformance({ posts }: PostPerformanceProps) {
  const [sortKey, setSortKey] = useState<SortKey>('totalSats');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (posts.length === 0) {
    return (
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 16, color: 'var(--text-secondary)' }}>
          Post Performance
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 20 }}>
          No posts yet
        </p>
      </div>
    );
  }

  const enriched = posts.map((p) => ({
    ...p,
    avgZap: p.zapCount > 0 ? Math.round(p.totalSats / p.zapCount) : 0,
  }));

  const sorted = [...enriched].sort((a, b) => {
    const mult = sortDir === 'desc' ? -1 : 1;
    return mult * (a[sortKey] - b[sortKey]);
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'desc' ? ' ↓' : ' ↑';
  };

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, marginBottom: 16, color: 'var(--text-secondary)' }}>
        Post Performance
      </h2>

      {/* Header row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 100px 80px 90px',
        gap: 8, padding: '8px 0', borderBottom: '2px solid var(--border-color)',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Post</span>
        <SortButton label="Sats" sortKey="totalSats" current={sortKey} arrow={sortArrow('totalSats')} onClick={handleSort} />
        <SortButton label="Zaps" sortKey="zapCount" current={sortKey} arrow={sortArrow('zapCount')} onClick={handleSort} />
        <SortButton label="Avg Size" sortKey="avgZap" current={sortKey} arrow={sortArrow('avgZap')} onClick={handleSort} />
      </div>

      {/* Rows */}
      {sorted.map((post, i) => {
        const isExpanded = expandedId === post.postId;
        const content = post.content?.content || '';
        const preview = content.slice(0, 60) + (content.length > 60 ? '...' : '');

        return (
          <div key={post.postId || i}>
            <div
              onClick={() => setExpandedId(isExpanded ? null : post.postId)}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 100px 80px 90px',
                gap: 8, padding: '10px 0', borderBottom: '1px solid var(--border-color)',
                cursor: 'pointer',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{
                  fontSize: 13, color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {preview || `${post.postId?.slice(0, 12)}...`}
                </p>
              </div>
              <span style={{ fontSize: 13, color: 'var(--zap-gold)', fontWeight: 600, textAlign: 'right' }}>
                {formatSats(post.totalSats)}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right' }}>
                {post.zapCount}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right' }}>
                {formatSats(post.avgZap)}
              </span>
            </div>

            {/* Expanded content */}
            {isExpanded && post.content && (
              <div style={{
                padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: 8,
                margin: '4px 0 8px', borderLeft: '3px solid var(--zap-gold)',
              }}>
                <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {post.content.content}
                </p>
                {post.content.images && (post.content.images as string[]).length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {(post.content.images as string[]).slice(0, 3).map((url, j) => (
                      <img
                        key={j}
                        src={url}
                        alt=""
                        style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-color)' }}
                      />
                    ))}
                  </div>
                )}
                <a
                  href={`https://primal.net/e/${post.postId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: 'var(--zap-blue)', marginTop: 8, display: 'inline-block' }}
                >
                  View on Primal →
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SortButton({ label, sortKey, current, arrow, onClick }: {
  label: string; sortKey: SortKey; current: SortKey; arrow: string;
  onClick: (key: SortKey) => void;
}) {
  return (
    <button
      onClick={() => onClick(sortKey)}
      style={{
        fontSize: 12, fontWeight: 600, textAlign: 'right',
        color: current === sortKey ? 'var(--zap-gold)' : 'var(--text-muted)',
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      }}
    >
      {label}{arrow}
    </button>
  );
}
