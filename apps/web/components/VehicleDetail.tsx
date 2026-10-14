'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BadgeCheck, BookmarkPlus } from 'lucide-react';

type Vehicle = { id: string; make: string; model: string; variant: string; fuel: string; bodyType: string; pricePaise: number; sourceUrl: string; verifiedAt: string; specifications: Record<string, string | number | boolean> };
type Offer = { id: string; price_paise: number; stock: number; source_url: string; verified_at: string; expires_at: string };
const money = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100);

export function VehicleDetail({ id }: { id?: string }) {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>(id ? 'loading' : 'missing');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    fetch(`/api/catalogue/${encodeURIComponent(id)}`, { signal: controller.signal }).then(async response => {
      if (response.status === 404) { setState('missing'); return; }
      if (!response.ok) throw new Error('Unable to load vehicle');
      const data = await response.json();
      setVehicle(data.vehicle); setOffers(data.offers); setState('ready');
    }).catch(error => { if (error.name !== 'AbortError') setState('error'); });
    return () => controller.abort();
  }, [id]);

  const specs = useMemo(() => vehicle ? Object.entries(vehicle.specifications).filter(([key]) => !['verifiedBy', 'sourceType', 'retrievedAt', 'compatibleOptionIds'].includes(key)) : [], [vehicle]);
  async function mutate(path: string, body: object, headers: Record<string, string> = {}) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
      const data = await response.json();
      if (response.status === 401) { setMessage('Sign in before saving or requesting a vehicle.'); return; }
      if (!response.ok) { setMessage(data.error ?? 'The request could not be completed.'); return; }
      setMessage(data.message ?? 'Saved to your garage.');
    } finally { setBusy(false); }
  }

  if (state === 'loading') return <p role="status">Loading reviewed vehicle information…</p>;
  if (state === 'error') return <div className="error" role="alert">The vehicle could not be loaded. <Link href="/explore">Return to the catalogue</Link>.</div>;
  if (state === 'missing' || !vehicle) return <div className="empty-state"><div><h1>Select a reviewed vehicle.</h1><p>This page needs a valid catalogue record. No placeholder specifications are substituted.</p></div><Link className="button secondary" href="/explore">Explore catalogue</Link></div>;

  return <>
    <div className="page-intro"><p className="eyebrow">{vehicle.make} / {vehicle.fuel}</p><h1>{vehicle.model}</h1><p className="lead">{vehicle.variant} · {vehicle.bodyType}</p></div>
    <section className="panel"><div className="section-heading"><div><p className="eyebrow">REVIEWED EX-SHOWROOM PRICE</p><p className="result-number">{money(vehicle.pricePaise)}</p></div><div><BadgeCheck size={28} /><p>Reviewed {new Date(vehicle.verifiedAt).toLocaleDateString('en-IN')}</p><a className="text-link" href={vehicle.sourceUrl} target="_blank" rel="noreferrer">Open source <ArrowRight size={16} /></a></div></div><p className="notice">Taxes, insurance, registration and dealer fees are extra. This is not a binding quotation.</p><button className="button secondary" disabled={busy} onClick={() => mutate('/api/garage', { vehicleId: vehicle.id, notes: '' })}><BookmarkPlus size={17} /> Save to garage</button></section>
    <section className="panel"><h2>Reviewed specifications</h2>{specs.length ? <dl className="data-list">{specs.map(([key, value]) => <div key={key}><dt>{key.replace(/([A-Z])/g, ' $1')}</dt><dd>{String(value)}</dd></div>)}</dl> : <p className="empty-state">No additional reviewed specifications have been published.</p>}</section>
    <section className="panel"><h2>Current dealer offers</h2>{offers.length === 0 ? <p className="empty-state">No fresh, verified dealer stock is available.</p> : <div className="vehicle-grid">{offers.map(offer => <article className="vehicle-card" key={offer.id}><p className="eyebrow">VERIFIED STOCK</p><h3>{money(offer.price_paise)}</h3><p>{offer.stock} recorded available</p><p className="fine-print">Checked {new Date(offer.verified_at).toLocaleString('en-IN')} · Dealer confirmation required.</p><button className="button" disabled={busy} onClick={() => mutate('/api/bookings', { offerId: offer.id }, { 'Idempotency-Key': crypto.randomUUID() })}>Request this vehicle</button></article>)}</div>}{message && <p className="notice" role="status">{message} {message.startsWith('Sign in') && <Link href="/account">Open account</Link>}</p>}</section>
  </>;
}
