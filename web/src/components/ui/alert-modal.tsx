"use client";
// Every alert and action response in ATTO opens as a modal, plus the sandbox wallet approval.
import * as DialogPrimitive from "@radix-ui/react-dialog";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { setApprover } from "@/lib/atto/client";
import { ArrowLeft, CaretRight, Copy, GasPump, Info, UserCircle } from "@phosphor-icons/react";

export type AlertTone = "done" | "bad" | "warn" | "escrow" | "key" | "info";

const ART: Record<AlertTone, string> = {
  done: "/glass/seal.webp",
  bad: "/glass/vault.webp",
  warn: "/glass/tag-cloudy.webp",
  escrow: "/glass/coin.webp",
  key: "/glass/key.webp",
  info: "/glass/stamp.webp",
};

export interface AlertAction {
  label: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
}

export interface AlertOptions {
  tone: AlertTone;
  title: string;
  body?: ReactNode;
  actions?: AlertAction[];
}

export interface ApprovalRequest {
  signer: string;
  receiver: string;
  method: string;
  deposit: string;
  summary: string;
  /** Set when the transaction sends an NFT rather than NEAR: the NFT's name. */
  asset?: string;
}

interface Queued extends AlertOptions {
  id: number;
  done: () => void;
}

interface AlertApi {
  alert: (options: AlertOptions) => Promise<void>;
  approve: (request: ApprovalRequest) => Promise<boolean>;
}

const AlertContext = createContext<AlertApi | null>(null);

export function useAlert() {
  const api = useContext(AlertContext);
  if (!api) throw new Error("useAlert needs AlertProvider.");
  return api;
}

/** Opens an alert once each time `key` changes to a non-null value. */
export function useAlertOnce(key: string | null, options: () => AlertOptions) {
  const { alert } = useAlert();
  const shown = useRef<string | null>(null);
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  useEffect(() => {
    if (key === null || shown.current === key) return;
    shown.current = key;
    void alert(latest.current());
  }, [key, alert]);
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Queued[]>([]);
  const [approval, setApproval] = useState<(ApprovalRequest & { answer: (ok: boolean) => void }) | null>(null);
  const next = useRef(0);

  const alert = useCallback(
    (options: AlertOptions) =>
      new Promise<void>((resolve) => {
        const id = next.current++;
        setQueue((q) => [...q, { ...options, id, done: resolve }]);
      }),
    [],
  );

  const approve = useCallback(
    (request: ApprovalRequest) =>
      new Promise<boolean>((resolve) => {
        setApproval({ ...request, answer: resolve });
      }),
    [],
  );

  useEffect(() => {
    setApprover(approve);
    return () => setApprover(null);
  }, [approve]);

  const current = queue[0];
  const close = () => {
    current?.done();
    setQueue((q) => q.slice(1));
  };

  return (
    <AlertContext.Provider value={{ alert, approve }}>
      {children}
      {current ? <AlertModal key={current.id} alert={current} onClose={close} /> : null}
      {approval ? (
        <WalletApproval
          request={approval}
          onAnswer={(ok) => {
            approval.answer(ok);
            setApproval(null);
          }}
        />
      ) : null}
    </AlertContext.Provider>
  );
}

function AlertModal({ alert, onClose }: { alert: Queued; onClose: () => void }) {
  const actions = alert.actions?.length ? alert.actions : [{ label: "Got it", primary: true }];
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="alert-overlay" />
        <DialogPrimitive.Content
          className={`alert-modal alert-${alert.tone}`}
          tabIndex={-1}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.focus();
          }}
        >
          <div className="alert-card">
            <div className="alert-band" aria-hidden="true">
              <span className="alert-ring alert-ring-a" />
              <span className="alert-ring alert-ring-b" />
              <span className="alert-spark alert-spark-a" />
              <span className="alert-spark alert-spark-b" />
              <span className="alert-spark alert-spark-c" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="alert-art" src={ART[alert.tone]} alt="" />
              <span className="alert-clouds" />
            </div>
            <div className="alert-body">
              <DialogPrimitive.Title className="alert-title">{alert.title}</DialogPrimitive.Title>
              {alert.body ? <DialogPrimitive.Description asChild><div className="alert-text">{alert.body}</div></DialogPrimitive.Description> : null}
              <div className="alert-actions">
                {actions.map((a) =>
                  a.href ? (
                    <Link
                      key={a.label}
                      href={a.href}
                      className={`button${a.primary ? " button-primary" : ""}`}
                      onClick={() => {
                        a.onClick?.();
                        onClose();
                      }}
                    >
                      {a.label}
                    </Link>
                  ) : (
                    <button
                      key={a.label}
                      type="button"
                      className={`button${a.primary ? " button-primary" : ""}`}
                      onClick={() => {
                        a.onClick?.();
                        onClose();
                      }}
                    >
                      {a.label}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** NEAR's mark, drawn inline. */
function NearMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#00EC97" />
      <path d="M26.4 11.2 22.6 16.8a.4.4 0 0 0 .6.5l3.7-3.2a.15.15 0 0 1 .25.11v10.1a.15.15 0 0 1-.27.1L15.7 11.6a2 2 0 0 0-1.5-.7h-.4a2 2 0 0 0-2 2v14.2a2 2 0 0 0 3.7 1l3.8-5.6a.4.4 0 0 0-.6-.5l-3.7 3.2a.15.15 0 0 1-.25-.11V15a.15.15 0 0 1 .27-.1l11.2 13.4a2 2 0 0 0 1.5.7h.4a2 2 0 0 0 2-2V12.9a2 2 0 0 0-3.7-1.7Z" fill="#111" />
    </svg>
  );
}

/** The wallet step on the local test chain: review what is sent and to whom, then transfer. */
function WalletApproval({ request, onAnswer }: { request: ApprovalRequest; onAnswer: (ok: boolean) => void }) {
  const initial = request.receiver.charAt(0).toUpperCase();
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => (open ? null : onAnswer(false))}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="alert-overlay wallet-overlay" />
        <DialogPrimitive.Content
          className="wallet-modal"
          tabIndex={-1}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.focus();
          }}
        >
          <div className="wallet-bar">
            <button type="button" className="wallet-back" onClick={() => onAnswer(false)}>
              <ArrowLeft size={26} weight="bold" aria-hidden />
              <span className="sr-only">Reject</span>
            </button>
            <span className="wallet-chain">test chain</span>
          </div>
          <DialogPrimitive.Title className="wallet-title">Review &amp; Send</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Send {request.asset ?? request.deposit} to {request.receiver} from {request.signer}.
          </DialogPrimitive.Description>
          <div className="wallet-pair">
            <div className="wallet-tile">
              {request.asset ? (
                <span className="wallet-nft" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/glass/tag-clean.webp" alt="" />
                </span>
              ) : (
                <span className="wallet-token">
                  <NearMark size={56} />
                  <span className="wallet-token-badge">
                    <NearMark size={20} />
                  </span>
                </span>
              )}
              <strong>{request.asset ?? request.deposit}</strong>
              <small>{request.summary}</small>
            </div>
            <span className="wallet-join" aria-hidden="true">
              <CaretRight size={18} weight="bold" />
            </span>
            <div className="wallet-tile">
              <span className="wallet-avatar" aria-hidden="true">
                {initial}
              </span>
              <strong>{request.receiver}</strong>
            </div>
          </div>
          <div className="wallet-details">
            <div className="wallet-row wallet-row-stack">
              <span className="wallet-label">
                <UserCircle size={26} weight="bold" aria-hidden /> Recipient
              </span>
              <span className="wallet-value">
                {request.receiver}
                <Copy size={24} weight="fill" aria-hidden />
              </span>
            </div>
            <div className="wallet-row">
              <span className="wallet-label">
                <GasPump size={26} weight="bold" aria-hidden /> Network fee
              </span>
              <span className="wallet-fee">
                <span>
                  <b>Up to 0.03 NEAR</b>
                  <small>300 TGas</small>
                </span>
                <Info size={26} weight="bold" aria-hidden />
              </span>
            </div>
          </div>
          <button type="button" className="wallet-send" onClick={() => onAnswer(true)}>
            Transfer
          </button>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
