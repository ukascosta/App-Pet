/** Formulário lateral genérico: mostra os erros por campo que a API devolve (mesmas regras da planilha). */
import React, { useState } from 'react';
import { Btn, Drawer, Field, Impact, Toggle } from './ui.jsx';

export function FormDrawer({ title, subtitle, fields, initial = {}, onSave, onClose, impact, impactWhere, submitLabel = 'Salvar', extra }) {
  const [values, setValues] = useState(initial);
  const [issues, setIssues] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }));
  const errOf = (k) => issues.find((i) => i.column === k && i.severity === 'error')?.message;

  const submit = async (e) => {
    e?.preventDefault();
    setSaving(true);
    setError(null);
    setIssues([]);
    try {
      const out = await onSave(values);
      if (out !== false) onClose();
    } catch (err) {
      setIssues(err.issues || []);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancelar
          </Btn>
          <Btn onClick={submit} disabled={saving}>
            {saving ? 'Salvando…' : submitLabel}
          </Btn>
        </>
      }
    >
      {impact ? <Impact where={impactWhere}>{impact}</Impact> : null}
      <form onSubmit={submit} className="grid" style={{ gap: 14 }}>
        {fields.map((f) =>
          f.row ? (
            <div key={f.row.map((x) => x.key).join()} className="grid g2">
              {f.row.map((x) => (
                <FieldInput key={x.key} f={x} value={values[x.key]} onChange={(v) => set(x.key, v)} error={errOf(x.key)} />
              ))}
            </div>
          ) : (
            <FieldInput key={f.key} f={f} value={values[f.key]} onChange={(v) => set(f.key, v)} error={errOf(f.key)} />
          ),
        )}
        <button type="submit" hidden />
      </form>
      {extra}
      {error ? (
        <div className="impact" style={{ background: 'var(--danger-bg)' }}>
          <span className="tag" style={{ color: 'var(--danger)' }}>Ops:</span> {error}
          {issues.filter((i) => !i.column).map((i, k) => (
            <div key={k}>{i.message}</div>
          ))}
        </div>
      ) : null}
    </Drawer>
  );
}

function FieldInput({ f, value, onChange, error }) {
  const common = { className: `input ${error ? 'has-err' : ''}`, value: value ?? '', onChange: (e) => onChange(e.target.value), placeholder: f.placeholder, disabled: f.disabled };
  let input;
  if (f.type === 'select')
    input = (
      <select {...common}>
        <option value="">{f.placeholder || 'Escolha…'}</option>
        {f.options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    );
  else if (f.type === 'textarea') input = <textarea {...common} />;
  else if (f.type === 'toggle')
    input = (
      <div className="row">
        <Toggle on={!!value} onChange={onChange} label={f.label} />
        <span className="small muted">{value ? f.onText || 'Sim' : f.offText || 'Não'}</span>
      </div>
    );
  else if (f.type === 'file') input = <input type="file" accept={f.accept} className="input" onChange={(e) => onChange(e.target.files[0])} />;
  else input = <input type={f.type || 'text'} {...common} />;
  return (
    <Field label={f.label} required={f.required} help={f.help} impact={f.impact} error={error}>
      {input}
    </Field>
  );
}
