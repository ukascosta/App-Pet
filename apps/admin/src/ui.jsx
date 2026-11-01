/** Componentes do painel (mesmos ícones Lucevias e tokens do app). */
import React, { createContext, useContext, useEffect, useState } from 'react';
import ICONS from '@shared/icons.json';
import { AVATARS, LOGO } from '@shared/brand.js';
import { createPhotoResolver } from '@shared/photo-resolve.js';

// Mesmas fotos do app (apps/mobile/assets/photos), escolhidas pelo mesmo critério.
const PHOTO_URLS = Object.fromEntries(
  Object.entries(import.meta.glob('../../mobile/assets/photos/*.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' })).map(([k, v]) => [k.split('/').pop(), v]),
);
const resolvePhoto = createPhotoResolver(Object.keys(PHOTO_URLS));

export function Icon({ name, size = 18, weight = 'regular', color = 'currentColor', accent = 'var(--orange500)', style }) {
  const icon = ICONS[name];
  if (!icon) return <span style={{ width: size, height: size, display: 'inline-block' }} />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: 'none', ...style }} aria-hidden="true">
      {(icon[weight] || icon.regular).map((e, i) => (
        <path key={i} d={e.d} fill={e.a ? accent : color} fillRule={e.fr} clipRule={e.fr} opacity={e.opacity} />
      ))}
    </svg>
  );
}

/** Logo oficial da Vagari. `color` pinta a palavra (a estrela é sempre laranja). */
export function Logo({ width = 140, color = '#F7F2EE' }) {
  const b = LOGO.fullBox;
  return (
    <svg viewBox={b.join(' ')} width={width} role="img" aria-label="Vagari" style={{ display: 'block' }}>
      <path d={LOGO.word} fill={color} />
      <path d={LOGO.v} fill={color} />
      <path d={LOGO.star} fill={LOGO.orange} />
    </svg>
  );
}

/** Carinha da Vagari como avatar (escolhida pela chave, ex.: e-mail). */
export function Avatar({ seed = '', size = 36, id }) {
  const a = AVATARS.find((x) => x.id === id) || AVATARS[[...String(seed)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATARS.length];
  return <span className="avatar" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: a.xml }} />;
}

export const Btn = ({ children, icon, variant = '', sm, ...p }) => (
  <button className={`btn ${variant} ${sm ? 'sm' : ''}`} {...p}>
    {icon ? <Icon name={icon} size={sm ? 16 : 18} /> : null}
    {children}
  </button>
);

export const Badge = ({ children, tone = '', icon }) => (
  <span className={`badge ${tone}`}>
    {icon ? <Icon name={icon} size={13} weight="fill" /> : null}
    {children}
  </span>
);

/** Caixa "Como usar" (aberta na primeira visita de cada tela). */
export function HowTo({ title = 'Como usar esta tela', steps, open = false }) {
  return (
    <details className="howto" open={open}>
      <summary>
        <Icon name="lightbulb" weight="duotone" size={20} /> {title}
        <span className="muted small" style={{ marginLeft: 'auto', fontWeight: 600 }}>
          clique para {open ? 'recolher' : 'ver'}
        </span>
      </summary>
      <ol>
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </details>
  );
}

/** "O que muda no app" — indica qual tela do viajante é afetada. */
export function Impact({ children, where }) {
  return (
    <div className="impact">
      <Icon name="device-mobile" size={20} color="var(--orange600)" weight="duotone" />
      <div>
        <span className="tag">No app{where ? ` · ${where}` : ''}: </span>
        {children}
      </div>
    </div>
  );
}
export const ImpactTag = ({ children }) => (
  <span className="impact-inline" title="Onde isso aparece no app do viajante">
    <Icon name="device-mobile" size={12} /> {children}
  </span>
);

export function Field({ label, required, help, impact, error, children }) {
  return (
    <div className="field">
      {label ? (
        <label>
          {label} {required ? <span className="req">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <span className="err">{error}</span> : help ? <span className="help">{help}</span> : null}
      {impact ? <ImpactTag>{impact}</ImpactTag> : null}
    </div>
  );
}

export const Toggle = ({ on, onChange, label }) => (
  <button type="button" className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} aria-pressed={on} aria-label={label} />
);

export function Drawer({ title, subtitle, onClose, children, footer }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer" role="dialog" aria-label={title}>
        <div className="drawer-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p className="muted small">{subtitle}</p> : null}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="x" size={22} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer ? <div className="drawer-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Empty({ icon = 'compass', title, children, action }) {
  return (
    <div className="empty">
      <Icon name={icon} size={44} weight="duotone" color="var(--purple400)" />
      <h3 style={{ marginTop: 10, color: 'var(--ink)' }}>{title}</h3>
      {children ? <p style={{ marginTop: 6 }}>{children}</p> : null}
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  );
}

/**
 * Capa com foto (mesmo critério do app): preenche a área com o menor zoom possível,
 * centralizada, sem distorcer. `photo`: arquivo ou chave "dest:<id>" / "place:<id>".
 */
export function Cover({ art, photo, height = 160, children, style }) {
  const a = art || { colors: ['#6D1660', '#3C0328'], icon: 'globe-hemisphere-west' };
  const name = resolvePhoto(photo || `art:${a.icon}:${a.colors.join()}`);
  const url = name && PHOTO_URLS[name];
  return (
    <div
      className="cover"
      style={{
        height,
        backgroundColor: a.colors[1],
        backgroundImage: url ? `url(${url})` : `linear-gradient(135deg, ${a.colors[0]}, ${a.colors[1]})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ toast
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <ToastCtx.Provider value={setMsg}>
      {children}
      {msg ? <div className="toast" role="status">{msg}</div> : null}
    </ToastCtx.Provider>
  );
}

// ------------------------------------------------------------------ util
export const fmtDate = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');
export const fmtDateTime = (d) => (d ? `${fmtDate(d)} ${String(d).slice(11, 16)}` : '—');
export const STATUS = {
  draft: ['Rascunho', 'gray'],
  published: ['Publicada', 'green'],
  archived: ['Arquivada', 'gray'],
  canceled: ['Cancelada', 'red'],
  pending_review: ['Pendente de revisão', 'yellow'],
  approved: ['Publicado', 'green'],
};
export const StatusBadge = ({ status }) => {
  const [l, t] = STATUS[status] || [status, ''];
  return <Badge tone={t}>{l}</Badge>;
};
