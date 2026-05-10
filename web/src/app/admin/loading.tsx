// Suspense fallback for every /admin/* route. Without this, tapping a tab
// in AdminNav blocks the URL/layout swap until the server roundtrip
// (force-dynamic + cache:no-store admin endpoints) returns — which felt
// like 200–800ms of "click lag" with no visual change. With a loading.tsx
// at this level, Next swaps to this skeleton instantly on tap, the layout
// re-renders with the new pathname (so the active tab highlights
// immediately), and the data streams in once it's ready.
//
// Kept deliberately generic — this single file covers Today, Inbox, Posts,
// Campaigns, Channels, Orders, Customers, Careers, Checkouts, Escalations,
// Settings. The shapes don't all match perfectly (Today is stat-cards;
// Inbox is a list; Settings is a form) but the placeholder reads as
// "we're loading" without being so opinionated it implies the wrong
// layout.
export default function AdminLoading() {
  return (
    <div className="animate-pulse">
      {/* Stat-card row — matches Today's 4-up layout, also reads fine
          as a generic header band for list pages. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-md p-5 border bg-cream-100 border-cocoa-700/10">
            <div className="h-3 w-24 rounded bg-cocoa-700/10" />
            <div className="h-8 w-16 mt-3 rounded bg-cocoa-700/15" />
          </div>
        ))}
      </div>

      {/* Section heading + body skeleton — covers the "Recent orders" /
          list-table half of most pages. */}
      <div className="mt-10">
        <div className="h-5 w-40 rounded bg-cocoa-700/15 mb-4" />
        <div className="rounded-md border border-cocoa-700/10 bg-cream-100/60 divide-y divide-cocoa-700/10 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-4 flex items-center gap-4">
              <div className="h-3 w-20 rounded bg-cocoa-700/15" />
              <div className="h-3 flex-1 rounded bg-cocoa-700/10" />
              <div className="h-6 w-20 rounded bg-cocoa-700/15" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
