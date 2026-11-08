import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Custom root HTML template for static web exports and PWA setup.
 * Runs during build-time static rendering.
 */
export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>Time Management App</title>
        <meta name="description" content="Modern daily and weekly routine timetable and task management app" />
        <meta name="theme-color" content="#1F2937" />

        {/* Apple iOS web app meta */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Timetable" />

        {/* PWA Manifest and Icons */}
        <link rel="manifest" href="/Task-managment-app-or-website/manifest.json" />
        <link rel="icon" type="image/png" href="/Task-managment-app-or-website/favicon.png" />
        <link rel="apple-touch-icon" href="/Task-managment-app-or-website/icons/icon-192.png" />

        <ScrollViewStyleReset />

        {/* Safe Service Worker Registration for PWA */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/Task-managment-app-or-website/sw.js')
                    .then(function(reg) {
                      console.log('[PWA] ServiceWorker registered successfully, scope:', reg.scope);
                    })
                    .catch(function(err) {
                      console.warn('[PWA] ServiceWorker registration warning:', err);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

