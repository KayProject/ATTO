export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <div className="frame prose">
      <h1>Privacy</h1>
      <p className="notice">
        Draft. This text hasn&apos;t had legal review, and the operator&apos;s details are still to be added.
      </p>
      <h2>No sign-up</h2>
      <p>ATTO has no accounts. You connect a NEAR wallet, and ATTO asks for no name, email or password.</p>
      <h2>What ATTO reads</h2>
      <p>
        Title Search and name history use public blockchain data. Anything you do on a blockchain is public and
        permanent, and ATTO can&apos;t remove it.
      </p>
      <h2>What stays in your browser</h2>
      <p>Your settings are stored in this browser and aren&apos;t sent to anyone. See the cookie policy.</p>
      <h2>What ATTO&apos;s servers see</h2>
      <p>
        Like most websites, the servers handle your IP address to answer requests and limit abuse of the public API.
      </p>
      <h2>Analytics</h2>
      <p>
        ATTO uses no advertising, no session replay and no cookie-based analytics. Fonts are served from ATTO&apos;s own
        domain.
      </p>
    </div>
  );
}
