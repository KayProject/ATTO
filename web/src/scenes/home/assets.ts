// Image layers the home scenes are built from: glass objects and pencil-drawn people.
export const GLASS = (name: GlassName) => `/glass/${name}.webp`;
export const PENCIL = (name: PencilName) => `/pencil/${name}.webp`;

export type GlassName =
  | "arch" | "coin" | "key" | "mode-switch" | "nft-frame" | "plate-paper" | "scissors-closed" | "scissors-open"
  | "seal" | "stamp" | "subaccount-tag" | "tag-clean" | "tag-cloudy" | "vault";

export type PencilName =
  | "buyer-walk-a" | "buyer-walk-b" | "buyer-wave" | "crowd-sit" | "man-arms" | "man-body"
  | "seller-walk-a" | "seller-walk-b" | "woman-arm-scissors" | "woman-body";
