export const metadata = { title: "Cookies" };

export default function CookiesPage() {
  return (
    <div className="frame prose">
      <h1>Cookies</h1>
      <p className="notice">Draft. This text hasn&apos;t had legal review.</p>
      <p>ATTO sets no cookies for tracking or advertising.</p>
      <h2>What&apos;s stored in your browser</h2>
      <ul>
        <li>
          <code>atto-consent</code> remembers that you&apos;ve seen the cookie notice.
        </li>
        <li>
          <code>atto-persona</code> remembers who you&apos;re acting as in the mock demo. It goes away with the mock.
        </li>
      </ul>
      <p>Both live in your browser&apos;s local storage, and you can clear them at any time in your browser settings.</p>
      <p>Your wallet may store its own connection details once real wallets are connected. That&apos;s covered by your wallet&apos;s own policy.</p>
    </div>
  );
}
