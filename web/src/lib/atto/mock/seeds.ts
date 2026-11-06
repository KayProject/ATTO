// Fictional names and accounts for the mock. Nothing here exists on any network.
import type { HistoryKind } from "../types";

export const PERSONAS = {
  seller: { account: "maya.near", label: "Seller" },
  buyer: { account: "tobi.near", label: "Buyer" },
  owner: { account: "ife.near", label: "Owner" },
  stranger: { account: "guest.near", label: "Stranger" },
} as const;
export type PersonaKey = keyof typeof PERSONAS;

export const ESCROW_ACCOUNT = "escrow.atto.near";

const SELLER = PERSONAS.seller.account;
const OWNER = PERSONAS.owner.account;

export interface NameSeed {
  token_id: string;
  owner: string;
  owner_since_days: number;
  lease_days: number;
  rent_near: string;
  wallet_near: string;
  intents_balances: { token_id: string; amount: string }[];
  intents_keys: { key: string; before_owner: boolean }[];
  signed_only?: boolean;
  nfts: { contract_id: string; token_id: string; approved: string[] }[];
  dao_roles: { dao: string; role: string; can: string }[];
  sub_accounts: { account: string; keys: number }[];
  business_reason?: string;
  /** "drain": a held key empties Intents before it is cleared. "changed": a new key appears by the handover. */
  scenario?: "drain" | "changed";
  reserve?: { balance_near: string; enabled: boolean; share_bps: number };
  history: { kind: HistoryKind; days_ago: number; from: string | null; to: string | null; note?: string }[];
}

const KEY_A = "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp";
const KEY_B = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
export const LATE_KEY = KEY_B;

const plain = {
  intents_balances: [],
  intents_keys: [],
  nfts: [],
  dao_roles: [],
  sub_accounts: [],
};

export const SEEDS: NameSeed[] = [
  {
    // Same manifest as the "dirty" test vector in packages/shared/vectors/manifest.json.
    token_id: "bakery.food",
    owner: SELLER,
    owner_since_days: 240,
    lease_days: 190,
    rent_near: "12",
    wallet_near: "4.2",
    intents_balances: [{ token_id: "nep141:wrap.near", amount: "2500000000000000000000000" }],
    intents_keys: [{ key: KEY_A, before_owner: false }],
    nfts: [{ contract_id: "art.near", token_id: "17", approved: ["maya-alt.near"] }],
    dao_roles: [],
    sub_accounts: [{ account: "shop.bakery.food", keys: 1 }],
    history: [{ kind: "minted", days_ago: 240, from: null, to: SELLER }],
  },
  {
    // Same manifest as the "empty" test vector.
    ...plain,
    token_id: "clean.pay",
    owner: SELLER,
    owner_since_days: 90,
    lease_days: 275,
    rent_near: "8",
    wallet_near: "0.6",
    history: [{ kind: "minted", days_ago: 90, from: null, to: SELLER }],
  },
  {
    ...plain,
    token_id: "tea.shop",
    owner: SELLER,
    owner_since_days: 120,
    lease_days: 245,
    rent_near: "9",
    wallet_near: "1.1",
    intents_balances: [{ token_id: "nep141:wrap.near", amount: "7000000000000000000000000" }],
    intents_keys: [{ key: KEY_A, before_owner: false }],
    scenario: "drain",
    history: [{ kind: "minted", days_ago: 120, from: null, to: SELLER }],
  },
  {
    ...plain,
    token_id: "lamp.store",
    owner: SELLER,
    owner_since_days: 60,
    lease_days: 300,
    rent_near: "6",
    wallet_near: "0.9",
    intents_keys: [{ key: KEY_A, before_owner: false }],
    scenario: "changed",
    history: [{ kind: "minted", days_ago: 60, from: null, to: SELLER }],
  },
  {
    ...plain,
    token_id: "guild.food",
    owner: SELLER,
    owner_since_days: 300,
    lease_days: 65,
    rent_near: "15",
    wallet_near: "2",
    signed_only: true,
    dao_roles: [{ dao: "bakers.sputnik-dao.near", role: "council", can: "vote on and execute treasury proposals" }],
    history: [{ kind: "minted", days_ago: 300, from: null, to: SELLER }],
  },
  {
    ...plain,
    token_id: "acme.corp",
    owner: SELLER,
    owner_since_days: 45,
    lease_days: 320,
    rent_near: "30",
    wallet_near: "3",
    business_reason: "The owner of the .corp ending restricts resale, so a Clean Sale can't take this name.",
    history: [{ kind: "minted", days_ago: 45, from: null, to: SELLER }],
  },
  {
    ...plain,
    token_id: "lastweek.food",
    owner: SELLER,
    owner_since_days: 363,
    lease_days: 2,
    rent_near: "5",
    wallet_near: "0.2",
    history: [{ kind: "minted", days_ago: 363, from: null, to: SELLER }],
  },
  {
    ...plain,
    token_id: "corner.cafe",
    owner: "newtenant.near",
    owner_since_days: 2,
    lease_days: 363,
    rent_near: "10",
    wallet_near: "0.1",
    history: [
      { kind: "minted", days_ago: 500, from: null, to: "firsttenant.near" },
      { kind: "reclaimed", days_ago: 4, from: "firsttenant.near", to: null, note: "The lease and grace period ended." },
      { kind: "re_rented", days_ago: 2, from: "firsttenant.near", to: "newtenant.near" },
    ],
  },
  {
    ...plain,
    token_id: "harbor.pay",
    owner: OWNER,
    owner_since_days: 400,
    lease_days: 200,
    rent_near: "20",
    wallet_near: "6",
    reserve: { balance_near: "24", enabled: true, share_bps: 500 },
    history: [
      { kind: "minted", days_ago: 400, from: null, to: OWNER },
      { kind: "renewed_by_keeper", days_ago: 165, from: null, to: null },
    ],
  },
  {
    ...plain,
    token_id: "orchard.food",
    owner: OWNER,
    owner_since_days: 345,
    lease_days: 20,
    rent_near: "11",
    wallet_near: "1.4",
    reserve: { balance_near: "13", enabled: true, share_bps: 500 },
    history: [{ kind: "minted", days_ago: 345, from: null, to: OWNER }],
  },
  {
    ...plain,
    token_id: "sunrise.food",
    owner: OWNER,
    owner_since_days: 330,
    lease_days: 35,
    rent_near: "14",
    wallet_near: "0.8",
    reserve: { balance_near: "3.5", enabled: true, share_bps: 300 },
    history: [{ kind: "minted", days_ago: 330, from: null, to: OWNER }],
  },
  {
    ...plain,
    token_id: "quiet.pay",
    owner: OWNER,
    owner_since_days: 150,
    lease_days: 215,
    rent_near: "7",
    wallet_near: "0.3",
    history: [{ kind: "minted", days_ago: 150, from: null, to: OWNER }],
  },
];
