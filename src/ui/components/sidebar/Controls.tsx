import React from 'react';

export interface SliderProps {
  id: string;
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  hint?: string;
}

export const Slider: React.FC<SliderProps> = ({ id, label, value, display, min, max, step, onChange, hint }) => (
  <div className="control">
    <div className="control-row">
      <label htmlFor={id}>{label}</label>
      <output htmlFor={id}>{display}</output>
    </div>
    <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    {hint && <p className="control-hint">{hint}</p>}
  </div>
);

export const Toggle: React.FC<{ title: string; desc: string; checked: boolean; onChange: (v: boolean) => void }> = ({
  title,
  desc,
  checked,
  onChange,
}) => (
  <label className="check-row">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span>
      <span className="check-title">{title}</span>
      <span className="check-desc">{desc}</span>
    </span>
  </label>
);

