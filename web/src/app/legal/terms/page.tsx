export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <div className="frame prose">
      <h1>Terms</h1>
      <p className="notice">
        Draft. This text hasn&apos;t had legal review, and the operator&apos;s details are still to be added.
      </p>
      <h2>What ATTO is</h2>
      <p>
        ATTO reports what a rented NEAR name is connected to, and offers an escrow contract that clears certain
        connections during a sale.
      </p>
      <h2>What the escrow does</h2>
      <p>
        The escrow runs by public rules on the blockchain. It has no admin, and ATTO&apos;s builders can&apos;t move
        what it holds. It clears NEAR Intents keys and approvals on the NFTs listed in the accepted report, and nothing
        else.
      </p>
      <h2>What a report can miss</h2>
      <ul>
        <li>Title Search reads public data through services that may not have seen everything a name has used.</li>
        <li>Sub-accounts and DAO roles are reported, not removed. Only their holders can change them.</li>
        <li>An NFT program can report something untrue about its own approvals.</li>
      </ul>
      <p>Read the report before you pay. You decide whether to accept what stays with the name.</p>
      <h2>Money in a sale</h2>
      <p>
        The name&apos;s NEAR goes to the seller at handover. ATTO charges no fee. Blockchain transactions can&apos;t be
        undone once they complete, except as the escrow&apos;s rules allow.
      </p>
      <h2>No advice</h2>
      <p>ATTO doesn&apos;t give financial or legal advice, and doesn&apos;t say what a name is worth.</p>
    </div>
  );
}
