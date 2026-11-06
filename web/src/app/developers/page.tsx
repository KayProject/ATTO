export const metadata = { title: "Developers" };

export default function DevelopersPage() {
  return (
    <div className="frame prose">
      <h1>Check a name before your users pay it</h1>
      <p>
        Two public endpoints, with no key needed. They currently answer from mock data, and each response carries an{" "}
        <code>x-atto-data: mock</code> header until the real history store is connected.
      </p>

      <h2>Has this name changed owner?</h2>
      <p>
        <code>days</code> is optional, from 1 to 3650, and defaults to 7.
      </p>
      <pre>{`GET /api/v1/names/corner.cafe/changed?days=7

{
  "changed": true,
  "at": "2026-11-04T12:00:00.000Z",
  "kind": "re_rented",
  "previous_owner": "firsttenant.near"
}`}</pre>
      <p>When nothing changed inside the window:</p>
      <pre>{`{ "changed": false }`}</pre>
      <p>
        <code>kind</code> is one of <code>transferred</code>, <code>sold_clean</code>, <code>reclaimed</code> or{" "}
        <code>re_rented</code>. Renewals don&apos;t count as a change of owner.
      </p>

      <h2>What has happened to this name?</h2>
      <p>Returns every recorded event, newest first.</p>
      <pre>{`GET /api/v1/names/corner.cafe/history

[
  {
    "id": 6,
    "token_id": "corner.cafe",
    "kind": "re_rented",
    "from_owner": "firsttenant.near",
    "to_owner": "newtenant.near",
    "block_time": "2026-11-04T12:00:00.000Z",
    "tx_hash": "mock-tx-6"
  }
]`}</pre>

      <h2>Errors</h2>
      <p>
        An unknown name returns <code>404</code>. An invalid <code>days</code> returns <code>400</code>. Both have a body of{" "}
        <code>{`{ "error": "..." }`}</code>.
      </p>
    </div>
  );
}
