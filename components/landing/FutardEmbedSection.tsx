'use client';

import React from 'react';

export const FUTARD_LAUNCH_URL =
  'https://www.futard.io/launch/2aJ7mzSagAVYr1hYFgJAYHCoDLbvkjTtRRe44knWidRc';

/**
 * In-page Futard launch embed. Many sites send X-Frame-Options / CSP that block iframes;
 * if the frame stays blank, users can open the launch in a new tab from the link below.
 */
export default function FutardEmbedSection() {
  return (
    <section className="futard-embed-section">
      <div className="section-content futard-embed-content">
        <div className="futard-embed-header">
          <div className="futard-embed-kicker">
            <span className="futard-embed-kicker-dot" />
            Fundraising · Futard
          </div>
          <div className="futard-embed-title-row">
            <h2 className="futard-embed-title">
              Bynomo on <span className="futard-embed-title-muted">Futard.io</span>
            </h2>
            <a
              className="futard-embed-cta"
              href={FUTARD_LAUNCH_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open launch
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
          </div>
          <p className="futard-embed-subtitle">
            Live raise page on Futard (Solana launchpad). If the embed does not load, the host may
            block framing — use &quot;Open launch&quot;.
          </p>
        </div>

        <div className="futard-embed-frame">
          <iframe
            src={FUTARD_LAUNCH_URL}
            title="Bynomo fundraising launch on Futard"
            loading="lazy"
            referrerPolicy="no-referrer"
            allow="clipboard-write; fullscreen"
          />
        </div>
      </div>
    </section>
  );
}
